import { useRef, useState, useEffect } from 'react';
import type { RadialMaskData } from '../store/types';

type DragMode = 'move' | 'resizeN' | 'resizeS' | 'resizeE' | 'resizeW';
type DragState = { mode: DragMode; ox: number; oy: number; orig: RadialMaskData };

type Props = {
  data: RadialMaskData;
  canvasW: number;
  canvasH: number;
  onUpdate: (data: RadialMaskData) => void;
};

export function RadialMaskOverlay({ data, canvasW, canvasH, onUpdate }: Props) {
  const [showHint, setShowHint] = useState(true);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 3000);
    return () => clearTimeout(t);
  }, []);

  const px = (nx: number) => nx * canvasW;
  const py = (ny: number) => ny * canvasH;
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

  const startDrag = (e: React.MouseEvent, mode: DragMode) => {
    e.stopPropagation();
    e.preventDefault();
    setShowHint(false);

    dragRef.current = { mode, ox: e.clientX, oy: e.clientY, orig: { ...data } };

    const handleMove = (me: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const ddx = (me.clientX - d.ox) / canvasW;
      const ddy = (me.clientY - d.oy) / canvasH;

      if (d.mode === 'move') {
        onUpdate({ ...d.orig, cx: clamp01(d.orig.cx + ddx), cy: clamp01(d.orig.cy + ddy) });
      } else if (d.mode === 'resizeE' || d.mode === 'resizeW') {
        onUpdate({ ...d.orig, rx: Math.max(0.01, d.orig.rx + (d.mode === 'resizeE' ? ddx : -ddx)) });
      } else if (d.mode === 'resizeS' || d.mode === 'resizeN') {
        onUpdate({ ...d.orig, ry: Math.max(0.01, d.orig.ry + (d.mode === 'resizeS' ? ddy : -ddy)) });
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

  const cx = px(data.cx);
  const cy = py(data.cy);
  const rx = data.rx * canvasW;
  const ry = data.ry * canvasH;
  const HANDLE = 6;

  // Edge handle positions
  const handles: { id: DragMode; x: number; y: number }[] = [
    { id: 'resizeN', x: cx, y: cy - ry },
    { id: 'resizeS', x: cx, y: cy + ry },
    { id: 'resizeE', x: cx + rx, y: cy },
    { id: 'resizeW', x: cx - rx, y: cy },
  ];

  return (
    <svg
      className="absolute inset-0 overflow-visible"
      width={canvasW} height={canvasH}
      style={{ pointerEvents: 'none' }}
    >
      {/* Ellipse outline */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry}
        fill="none" stroke="white" strokeWidth={1.5} strokeDasharray="5 4"
        strokeOpacity={0.8} pointerEvents="none" />

      {/* Inner soft edge ring */}
      <ellipse cx={cx} cy={cy} rx={rx * (1 - data.feather)} ry={ry * (1 - data.feather)}
        fill="none" stroke="white" strokeWidth={1} strokeDasharray="3 3"
        strokeOpacity={0.4} pointerEvents="none" />

      {/* Center pin */}
      <g style={{ cursor: 'grab', pointerEvents: 'auto' }} onMouseDown={(e) => startDrag(e, 'move')}>
        <circle cx={cx} cy={cy} r={HANDLE + 4} fill="transparent" />
        <circle cx={cx} cy={cy} r={HANDLE} fill="#4d9fec" stroke="black" strokeWidth={1.5} />
      </g>

      {/* Edge handles */}
      {handles.map(({ id, x, y }) => (
        <g key={id} style={{ cursor: id.includes('N') || id.includes('S') ? 'ns-resize' : 'ew-resize', pointerEvents: 'auto' }}
          onMouseDown={(e) => startDrag(e, id)}>
          <circle cx={x} cy={y} r={HANDLE + 4} fill="transparent" />
          <rect x={x - HANDLE} y={y - HANDLE} width={HANDLE * 2} height={HANDLE * 2} rx={2}
            fill="white" stroke="black" strokeWidth={1.5} />
        </g>
      ))}

      {/* Hint */}
      {showHint && (
        <g>
          <rect x={canvasW / 2 - 150} y={canvasH * 0.12 - 14} width={300} height={28} rx={4}
            fill="rgba(0,0,0,0.65)" />
          <text x={canvasW / 2} y={canvasH * 0.12 + 5} textAnchor="middle"
            fill="white" fontSize={11} fontFamily="sans-serif" pointerEvents="none">
            Drag center to move · Drag handles to resize
          </text>
        </g>
      )}
    </svg>
  );
}
