import { useEffect, useRef, useState } from 'react';
import { useMaskStore } from '../store/mask-store';

type Props = {
  photoId: string;
  canvasW: number;
  canvasH: number;
};

// Lightroom Classic parity: when the user clicks "+Add Linear" or "+Add
// Radial" in the mask panel, the mask is NOT created immediately. Instead we
// enter a placement mode — a crosshair cursor follows the mouse, and the
// first drag over the canvas defines the mask geometry. Escape cancels.
export function MaskPlacementOverlay({ photoId, canvasW, canvasH }: Props) {
  const pendingMaskType = useMaskStore((s) => s.pendingMaskType);
  const setPendingMaskType = useMaskStore((s) => s.setPendingMaskType);
  const addLinearMaskAt = useMaskStore((s) => s.addLinearMaskAt);
  const addRadialMaskAt = useMaskStore((s) => s.addRadialMaskAt);

  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // Escape cancels placement.
  useEffect(() => {
    if (!pendingMaskType) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPendingMaskType(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingMaskType, setPendingMaskType]);

  if (!pendingMaskType) return null;

  const toNorm = (cx: number, cy: number) => ({ x: cx / canvasW, y: cy / canvasH });

  const getPos = (e: React.MouseEvent | MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvasW;
    const y = ((e.clientY - rect.top) / rect.height) * canvasH;
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const start = getPos(e);
    setDrag({ x1: start.x, y1: start.y, x2: start.x, y2: start.y });

    const handleMove = (me: MouseEvent) => {
      const p = getPos(me);
      setDrag((d) => (d ? { ...d, x2: p.x, y2: p.y } : d));
    };

    const handleUp = (me: MouseEvent) => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      const end = getPos(me);
      const a = toNorm(start.x, start.y);
      const b = toNorm(end.x, end.y);

      // Ignore accidental clicks (no drag) — keep placement mode active.
      const dist = Math.hypot(end.x - start.x, end.y - start.y);
      if (dist < 4) {
        setDrag(null);
        return;
      }

      if (pendingMaskType === 'linear') {
        addLinearMaskAt(photoId, { x1: a.x, y1: a.y, x2: b.x, y2: b.y, feather: 0.3 });
      } else {
        // Radial: center = midpoint, rx/ry = half-extent of drag bounds.
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        const rx = Math.max(0.02, Math.abs(b.x - a.x) / 2);
        const ry = Math.max(0.02, Math.abs(b.y - a.y) / 2);
        addRadialMaskAt(photoId, {
          cx,
          cy,
          rx,
          ry,
          angle: 0,
          feather: 0.3,
          invert: false,
        });
      }
      setDrag(null);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 overflow-visible"
      width={canvasW}
      height={canvasH}
      style={{ cursor: 'crosshair', pointerEvents: 'auto' }}
      onMouseDown={handleMouseDown}
    >
      {drag &&
        pendingMaskType === 'linear' &&
        (() => {
          // Preview matches the placed linear-mask-overlay: three perpendicular
          // guide lines (start 100%, mid 50%, end 0%) plus endpoint handles.
          const gdx = drag.x2 - drag.x1;
          const gdy = drag.y2 - drag.y1;
          const glen = Math.hypot(gdx, gdy) || 0.001;
          // Extend 1.5x the canvas diagonal so guide lines reach the edges.
          const perpScale = Math.hypot(canvasW, canvasH) * 1.5;
          const perpX = (-gdy / glen) * perpScale;
          const perpY = (gdx / glen) * perpScale;
          const perpLine = (cx: number, cy: number) => ({
            x1: cx + perpX,
            y1: cy + perpY,
            x2: cx - perpX,
            y2: cy - perpY,
          });
          const startLine = perpLine(drag.x1, drag.y1);
          const midLine = perpLine((drag.x1 + drag.x2) / 2, (drag.y1 + drag.y2) / 2);
          const endLine = perpLine(drag.x2, drag.y2);
          return (
            <g pointerEvents="none">
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
                />
              ))}
              <circle
                cx={drag.x1}
                cy={drag.y1}
                r={6}
                fill="rgba(0,0,0,0.35)"
                stroke="white"
                strokeWidth={1.5}
              />
              <circle
                cx={drag.x2}
                cy={drag.y2}
                r={6}
                fill="rgba(0,0,0,0.35)"
                stroke="white"
                strokeWidth={1.5}
              />
            </g>
          );
        })()}
      {drag && pendingMaskType === 'radial' && (
        <g pointerEvents="none">
          <ellipse
            cx={(drag.x1 + drag.x2) / 2}
            cy={(drag.y1 + drag.y2) / 2}
            rx={Math.abs(drag.x2 - drag.x1) / 2}
            ry={Math.abs(drag.y2 - drag.y1) / 2}
            fill="none"
            stroke="white"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            strokeOpacity={0.9}
          />
        </g>
      )}

      {/* Hint tooltip */}
      <g pointerEvents="none">
        <rect x={canvasW / 2 - 150} y={14} width={300} height={26} rx={4} fill="rgba(0,0,0,0.7)" />
        <text
          x={canvasW / 2}
          y={31}
          textAnchor="middle"
          fill="white"
          fontSize={11}
          fontFamily="sans-serif"
        >
          Drag on the image to place the {pendingMaskType} mask · Esc to cancel
        </text>
      </g>
    </svg>
  );
}
