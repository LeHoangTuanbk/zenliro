import { useEffect, useRef } from 'react';
import type { MaskInteractionProps } from '@widgets/image-canvas/store/types';
import type { BrushStroke, BrushPoint } from '../store/types';
import { LinearMaskOverlay } from './linear-mask-overlay';
import { RadialMaskOverlay } from './radial-mask-overlay';

type Props = {
  interactionProps: MaskInteractionProps;
  canvasW: number;
  canvasH: number;
  zoom: number;
};

// ── Brush painting helpers ────────────────────────────────────────────────────

function paintDotOnCtx(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  sizePx: number, feather: number, opacity: number, erase: boolean,
) {
  const r = Math.max(1, sizePx / 2);
  const hardR = r * (1 - feather);
  ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
  const grad = ctx.createRadialGradient(x, y, hardR, x, y, r);
  grad.addColorStop(0, `rgba(255,50,50,${opacity * 0.55})`);
  grad.addColorStop(1, 'rgba(255,50,50,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawStrokesOnCtx(
  ctx: CanvasRenderingContext2D,
  strokes: BrushStroke[],
  canvasW: number,
  canvasH: number,
) {
  ctx.save();
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    const sizePx = stroke.size * canvasW;
    for (let i = 0; i < stroke.points.length; i++) {
      const p = stroke.points[i];
      const px = p.x * canvasW, py = p.y * canvasH;
      paintDotOnCtx(ctx, px, py, sizePx, stroke.feather, stroke.opacity, stroke.erase);
      if (i > 0) {
        const prev = stroke.points[i - 1];
        const ppx = prev.x * canvasW, ppy = prev.y * canvasH;
        const dist = Math.hypot(px - ppx, py - ppy);
        const steps = Math.max(1, Math.floor(dist / (sizePx * 0.2)));
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          paintDotOnCtx(ctx, ppx + (px - ppx) * t, ppy + (py - ppy) * t, sizePx, stroke.feather, stroke.opacity, stroke.erase);
        }
      }
    }
  }
  ctx.restore();
}

// ── Brush overlay ─────────────────────────────────────────────────────────────

function BrushOverlay({
  interactionProps, canvasW, canvasH, zoom,
}: { interactionProps: Extract<MaskInteractionProps, { maskType: 'brush' }>; canvasW: number; canvasH: number; zoom: number }) {
  const strokesRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<BrushPoint | null>(null);
  const prevStrokesLenRef = useRef(0);

  const {
    selectedMaskId, brushSizePx, brushFeather, brushOpacity, brushErase,
    strokes, onStrokeAdded, onBrushSizeChange,
  } = interactionProps;

  useEffect(() => {
    const canvas = strokesRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvasW, canvasH);
    drawStrokesOnCtx(ctx, strokes, canvasW, canvasH);
    prevStrokesLenRef.current = strokes.length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMaskId, canvasW, canvasH]);

  useEffect(() => {
    const canvas = strokesRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    if (strokes.length < prevStrokesLenRef.current) {
      ctx.clearRect(0, 0, canvasW, canvasH);
      drawStrokesOnCtx(ctx, strokes, canvasW, canvasH);
      prevStrokesLenRef.current = strokes.length;
    } else if (strokes.length > prevStrokesLenRef.current) {
      drawStrokesOnCtx(ctx, strokes.slice(prevStrokesLenRef.current), canvasW, canvasH);
      prevStrokesLenRef.current = strokes.length;
    }
  }, [strokes, canvasW, canvasH]);

  const canvasToNorm = (cx: number, cy: number): BrushPoint => ({ x: cx / canvasW, y: cy / canvasH });
  const makeStroke = (points: BrushPoint[]): BrushStroke => ({
    points, size: brushSizePx / zoom / canvasW,
    feather: brushFeather / 100, opacity: brushOpacity / 100, erase: brushErase,
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    isDrawingRef.current = true;
    const norm = canvasToNorm(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    lastPointRef.current = norm;
    onStrokeAdded(makeStroke([norm]));
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const x = e.nativeEvent.offsetX, y = e.nativeEvent.offsetY;
    const cursorCanvas = cursorRef.current;
    if (cursorCanvas) {
      const ctx = cursorCanvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvasW, canvasH);
      const r = Math.max(0.5, brushSizePx / (2 * zoom));
      const lw = 1.5 / zoom;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.strokeStyle = brushErase ? 'rgba(255,80,80,0.9)' : 'rgba(255,255,255,0.9)';
      ctx.lineWidth = lw; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = lw / 3; ctx.stroke();
    }
    if (!isDrawingRef.current) return;
    const norm = canvasToNorm(x, y);
    const prev = lastPointRef.current;
    lastPointRef.current = norm;
    onStrokeAdded(makeStroke(prev ? [prev, norm] : [norm]));
  };

  const handleMouseLeave = () => {
    cursorRef.current?.getContext('2d')!.clearRect(0, 0, canvasW, canvasH);
    isDrawingRef.current = false; lastPointRef.current = null;
  };

  const handleMouseUp = () => { isDrawingRef.current = false; lastPointRef.current = null; };

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    onBrushSizeChange(Math.max(5, Math.min(300, brushSizePx + (e.deltaY > 0 ? -5 : 5))));
  };

  const shared = { width: canvasW, height: canvasH, className: 'absolute inset-0 pointer-events-none' as const };

  return (
    <>
      <canvas ref={strokesRef} {...shared} />
      <canvas ref={cursorRef} {...shared}
        className="absolute inset-0 pointer-events-auto"
        style={{ cursor: 'none' }}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp} onMouseLeave={handleMouseLeave} onWheel={handleWheel}
      />
    </>
  );
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

export function MaskOverlay({ interactionProps, canvasW, canvasH, zoom }: Props) {
  if (interactionProps.maskType === 'linear') {
    return (
      <LinearMaskOverlay
        data={interactionProps.linearData}
        canvasW={canvasW} canvasH={canvasH}
        onUpdate={interactionProps.onUpdate}
      />
    );
  }
  if (interactionProps.maskType === 'radial') {
    return (
      <RadialMaskOverlay
        data={interactionProps.radialData}
        canvasW={canvasW} canvasH={canvasH}
        onUpdate={interactionProps.onUpdate}
      />
    );
  }
  return (
    <BrushOverlay
      interactionProps={interactionProps}
      canvasW={canvasW} canvasH={canvasH} zoom={zoom}
    />
  );
}
