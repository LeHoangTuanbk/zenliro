import { useRef, useCallback } from 'react';
import { xyToHueSat, hueSatToXY } from '../lib/wheel-math';

type Props = {
  hue: number;
  sat: number;
  size: number;
  onChange: (hue: number, sat: number) => void;
};

export function ColorWheel({ hue, sat, size, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const radius = size / 2;
  const dot = hueSatToXY(hue, sat, radius - 4);

  const applyEvent = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const x = e.clientX - rect.left - radius;
      const y = e.clientY - rect.top - radius;
      const { hue: h, sat: s } = xyToHueSat(x, y, radius - 4);
      onChange(h, s);
    },
    [radius, onChange],
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    applyEvent(e);
    const onMove = (ev: MouseEvent) => { if (isDragging.current) applyEvent(ev); };
    const onUp = () => { isDragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const stops = Array.from(
    { length: 13 },
    (_, i) => `hsl(${i * 30},100%,50%) ${Math.round((i / 12) * 100)}%`,
  ).join(', ');

  return (
    <div
      ref={ref}
      style={{ width: size, height: size, position: 'relative', cursor: 'crosshair', flexShrink: 0 }}
      onMouseDown={handleMouseDown}
    >
      {/* Hue ring */}
      <div
        style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: `conic-gradient(${stops})`,
        }}
      />
      {/* White center radial overlay */}
      <div
        style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'radial-gradient(circle, white 0%, transparent 65%)',
        }}
      />
      {/* Dark outer edge */}
      <div
        style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'radial-gradient(circle, transparent 60%, rgba(0,0,0,0.35) 100%)',
        }}
      />
      {/* Dot indicator */}
      {sat > 0.01 && (
        <div
          style={{
            position: 'absolute',
            left: radius + dot.x - 5,
            top: radius + dot.y - 5,
            width: 10, height: 10,
            borderRadius: '50%',
            border: '1.5px solid white',
            background: `hsl(${hue},${Math.round(sat * 100)}%,50%)`,
            boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
          }}
        />
      )}
      {/* Center dot when sat=0 */}
      {sat <= 0.01 && (
        <div
          style={{
            position: 'absolute',
            left: radius - 4, top: radius - 4,
            width: 8, height: 8,
            borderRadius: '50%',
            border: '1.5px solid rgba(255,255,255,0.6)',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}
