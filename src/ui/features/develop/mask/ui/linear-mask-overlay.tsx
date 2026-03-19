import { useRef, useState, useEffect } from 'react';
import type { LinearMaskData } from '../store/types';

type DragMode = 'create' | 'start' | 'end' | 'center';
type DragState = { mode: DragMode; ox: number; oy: number; orig: LinearMaskData };

type Props = {
  data: LinearMaskData;
  canvasW: number;
  canvasH: number;
  onUpdate: (data: LinearMaskData) => void;
};

export function LinearMaskOverlay({ data, canvasW, canvasH, onUpdate }: Props) {
  const [showHint, setShowHint] = useState(true);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 3000);
    return () => clearTimeout(t);
  }, []);

  const toNorm = (ex: number, ey: number) => ({ x: ex / canvasW, y: ey / canvasH });
  const px = (nx: number) => nx * canvasW;
  const py = (ny: number) => ny * canvasH;
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

  const mx = (data.x1 + data.x2) / 2;
  const my = (data.y1 + data.y2) / 2;

  // Perpendicular direction to gradient line
  const gdx = data.x2 - data.x1;
  const gdy = data.y2 - data.y1;
  const glen = Math.hypot(gdx, gdy) || 0.001;
  const perpX = (-gdy / glen) * 1.5; // extend 1.5x past canvas
  const perpY = (gdx / glen) * 1.5;

  const perpLine = (nx: number, ny: number) => ({
    x1: px(nx + perpX), y1: py(ny + perpY),
    x2: px(nx - perpX), y2: py(ny - perpY),
  });

  const startLine = perpLine(data.x1, data.y1);
  const midLine = perpLine(mx, my);
  const endLine = perpLine(data.x2, data.y2);

  const startDrag = (e: React.MouseEvent, mode: DragMode) => {
    e.stopPropagation();
    e.preventDefault();
    setShowHint(false);
    const rect = (e.currentTarget as SVGElement).closest('svg')!.getBoundingClientRect();
    const ox = e.clientX - rect.left;
    const oy = e.clientY - rect.top;

    if (mode === 'create') {
      const { x, y } = toNorm(ox, oy);
      const fresh: LinearMaskData = { x1: x, y1: y, x2: x, y2: y, feather: data.feather };
      onUpdate(fresh);
      dragRef.current = { mode, ox: e.clientX, oy: e.clientY, orig: fresh };
    } else {
      dragRef.current = { mode, ox: e.clientX, oy: e.clientY, orig: { ...data } };
    }

    const handleMove = (me: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const ddx = (me.clientX - d.ox) / canvasW;
      const ddy = (me.clientY - d.oy) / canvasH;
      if (d.mode === 'create' || d.mode === 'end') {
        onUpdate({ ...d.orig, x2: clamp01(d.orig.x2 + ddx), y2: clamp01(d.orig.y2 + ddy) });
      } else if (d.mode === 'start') {
        onUpdate({ ...d.orig, x1: clamp01(d.orig.x1 + ddx), y1: clamp01(d.orig.y1 + ddy) });
      } else if (d.mode === 'center') {
        onUpdate({
          ...d.orig,
          x1: clamp01(d.orig.x1 + ddx), y1: clamp01(d.orig.y1 + ddy),
          x2: clamp01(d.orig.x2 + ddx), y2: clamp01(d.orig.y2 + ddy),
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
      className="absolute inset-0 pointer-events-auto overflow-visible"
      width={canvasW} height={canvasH}
      style={{ cursor: 'crosshair' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) startDrag(e, 'create'); }}
    >
      <defs>
        <clipPath id="lmo-clip">
          <rect x={0} y={0} width={canvasW} height={canvasH} />
        </clipPath>
      </defs>

      <g clipPath="url(#lmo-clip)">
        {/* Perpendicular guide lines */}
        {[startLine, midLine, endLine].map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke="white" strokeWidth={1} strokeDasharray="4 3"
            strokeOpacity={i === 1 ? 0.5 : 0.75} pointerEvents="none" />
        ))}

        {/* Center drag area (no click-through on center pin area) */}
        <g style={{ cursor: 'grab' }} onMouseDown={(e) => startDrag(e, 'center')}>
          <circle cx={px(mx)} cy={py(my)} r={PIN + 4} fill="transparent" />
          <circle cx={px(mx)} cy={py(my)} r={PIN} fill="#4d9fec" stroke="black" strokeWidth={1.5} />
        </g>

        {/* Start pin (circle with cross) */}
        <g style={{ cursor: 'move' }} onMouseDown={(e) => startDrag(e, 'start')}>
          <circle cx={px(data.x1)} cy={py(data.y1)} r={PIN + 4} fill="transparent" />
          <circle cx={px(data.x1)} cy={py(data.y1)} r={PIN} fill="white" stroke="black" strokeWidth={1.5} />
          <path d={`M${px(data.x1) - 3},${py(data.y1)} h6 M${px(data.x1)},${py(data.y1) - 3} v6`}
            stroke="black" strokeWidth={1.5} pointerEvents="none" />
        </g>

        {/* End pin (circle with dot = full weight) */}
        <g style={{ cursor: 'move' }} onMouseDown={(e) => startDrag(e, 'end')}>
          <circle cx={px(data.x2)} cy={py(data.y2)} r={PIN + 4} fill="transparent" />
          <circle cx={px(data.x2)} cy={py(data.y2)} r={PIN} fill="white" stroke="black" strokeWidth={1.5} />
          <circle cx={px(data.x2)} cy={py(data.y2)} r={3} fill="black" pointerEvents="none" />
        </g>
      </g>

      {/* Hint tooltip */}
      {showHint && (
        <g style={{ opacity: 1, transition: 'opacity 0.5s' }}>
          <rect x={canvasW / 2 - 155} y={canvasH * 0.15 - 14} width={310} height={28} rx={4}
            fill="rgba(0,0,0,0.65)" />
          <text x={canvasW / 2} y={canvasH * 0.15 + 5} textAnchor="middle"
            fill="white" fontSize={11} fontFamily="sans-serif" pointerEvents="none">
            Drag image to set gradient · Drag pins to adjust
          </text>
        </g>
      )}
    </svg>
  );
}
