/** Convert normalized (cx=0, cy=0 center) x,y within radius → hue (0–360) and sat (0–1). */
export function xyToHueSat(
  x: number,
  y: number,
  radius: number,
): { hue: number; sat: number } {
  const sat = Math.min(Math.sqrt(x * x + y * y) / radius, 1);
  const hue = ((Math.atan2(-y, x) * 180) / Math.PI + 360) % 360;
  return { hue, sat };
}

/** Convert hue (0–360) + sat (0–1) → normalized x,y offset from center. */
export function hueSatToXY(
  hue: number,
  sat: number,
  radius: number,
): { x: number; y: number } {
  const rad = (hue * Math.PI) / 180;
  return {
    x: Math.cos(rad) * sat * radius,
    y: -Math.sin(rad) * sat * radius,
  };
}

/** CSS color string for the wheel gradient (given angle = hue). */
export function wheelGradientStyle(size: number): React.CSSProperties {
  const stops = Array.from(
    { length: 13 },
    (_, i) => `hsl(${i * 30},100%,50%) ${Math.round((i / 12) * 100)}%`,
  ).join(', ');
  return {
    width: size,
    height: size,
    borderRadius: '50%',
    background: `
      radial-gradient(circle, white 0%, transparent 70%),
      conic-gradient(${stops})
    `,
  };
}
