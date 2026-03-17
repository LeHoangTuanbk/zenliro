import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { WebGLRenderer } from '../../../features/develop/lib/webgl-renderer';
import { useAdjustmentsStore } from '../../../features/develop/model/adjustments-store';
import { HealEngine } from '../../../features/heal/lib/heal-engine';
import { HealOverlay } from '../../../features/heal/ui/heal-overlay';
import type { HealSpot } from '../../../features/heal/model/types';

export interface ImageCanvasHandle {
  getExportDataUrl: (
    mimeType: string,
    quality: number,
    targetW?: number,
    targetH?: number,
  ) => string | null;
}

/**
 * Props from App when the heal tool is active.
 * onMoveSpotDst / onMoveSpotSrc / onSelectSpot / onDeleteSpot / onBrushRadiusChange
 * are passed straight through to HealOverlay.
 * onSpotAdded is called by ImageCanvas after it computes the auto-source.
 */
export interface HealInteractionProps {
  spots: HealSpot[];
  selectedSpotId: string | null;
  brushRadius: number;
  activeMode: 'heal' | 'clone';
  feather: number;
  opacity: number;
  onSpotAdded: (spot: HealSpot) => void;
  onMoveSpotDst: (id: string, normX: number, normY: number) => void;
  onMoveSpotSrc: (id: string, normX: number, normY: number) => void;
  onSelectSpot: (id: string | null) => void;
  onDeleteSpot: (id: string) => void;
  onBrushRadiusChange: (r: number) => void;
}

interface Props {
  dataUrl: string | null;
  /** Heal spots always applied to WebGL input — even when not in heal tool mode. */
  healSpots?: HealSpot[];
  /** If set, shows the interactive heal overlay. */
  healInteractionProps?: HealInteractionProps;
  onImageLoaded?: (w: number, h: number) => void;
}

