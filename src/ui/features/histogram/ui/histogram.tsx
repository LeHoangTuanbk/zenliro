import { useLayoutEffect, useRef } from 'react';
import type { HistogramData } from '../lib/compute-histogram';
import type { PhotoExif } from '../lib/read-exif';

interface HistogramProps {
  data: HistogramData | null;
  exif?: PhotoExif | null;
}

const CHANNELS: { key: keyof HistogramData; color: string }[] = [
  { key: 'b', color: 'rgba(60,120,255,0.55)' },
  { key: 'g', color: 'rgba(60,190,80,0.55)'  },
  { key: 'r', color: 'rgba(255,60,60,0.55)'  },
];

const ZONES = ['Blacks', 'Shadows', 'Mids', 'Highlights', 'Whites'] as const;

/** Smooth filled path using quadratic bezier through midpoints */
function drawSmoothFill(
  ctx: CanvasRenderingContext2D,
  bins: Uint32Array,
  peak: number,
  W: number,
  H: number,
) {
  const getY = (i: number) => H - Math.min(1, bins[i] / peak) * H * 0.96;
  ctx.beginPath();
  ctx.moveTo(0, H);
  let px = 0, py = getY(0);
  ctx.lineTo(px, py);
  for (let i = 1; i < 256; i++) {
    const x = (i / 255) * W;
    const y = getY(i);
    ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
    px = x; py = y;
  }
  ctx.lineTo(W, py);
  ctx.lineTo(W, H);
  ctx.closePath();
}

/** Smooth stroke (no fill) */
function drawSmoothStroke(
  ctx: CanvasRenderingContext2D,
  getY: (i: number) => number,
  W: number,
) {
  ctx.beginPath();
  let px = 0, py = getY(0);
  ctx.moveTo(px, py);
  for (let i = 1; i < 256; i++) {
    const x = (i / 255) * W;
    const y = getY(i);
    ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
    px = x; py = y;
  }
  ctx.lineTo(W, py);
}

/** Count pixels in a bin range 0–255 */
function sumRange(arr: Uint32Array, lo: number, hi: number) {
  let s = 0;
  for (let i = lo; i <= hi; i++) s += arr[i];
  return s;
}

const CANVAS_H = 90;

export function Histogram({ data, exif }: HistogramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    if (!data) return;

    // Peak: skip extreme bins 0 & 255 to avoid clipping spikes dominating
    let peak = 1;
    for (const ch of CHANNELS) {
      for (let i = 1; i < 255; i++) if (data[ch.key][i] > peak) peak = data[ch.key][i];
    }

    // Zone separators
    const zoneBounds = [0, 51, 102, 153, 204, 255];
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 1; i < zoneBounds.length - 1; i++) {
      const x = Math.round((zoneBounds[i] / 255) * W) + 0.5;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }

    // Channels with additive (lighter) blending for natural Lightroom-style overlap
    ctx.globalCompositeOperation = 'lighter';
    for (const { key, color } of CHANNELS) {
      ctx.fillStyle = color;
      drawSmoothFill(ctx, data[key], peak, W, H);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // Luminosity white curve
    const lumY = (i: number) => {
      const lum = (data.r[i] + data.g[i] + data.b[i]) / 3;
      return H - Math.min(1, lum / peak) * H * 0.96;
    };
    drawSmoothStroke(ctx, lumY, W);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [data]);

  // Clipping detection
  const shadowClip    = data ? (data.r[0]   + data.g[0]   + data.b[0])   > 200 : false;
  const highlightClip = data ? (data.r[255] + data.g[255] + data.b[255]) > 200 : false;

  return (
    <div className="w-full bg-[#111] border-b border-black">
      {/* Canvas */}
      <div className="relative w-full" style={{ height: CANVAS_H }}>
        <canvas
          ref={canvasRef}
          width={256}
          height={CANVAS_H}
          className="absolute inset-0 w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        />
        {!data && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[9px] text-[#333]">No image</span>
          </div>
        )}
        {/* Clipping warnings — always visible; lit up when clipping detected */}
        <div className="absolute top-1 left-1" title="Shadow clipping">
          <div className={`w-0 h-0 transition-colors ${shadowClip
            ? 'border-r-[9px] border-r-[#4da6ff] border-y-[6px] border-y-transparent'
            : 'border-r-[9px] border-r-[#444] border-y-[6px] border-y-transparent'}`} />
        </div>
        <div className="absolute top-1 right-1" title="Highlight clipping">
          <div className={`w-0 h-0 transition-colors ${highlightClip
            ? 'border-l-[9px] border-l-[#ff6b6b] border-y-[6px] border-y-transparent'
            : 'border-l-[9px] border-l-[#444] border-y-[6px] border-y-transparent'}`} />
        </div>
      </div>

      {/* EXIF row — like Lightroom */}
      <div className="flex items-center justify-between px-2 py-[3px] border-t border-[#1a1a1a]">
        {exif && (exif.iso || exif.focalLength || exif.aperture || exif.shutterSpeed) ? (
          <>
            {exif.iso         && <ExifChip label={`ISO ${exif.iso}`} />}
            {exif.focalLength && <ExifChip label={`${exif.focalLength} mm`} />}
            {exif.aperture    && <ExifChip label={`f / ${exif.aperture.toFixed(1)}`} />}
            {exif.shutterSpeed && <ExifChip label={exif.shutterSpeed} />}
          </>
        ) : (
          <span className="text-[9px] text-[#2a2a2a] w-full text-center">—</span>
        )}
      </div>

      {/* Zone labels */}
      <div className="flex w-full px-1 pb-1">
        {ZONES.map((z, i) => {
          const lo = [0, 51, 102, 153, 204][i];
          const hi = [50, 101, 152, 203, 255][i];
          const hasData = data
            ? sumRange(data.r, lo, hi) + sumRange(data.g, lo, hi) + sumRange(data.b, lo, hi) > 0
            : false;
          return (
            <span
              key={z}
              className={`flex-1 text-center text-[8px] tracking-tight transition-colors ${hasData ? 'text-[#505050]' : 'text-[#2a2a2a]'}`}
            >
              {z}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ExifChip({ label }: { label: string }) {
  return (
    <span className="text-[9px] text-[#606060] tabular-nums tracking-tight">{label}</span>
  );
}
