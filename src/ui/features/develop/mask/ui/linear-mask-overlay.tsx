import { useRef, useState, useEffect } from 'react';
import type { CropState } from '@/features/develop/crop/store/types';
import type { LinearMaskData } from '../store/types';
import { linearImageToScreen, linearScreenToImage } from '../lib/mask-geometry';

type DragMode = 'create' | 'start' | 'end' | 'center';
// `orig` is in overlay space (fractions of the visible area).
type DragState = { mode: DragMode; ox: number; oy: number; orig: LinearMaskData };

type Props = {
  /** Stored in original-image UV; may extend beyond the visible crop. */
  data: LinearMaskData;
  canvasW: number;
  canvasH: number;
  cropState?: CropState | null;
  imgAspect: number;
  onUpdate: (data: LinearMaskData) => void;
  disableInteraction?: boolean;
};

export function LinearMaskOverlay({
  data: imageData,
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

  const data = linearImageToScreen(imageData, cropState, imgAspect);
  const commit = (screen: LinearMaskData) =>
    onUpdate(linearScreenToImage(screen, cropState, imgAspect));

  const px = (nx: number) => nx * canvasW;
  const py = (ny: number) => ny * canvasH;

  const mx = (data.x1 + data.x2) / 2;
  const my = (data.y1 + data.y2) / 2;

  // Perpendicular direction in pixel space (matches the aspect-correct shader).
  const gdx = px(data.x2) - px(data.x1);
  const gdy = py(data.y2) - py(data.y1);
  const glen = Math.hypot(gdx, gdy) || 0.001;
  const reach = Math.hypot(canvasW, canvasH) * 1.5;
  const perpX = (-gdy / glen) * reach;
  const perpY = (gdx / glen) * reach;

  const perpLine = (nx: number, ny: number) => ({
    x1: px(nx) + perpX,
    y1: py(ny) + perpY,
    x2: px(nx) - perpX,
    y2: py(ny) - perpY,
  });

  const startLine = perpLine(data.x1, data.y1);
  const midLine = perpLine(mx, my);
  const endLine = perpLine(data.x2, data.y2);

  const startDrag = (e: React.MouseEvent, mode: DragMode) => {
    e.stopPropagation();
    e.preventDefault();
    setShowHint(false);
    // Measured against the on-screen rect so it stays correct at any zoom.
    const rect = (e.currentTarget as SVGElement).closest('svg')!.getBoundingClientRect();
    const rectW = rect.width || canvasW;
    const rectH = rect.height || canvasH;

    if (mode === 'create') {
      const x = (e.clientX - rect.left) / rectW;
      const y = (e.clientY - rect.top) / rectH;
      const fresh: LinearMaskData = { x1: x, y1: y, x2: x, y2: y, feather: data.feather };
      commit(fresh);
      dragRef.current = { mode, ox: e.clientX, oy: e.clientY, orig: fresh };
    } else {
      dragRef.current = { mode, ox: e.clientX, oy: e.clientY, orig: { ...data } };
    }

    const handleMove = (me: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const ddx = (me.clientX - d.ox) / rectW;
      const ddy = (me.clientY - d.oy) / rectH;
      if (d.mode === 'create' || d.mode === 'end') {
        commit({ ...d.orig, x2: d.orig.x2 + ddx, y2: d.orig.y2 + ddy });
      } else if (d.mode === 'start') {
        commit({ ...d.orig, x1: d.orig.x1 + ddx, y1: d.orig.y1 + ddy });
      } else if (d.mode === 'center') {
        commit({
          ...d.orig,
          x1: d.orig.x1 + ddx,
          y1: d.orig.y1 + ddy,
          x2: d.orig.x2 + ddx,
          y2: d.orig.y2 + ddy,
        });
      }
    };

    const handleUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const PIN = 7;

  return (
    <svg
      className="absolute inset-0 overflow-visible"
      width={canvasW}
      height={canvasH}
      style={{
        cursor: disableInteraction ? undefined : 'crosshair',
        pointerEvents: disableInteraction ? 'none' : 'auto',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) startDrag(e, 'create');
      }}
    >
      <defs>
        <clipPath id="lmo-clip">
          <rect x={0} y={0} width={canvasW} height={canvasH} />
        </clipPath>
      </defs>

      <g clipPath="url(#lmo-clip)">
        {/* Perpendicular guide lines — LR Classic: start/end bright (~0.9),
            middle dimmer (~0.4) to denote the 50% transition. */}
        {[startLine, midLine, endLine].map((l, i) => (
          <line
            key={i}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke="white"
            strokeWidth={1}
            strokeDasharray="4 3"
            strokeOpacity={i === 1 ? 0.4 : 0.9}
            pointerEvents="none"
          />
        ))}
      </g>

      {/* Handles are not clipped: endpoints may sit outside the crop frame. */}
      <g>
        {/* Start handle — hollow ring, LR Classic style. No "+" cross. */}
        <g style={{ cursor: 'move' }} onMouseDown={(e) => startDrag(e, 'start')}>
          <circle cx={px(data.x1)} cy={py(data.y1)} r={PIN + 4} fill="transparent" />
          <circle
            cx={px(data.x1)}
            cy={py(data.y1)}
            r={PIN - 1}
            fill="rgba(0,0,0,0.35)"
            stroke="white"
            strokeWidth={1.5}
          />
        </g>

        {/* End handle — identical to start (no direction distinction). */}
        <g style={{ cursor: 'move' }} onMouseDown={(e) => startDrag(e, 'end')}>
          <circle cx={px(data.x2)} cy={py(data.y2)} r={PIN + 4} fill="transparent" />
          <circle
            cx={px(data.x2)}
            cy={py(data.y2)}
            r={PIN - 1}
            fill="rgba(0,0,0,0.35)"
            stroke="white"
            strokeWidth={1.5}
          />
        </g>

        {/* Center pin — bullseye look marks the mask anchor. Rendered last so
            it sits above the handles if they overlap. */}
        <g style={{ cursor: 'grab' }} onMouseDown={(e) => startDrag(e, 'center')}>
          <circle cx={px(mx)} cy={py(my)} r={PIN + 4} fill="transparent" />
          <circle cx={px(mx)} cy={py(my)} r={PIN} fill="#4d9fec" stroke="white" strokeWidth={1.5} />
          <circle cx={px(mx)} cy={py(my)} r={2} fill="white" pointerEvents="none" />
        </g>
      </g>

      {/* Hint tooltip */}
      {showHint && (
        <g style={{ opacity: 1, transition: 'opacity 0.5s' }}>
          <rect
            x={canvasW / 2 - 155}
            y={canvasH * 0.15 - 14}
            width={310}
            height={28}
            rx={4}
            fill="rgba(0,0,0,0.65)"
          />
          <text
            x={canvasW / 2}
            y={canvasH * 0.15 + 5}
            textAnchor="middle"
            fill="white"
            fontSize={11}
            fontFamily="sans-serif"
            pointerEvents="none"
          >
            Drag image to set gradient · Drag pins to adjust
          </text>
        </g>
      )}
    </svg>
  );
}
