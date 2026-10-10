import { useRef, useState, useEffect } from 'react';
import type { CropState } from '@/features/develop/crop/store/types';
import type { RadialMaskData } from '../store/types';
import { radialImageToScreen, radialScreenToImage } from '../lib/mask-geometry';

type DragMode = 'move' | 'resizeN' | 'resizeS' | 'resizeE' | 'resizeW';
// Geometry captured at drag start, in overlay pixels.
type DragState = {
  mode: DragMode;
  ox: number;
  oy: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
};

type Props = {
  /** Stored in original-image UV; may extend beyond the visible crop. */
  data: RadialMaskData;
  canvasW: number;
  canvasH: number;
  cropState?: CropState | null;
  imgAspect: number;
  onUpdate: (data: RadialMaskData) => void;
  disableInteraction?: boolean;
};

const HANDLE = 6;
const MIN_RADIUS_PX = 4;

export function RadialMaskOverlay({
  data,
  canvasW,
  canvasH,
  cropState,
  imgAspect,
  onUpdate,
  disableInteraction,
}: Props) {
  const [showHint, setShowHint] = useState(true);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 3000);
    return () => clearTimeout(t);
  }, []);

  const screen = radialImageToScreen(data, cropState, imgAspect);
  const cx = screen.cx * canvasW;
  const cy = screen.cy * canvasH;
  const rx = screen.rx * canvasW;
  const ry = screen.ry * canvasH;
  const angleRad = (screen.angle * Math.PI) / 180;
  // Ellipse axes in overlay pixels: u = major (rx), v = minor (ry).
  const u = { x: Math.cos(angleRad), y: Math.sin(angleRad) };
  const v = { x: -Math.sin(angleRad), y: Math.cos(angleRad) };

  const commit = (ncx: number, ncy: number, nrx: number, nry: number) =>
    onUpdate(
      radialScreenToImage(
        {
          cx: ncx / canvasW,
          cy: ncy / canvasH,
          rx: Math.max(MIN_RADIUS_PX, nrx) / canvasW,
          ry: Math.max(MIN_RADIUS_PX, nry) / canvasH,
          angle: screen.angle,
        },
        data,
        cropState,
        imgAspect,
      ),
    );

  const startDrag = (e: React.MouseEvent, mode: DragMode) => {
    e.stopPropagation();
    e.preventDefault();
    setShowHint(false);

    // Convert client deltas to overlay pixels so dragging is zoom-independent.
    const rect = (e.currentTarget as SVGElement).closest('svg')!.getBoundingClientRect();
    const sx = canvasW / (rect.width || canvasW);
    const sy = canvasH / (rect.height || canvasH);
    dragRef.current = { mode, ox: e.clientX, oy: e.clientY, cx, cy, rx, ry };

    const handleMove = (me: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = (me.clientX - d.ox) * sx;
      const dy = (me.clientY - d.oy) * sy;
      const alongU = dx * u.x + dy * u.y;
      const alongV = dx * v.x + dy * v.y;
      if (d.mode === 'move') commit(d.cx + dx, d.cy + dy, d.rx, d.ry);
      else if (d.mode === 'resizeE') commit(d.cx, d.cy, d.rx + alongU, d.ry);
      else if (d.mode === 'resizeW') commit(d.cx, d.cy, d.rx - alongU, d.ry);
      else if (d.mode === 'resizeS') commit(d.cx, d.cy, d.rx, d.ry + alongV);
      else commit(d.cx, d.cy, d.rx, d.ry - alongV);
    };

    const handleUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const handles: { id: DragMode; x: number; y: number }[] = [
    { id: 'resizeN', x: cx - v.x * ry, y: cy - v.y * ry },
    { id: 'resizeS', x: cx + v.x * ry, y: cy + v.y * ry },
    { id: 'resizeE', x: cx + u.x * rx, y: cy + u.y * rx },
    { id: 'resizeW', x: cx - u.x * rx, y: cy - u.y * rx },
  ];
  const ellipseTransform = `rotate(${screen.angle} ${cx} ${cy})`;

  return (
    <svg
      className="absolute inset-0 overflow-visible"
      width={canvasW}
      height={canvasH}
      style={{ pointerEvents: 'none' }}
    >
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        transform={ellipseTransform}
        fill="none"
        stroke="white"
        strokeWidth={1.5}
        strokeDasharray="5 4"
        strokeOpacity={0.8}
        pointerEvents="none"
      />

      <ellipse
        cx={cx}
        cy={cy}
        rx={rx * (1 - data.feather)}
        ry={ry * (1 - data.feather)}
        transform={ellipseTransform}
        fill="none"
        stroke="white"
        strokeWidth={1}
        strokeDasharray="3 3"
        strokeOpacity={0.4}
        pointerEvents="none"
      />

      <g
        style={{ cursor: 'grab', pointerEvents: disableInteraction ? 'none' : 'auto' }}
        onMouseDown={(e) => startDrag(e, 'move')}
      >
        <circle cx={cx} cy={cy} r={HANDLE + 4} fill="transparent" />
        <circle cx={cx} cy={cy} r={HANDLE} fill="#4d9fec" stroke="black" strokeWidth={1.5} />
      </g>

      {handles.map(({ id, x, y }) => (
        <g
          key={id}
          style={{
            cursor: id === 'resizeN' || id === 'resizeS' ? 'ns-resize' : 'ew-resize',
            pointerEvents: disableInteraction ? 'none' : 'auto',
          }}
          onMouseDown={(e) => startDrag(e, id)}
        >
          <circle cx={x} cy={y} r={HANDLE + 4} fill="transparent" />
          <rect
            x={x - HANDLE}
            y={y - HANDLE}
            width={HANDLE * 2}
            height={HANDLE * 2}
            rx={2}
            fill="white"
            stroke="black"
            strokeWidth={1.5}
          />
        </g>
      ))}

      {showHint && (
        <g>
          <rect
            x={canvasW / 2 - 150}
            y={canvasH * 0.12 - 14}
            width={300}
            height={28}
            rx={4}
            fill="rgba(0,0,0,0.65)"
          />
          <text
            x={canvasW / 2}
            y={canvasH * 0.12 + 5}
            textAnchor="middle"
            fill="white"
            fontSize={11}
            fontFamily="sans-serif"
            pointerEvents="none"
          >
            Drag center to move · Drag handles to resize
          </text>
        </g>
      )}
    </svg>
  );
}
