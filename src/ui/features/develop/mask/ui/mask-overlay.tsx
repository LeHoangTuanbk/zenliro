import { useEffect, useRef, useState } from 'react';
import type { MaskInteractionProps } from '@widgets/image-canvas/store/types';
import type { BrushStroke, BrushPoint } from '../store/types';
import { useMaskStore } from '../store/mask-store';
import { LinearMaskOverlay } from './linear-mask-overlay';
import { RadialMaskOverlay } from './radial-mask-overlay';

type Props = {
  interactionProps: MaskInteractionProps;
  canvasW: number;
  canvasH: number;
  zoom: number;
  /**
   * When true, the overlay's interactive layer becomes `pointer-events: none`
   * so that space-drag (pan) and wheel-zoom can pass through to the image
   * container. Matches how the heal and crop overlays behave.
   */
  disableInteraction?: boolean;
};

// ── Brush painting helpers ────────────────────────────────────────────────────

function paintDotOnCtx(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  sizePx: number,
  feather: number,
  opacity: number,
  erase: boolean,
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
  // Skip redrawing the opening dot of a stroke when it coincides with the
  // closing dot of the previous stroke. Each mousemove emits a new 2-point
  // stroke [prev, cur], and `source-over` compositing stacks alpha at the
  // shared endpoint — visible as a bumpy seam at every joint.
  let lastPt: BrushPoint | null = null;
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    const sizePx = stroke.size * canvasW;
    for (let i = 0; i < stroke.points.length; i++) {
      const p = stroke.points[i];
      const px = p.x * canvasW,
        py = p.y * canvasH;
      const skipDot = i === 0 && lastPt !== null && lastPt.x === p.x && lastPt.y === p.y;
      if (!skipDot) {
        paintDotOnCtx(ctx, px, py, sizePx, stroke.feather, stroke.opacity, stroke.erase);
      }
      if (i > 0) {
        const prev = stroke.points[i - 1];
        const ppx = prev.x * canvasW,
          ppy = prev.y * canvasH;
        const dist = Math.hypot(px - ppx, py - ppy);
        const steps = Math.max(1, Math.floor(dist / (sizePx * 0.2)));
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          paintDotOnCtx(
            ctx,
            ppx + (px - ppx) * t,
            ppy + (py - ppy) * t,
            sizePx,
            stroke.feather,
            stroke.opacity,
            stroke.erase,
          );
        }
      }
    }
    lastPt = stroke.points[stroke.points.length - 1];
  }
  ctx.restore();
}

// ── Brush overlay ─────────────────────────────────────────────────────────────

