import { useEffect, useRef, useCallback, useState } from 'react';
import type { CurvePoint } from '../store/types';
import { monotonicCubicSpline } from '../lib/curve-math';

type Props = {
  points: CurvePoint[];
  onChange: (pts: CurvePoint[]) => void;
  color?: string;
  activeZone?: string | null;
  activeValue?: number;
  parametricOffset?: (x: number) => number;
};

const SIZE = 200;
const PT_RADIUS = 4;
const HIT_RADIUS = 8;

function sortPoints(pts: CurvePoint[]): CurvePoint[] {
  return [...pts].sort((a, b) => a.x - b.x);
}

export function CurveEditor({
  points,
  onChange,
  color = '#ffffff',
  activeZone,
  activeValue,
  parametricOffset,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draggingRef = useRef<number | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, SIZE, SIZE);

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Grid lines (4x4)
    ctx.strokeStyle = '#2e2e2e';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const pos = (i / 4) * SIZE;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(SIZE, pos);
      ctx.stroke();
    }

    // Identity diagonal
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, SIZE);
    ctx.lineTo(SIZE, 0);
    ctx.stroke();

    // Curve (base spline + parametric offset)
    const sorted = sortPoints(points);
    const fn = monotonicCubicSpline(sorted);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let px = 0; px <= SIZE; px++) {
      const x = px / SIZE;
      const base = fn(x);
      const offset = parametricOffset ? parametricOffset(x) : 0;
      const y = Math.max(0, Math.min(1, base + offset));
      const cy = (1 - y) * SIZE;
      if (px === 0) ctx.moveTo(px, cy);
      else ctx.lineTo(px, cy);
    }
    ctx.stroke();

    // Control points
    for (const pt of sorted) {
      const cx = pt.x * SIZE;
      const cy = (1 - pt.y) * SIZE;
      ctx.beginPath();
      ctx.arc(cx, cy, PT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [points, color, parametricOffset]);

  useEffect(() => {
    draw();
  }, [draw]);

  const toNorm = (e: MouseEvent | React.MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = SIZE / rect.width;
    const scaleY = SIZE / rect.height;
    return {
      x: Math.max(0, Math.min(1, ((e.clientX - rect.left) * scaleX) / SIZE)),
      y: Math.max(0, Math.min(1, 1 - ((e.clientY - rect.top) * scaleY) / SIZE)),
    };
  };

  const findHit = (norm: { x: number; y: number }) =>
    points.findIndex((p) => {
      const dx = (p.x - norm.x) * SIZE;
      const dy = (p.y - norm.y) * SIZE;
      return Math.sqrt(dx * dx + dy * dy) < HIT_RADIUS;
    });

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const norm = toNorm(e, e.currentTarget);
    const idx = findHit(norm);
    if (idx !== -1) {
      draggingRef.current = idx;
    } else {
      const newPts = sortPoints([...points, { x: norm.x, y: norm.y }]);
      draggingRef.current = newPts.findIndex((p) => p.x === norm.x && p.y === norm.y);
      onChange(newPts);
    }
  };

  const handleDblClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const norm = toNorm(e, e.currentTarget);
    const idx = findHit(norm);
    if (idx === -1) return;
    const pt = points[idx];
    if (pt.x === 0 || pt.x === 1) return;
    onChange(points.filter((_, i) => i !== idx));
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const norm = toNorm(e, e.currentTarget);
    const fn = monotonicCubicSpline(sortPoints(points));
    const base = fn(norm.x);
    const offset = parametricOffset ? parametricOffset(norm.x) : 0;
    setHover({ x: norm.x, y: Math.max(0, Math.min(1, base + offset)) });
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (draggingRef.current === null || !canvas) return;
      const norm = toNorm(e, canvas);
      const sorted = sortPoints(points);
      const idx = draggingRef.current;
      const pt = sorted[idx];
      const isCorner = pt.x === 0 || pt.x === 1;
      const newX = isCorner
        ? pt.x
        : Math.max(
            idx > 0 ? sorted[idx - 1].x + 0.001 : 0,
            Math.min(idx < sorted.length - 1 ? sorted[idx + 1].x - 0.001 : 1, norm.x),
          );
      const updated = sorted.map((p, i) => (i === idx ? { x: newX, y: norm.y } : p));
      onChange(updated);
    };
    const onUp = () => {
      draggingRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [points, onChange]);

  const fmtVal = (v: number) => (v > 0 ? `+${v}` : String(v));

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        className="w-full cursor-crosshair rounded-[2px]"
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDblClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      />

      {/* Coordinate readout (top-left) */}
      {hover && (
        <div className="absolute top-1.5 left-2 text-[10px] text-br-text font-[tabular-nums] pointer-events-none select-none opacity-80">
          {Math.round(hover.x * 255)} / {Math.round(hover.y * 255)}
        </div>
      )}

      {/* Active zone info (bottom) */}
      {activeZone && activeValue !== undefined && (
        <div className="absolute bottom-1.5 left-2 right-2 flex justify-between text-[10px] pointer-events-none select-none">
          <span className="text-br-text font-semibold">{activeZone}</span>
          <span className="text-br-text font-[tabular-nums]">{fmtVal(activeValue)}</span>
        </div>
      )}
    </div>
  );
}