export const ImageCanvas = forwardRef<ImageCanvasHandle, Props>(
  ({ dataUrl, healSpots = [], healInteractionProps, onImageLoaded }, ref) => {
    const containerRef   = useRef<HTMLDivElement>(null);
    const canvasRef      = useRef<HTMLCanvasElement>(null);
    const rendererRef    = useRef<WebGLRenderer | null>(null);
    const originalImgRef = useRef<HTMLImageElement | null>(null);
    const offscreenRef   = useRef<HTMLCanvasElement | null>(null);
    const [canvasDims, setCanvasDims] = useState({ w: 0, h: 0 });
    const adjustments = useAdjustmentsStore((s) => s.adjustments);

    // ── Export ─────────────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      getExportDataUrl: (mimeType, quality, targetW, targetH) => {
        const img = originalImgRef.current;
        if (!img) return null;
        const adj = useAdjustmentsStore.getState().adjustments;
        const source = healSpots.length > 0 ? buildOffscreen(img, healSpots) : img;
        return WebGLRenderer.exportDataUrl(source, adj, mimeType, quality, targetW, targetH);
      },
    }));

    // ── Helpers ────────────────────────────────────────────────────────────
    function buildOffscreen(img: HTMLImageElement, spots: HealSpot[]): HTMLCanvasElement {
      if (!offscreenRef.current) offscreenRef.current = document.createElement('canvas');
      const off = offscreenRef.current;
      off.width  = img.naturalWidth;
      off.height = img.naturalHeight;
      const ctx = off.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const healed = HealEngine.applySpots(
        ctx.getImageData(0, 0, off.width, off.height),
        spots,
      );
      ctx.putImageData(healed, 0, 0);
      return off;
    }

    function renderToCanvas(img: HTMLImageElement, spots: HealSpot[]) {
      const canvas   = canvasRef.current;
      const renderer = rendererRef.current;
      if (!canvas || !renderer) return;
      try {
        const source = spots.length > 0 ? buildOffscreen(img, spots) : img;
        renderer.loadImage(source);
        renderer.render(canvas, useAdjustmentsStore.getState().adjustments);
      } catch (err) {
        console.error('[ImageCanvas] render error:', err);
      }
    }

    // ── Init WebGL ─────────────────────────────────────────────────────────
    useEffect(() => {
      const canvas   = canvasRef.current!;
      const renderer = new WebGLRenderer();
      try {
        renderer.init(canvas);
        rendererRef.current = renderer;
      } catch (err) {
        console.error('[WebGL] init failed:', err);
      }
      return () => { renderer.dispose(); rendererRef.current = null; };
    }, []);

    // ── Load image ─────────────────────────────────────────────────────────
    useEffect(() => {
      if (!dataUrl || !rendererRef.current) return;
      const img = new Image();
      img.onload = () => {
        const canvas    = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        onImageLoaded?.(img.naturalWidth, img.naturalHeight);
        originalImgRef.current = img;

        const cw = container.clientWidth  || 800;
        const ch = container.clientHeight || 600;
        const scale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight, 1);
        canvas.width  = Math.max(1, Math.round(img.naturalWidth  * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        setCanvasDims({ w: canvas.width, h: canvas.height });

        renderToCanvas(img, healSpots);
      };
      img.onerror = (e) => console.error('[ImageCanvas] image load error', e);
      img.src = dataUrl;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dataUrl]);

    // ── Re-apply heal when spots change ───────────────────────────────────
    useEffect(() => {
      const img = originalImgRef.current;
      if (!img) return;
      renderToCanvas(img, healSpots);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [healSpots]);

    // ── Re-render develop adjustments ──────────────────────────────────────
    useEffect(() => {
      const canvas   = canvasRef.current;
      const renderer = rendererRef.current;
      if (!canvas || !renderer) return;
      try { renderer.render(canvas, adjustments); }
      catch (err) { console.error('[WebGL] render failed:', err); }
    }, [adjustments]);

    // ── Heal overlay: add-spot with auto-source ────────────────────────────
    const handleOverlayAddSpot = useCallback(
      (normX: number, normY: number) => {
        if (!healInteractionProps) return;
        const img = originalImgRef.current;
        if (!img) return;

        const { brushRadius, activeMode, feather, opacity, onSpotAdded } = healInteractionProps;
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const radiusPx = Math.max(1, Math.round(brushRadius * w));
        const pixX = Math.round(normX * w);
        const pixY = Math.round(normY * h);

        // Sample image data for auto-source (uses a temp canvas)
        const temp = document.createElement('canvas');
        temp.width = w; temp.height = h;
        const ctx = temp.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, w, h);
        const srcPx = HealEngine.autoFindSource(data.data, pixX, pixY, radiusPx, w, h);

        const spot: HealSpot = {
          id: crypto.randomUUID(),
          mode: activeMode,
          dst: { x: normX, y: normY },
          src: { x: srcPx.x / w, y: srcPx.y / h },
          radius: brushRadius,
          feather,
          opacity,
        };

        onSpotAdded(spot);
      },
      [healInteractionProps],
    );

    const showHeal = !!healInteractionProps && canvasDims.w > 0;

    return (
      <div ref={containerRef} className="relative flex items-center justify-center w-full h-full">
        {/* Wrapper sized to canvas display dimensions so overlay aligns exactly */}
        <div
          className="relative shadow-[0_4px_32px_rgba(0,0,0,0.6)]"
          style={{
            width:   canvasDims.w || undefined,
            height:  canvasDims.h || undefined,
            display: dataUrl ? 'block' : 'none',
          }}
        >
          <canvas ref={canvasRef} className="block" />

          {showHeal && (
            <HealOverlay
              canvasWidth={canvasDims.w}
              canvasHeight={canvasDims.h}
              spots={healInteractionProps!.spots}
              selectedSpotId={healInteractionProps!.selectedSpotId}
              brushRadius={healInteractionProps!.brushRadius}
              activeMode={healInteractionProps!.activeMode}
              onAddSpot={handleOverlayAddSpot}
              onMoveSpotDst={healInteractionProps!.onMoveSpotDst}
              onMoveSpotSrc={healInteractionProps!.onMoveSpotSrc}
              onSelectSpot={healInteractionProps!.onSelectSpot}
              onDeleteSpot={healInteractionProps!.onDeleteSpot}
              onBrushRadiusChange={healInteractionProps!.onBrushRadiusChange}
            />
          )}
        </div>

        {!dataUrl && (
          <div className="flex flex-col items-center gap-3 text-[#505050] select-none">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <p className="text-[12px]">Import a photo to get started</p>
          </div>
        )}
      </div>
    );
  },
);

ImageCanvas.displayName = 'ImageCanvas';