function BrushOverlay({
  interactionProps,
  canvasW,
  canvasH,
  zoom,
  disableInteraction,
}: {
  interactionProps: Extract<MaskInteractionProps, { maskType: 'brush' }>;
  canvasW: number;
  canvasH: number;
  zoom: number;
  disableInteraction?: boolean;
}) {
  const strokesRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<BrushPoint | null>(null);
  const prevStrokesLenRef = useRef(0);
  // React state so the strokes canvas re-renders with the right opacity while
  // the user is actively painting (overlay toggle may be off).
  const [isPainting, setIsPainting] = useState(false);

  const showMaskOverlay = useMaskStore((s) => s.showMaskOverlay);

  const {
    selectedMaskId,
    brushSizePx,
    brushFeather,
    brushOpacity,
    brushErase,
    strokes,
    onStrokeAdded,
    onBrushSizeChange,
  } = interactionProps;

  // Full redraw — needed whenever intrinsic bitmap size changes (selectedMaskId,
  // canvas dims, OR zoom because we size the bitmap as canvasW*zoom and changing
  // the width attribute resets the bitmap).
  useEffect(() => {
    const canvas = strokesRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(zoom, 0, 0, zoom, 0, 0);
    ctx.clearRect(0, 0, canvasW, canvasH);
    drawStrokesOnCtx(ctx, strokes, canvasW, canvasH);
    prevStrokesLenRef.current = strokes.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMaskId, canvasW, canvasH, zoom]);

  useEffect(() => {
    const canvas = strokesRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(zoom, 0, 0, zoom, 0, 0);
    if (strokes.length < prevStrokesLenRef.current) {
      ctx.clearRect(0, 0, canvasW, canvasH);
      drawStrokesOnCtx(ctx, strokes, canvasW, canvasH);
      prevStrokesLenRef.current = strokes.length;
    } else if (strokes.length > prevStrokesLenRef.current) {
      drawStrokesOnCtx(ctx, strokes.slice(prevStrokesLenRef.current), canvasW, canvasH);
      prevStrokesLenRef.current = strokes.length;
    }
  }, [strokes, canvasW, canvasH, zoom]);

  // Clear the cursor ring on window blur so an alt-tab / focus loss doesn't
  // leave a stale ring frozen over the mask.
  useEffect(() => {
    const onBlur = () => {
      const c = cursorRef.current;
      if (c) {
        const ctx = c.getContext('2d')!;
        ctx.setTransform(zoom, 0, 0, zoom, 0, 0);
        ctx.clearRect(0, 0, canvasW, canvasH);
      }
      isDrawingRef.current = false;
      lastPointRef.current = null;
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [canvasW, canvasH, zoom]);

  const canvasToNorm = (cx: number, cy: number): BrushPoint => ({
    x: cx / canvasW,
    y: cy / canvasH,
  });
  const makeStroke = (points: BrushPoint[]): BrushStroke => ({
    points,
    size: brushSizePx / zoom / canvasW,
    feather: brushFeather / 100,
    opacity: brushOpacity / 100,
    erase: brushErase,
  });

  // Convert a mouse event to the cursor canvas's intrinsic pixel coords.
  // Using getBoundingClientRect + clientX/Y is transform-safe at any zoom level;
  // offsetX/Y is inconsistent across browsers when the parent uses CSS scale().
  const eventToCanvas = (e: React.MouseEvent) => {
    const canvas = cursorRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    const x = ((e.clientX - rect.left) / rect.width) * canvasW;
    const y = ((e.clientY - rect.top) / rect.height) * canvasH;
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    isDrawingRef.current = true;
    setIsPainting(true);
    const p = eventToCanvas(e);
    const norm = canvasToNorm(p.x, p.y);
    lastPointRef.current = norm;
    onStrokeAdded(makeStroke([norm]));
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const { x, y } = eventToCanvas(e);
    const cursorCanvas = cursorRef.current;
    if (cursorCanvas) {
      const ctx = cursorCanvas.getContext('2d')!;
      // Match the stroke canvas: bitmap is canvasW*zoom, so pre-transform by
      // zoom to keep drawing coords in the logical canvasW space.
      ctx.setTransform(zoom, 0, 0, zoom, 0, 0);
      ctx.clearRect(0, 0, canvasW, canvasH);
      const r = Math.max(0.5, brushSizePx / (2 * zoom));
      const lw = 1.5 / zoom;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.strokeStyle = brushErase ? 'rgba(255,80,80,0.9)' : 'rgba(255,255,255,0.9)';
      ctx.lineWidth = lw;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = lw / 3;
      ctx.stroke();
    }
    if (!isDrawingRef.current) return;
    const norm = canvasToNorm(x, y);
    const prev = lastPointRef.current;
    lastPointRef.current = norm;
    onStrokeAdded(makeStroke(prev ? [prev, norm] : [norm]));
  };

  const clearCursor = () => {
    const c = cursorRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(zoom, 0, 0, zoom, 0, 0);
    ctx.clearRect(0, 0, canvasW, canvasH);
  };

  const handleMouseLeave = () => {
    clearCursor();
    isDrawingRef.current = false;
    setIsPainting(false);
    lastPointRef.current = null;
  };

  const handleMouseUp = () => {
    clearCursor();
    isDrawingRef.current = false;
    setIsPainting(false);
    lastPointRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    onBrushSizeChange(Math.max(5, Math.min(300, brushSizePx + (e.deltaY > 0 ? -5 : 5))));
  };

  // Bitmap is sized to display resolution so the ring and strokes stay crisp
  // when the parent CSS scale(zoom) stretches the canvas up. CSS size stays at
  // canvasW × canvasH via `absolute inset-0` so the parent transform handles
  // the on-screen scaling.
  const bitmapW = Math.round(canvasW * zoom);
  const bitmapH = Math.round(canvasH * zoom);

  // Strokes are only shown when the user explicitly wants the overlay or is
  // actively painting (so there's still real-time feedback during the stroke).
  // When hidden, the mask still affects the image through the GPU shader path —
  // the red preview just disappears.
  const showStrokes = showMaskOverlay || isPainting;

  return (
    <>
      <canvas
        ref={strokesRef}
        width={bitmapW}
        height={bitmapH}
        className="absolute inset-0 pointer-events-none"
        style={{
          width: canvasW,
          height: canvasH,
          opacity: showStrokes ? 1 : 0,
          transition: 'opacity 120ms ease',
        }}
      />
      <canvas
        ref={cursorRef}
        width={bitmapW}
        height={bitmapH}
        className="absolute inset-0"
        style={{
          width: canvasW,
          height: canvasH,
          cursor: disableInteraction ? undefined : 'none',
          pointerEvents: disableInteraction ? 'none' : 'auto',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      />
    </>
  );
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

export function MaskOverlay({
  interactionProps,
  canvasW,
  canvasH,
  zoom,
  disableInteraction,
}: Props) {
  if (interactionProps.maskType === 'linear') {
    return (
      <LinearMaskOverlay
        data={interactionProps.linearData}
        canvasW={canvasW}
        canvasH={canvasH}
        onUpdate={interactionProps.onUpdate}
        disableInteraction={disableInteraction}
      />
    );
  }
  if (interactionProps.maskType === 'radial') {
    return (
      <RadialMaskOverlay
        data={interactionProps.radialData}
        canvasW={canvasW}
        canvasH={canvasH}
        onUpdate={interactionProps.onUpdate}
        disableInteraction={disableInteraction}
      />
    );
  }
  return (
    <BrushOverlay
      interactionProps={interactionProps}
      canvasW={canvasW}
      canvasH={canvasH}
      zoom={zoom}
      disableInteraction={disableInteraction}
    />
  );
}
