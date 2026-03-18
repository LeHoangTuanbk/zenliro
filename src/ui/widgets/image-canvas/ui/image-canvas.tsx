import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { WebGLRenderer } from '../../../features/develop/lib/webgl-renderer';
import type { SpotGPUData } from '../../../features/develop/lib/webgl-renderer';
import { useAdjustmentsStore } from '../../../features/develop/model/adjustments-store';
import { HealEngine } from '../../../features/heal/lib/heal-engine';
import { HealOverlay } from '../../../features/heal/ui/heal-overlay';
import type { HealMode, HealSpot } from '../../../features/heal/model/types';

// ── EXIF / orientation helpers ─────────────────────────────────────────────────

/** Parse EXIF orientation from the first 64 KB of a JPEG ArrayBuffer. */
function readExifOrientationFromBuffer(buf: ArrayBuffer): number {
  try {
    const view = new DataView(buf);
    const len  = Math.min(buf.byteLength, 65536);
    let off = 2; // skip SOI marker
    while (off + 4 < len) {
      if (view.getUint8(off) !== 0xFF) break;
      const marker = view.getUint8(off + 1);
      const segLen = view.getUint16(off + 2);
      if (marker === 0xE1 && segLen >= 8) {
        // Check "Exif\0\0"
        if (view.getUint32(off + 4) === 0x45786966 && view.getUint16(off + 8) === 0) {
          const tiff = off + 10;
          const le   = view.getUint8(tiff) === 0x49;
          const ifdOff  = view.getUint32(tiff + 4, le);
          const entries = view.getUint16(tiff + ifdOff, le);
          for (let i = 0; i < entries; i++) {
            const ep  = tiff + ifdOff + 2 + i * 12;
            const tag = view.getUint16(ep, le);
            if (tag === 0x0112) return view.getUint16(ep + 8, le);
          }
        }
      }
      off += 2 + segLen;
    }
  } catch { /* ignore */ }
  return 1;
}

/**
 * Draw an ImageBitmap onto `ctx` applying the EXIF orientation transform.
 * Canvas dimensions are set here (swapped for 90°/270°).
 * Returns the corrected { w, h }.
 */
function drawBitmapWithOrientation(
  ctx: CanvasRenderingContext2D,
  bmp: ImageBitmap,
  orientation: number,
): { w: number; h: number } {
  const bw = bmp.width;
  const bh = bmp.height;
  const swap = orientation >= 5 && orientation <= 8;
  const cw = swap ? bh : bw;
  const ch = swap ? bw : bh;
  ctx.canvas.width  = cw;
  ctx.canvas.height = ch;
  ctx.save();
  switch (orientation) {
    case 2: ctx.transform(-1, 0,  0,  1,  bw,  0); break;
    case 3: ctx.transform(-1, 0,  0, -1,  bw, bh); break;
    case 4: ctx.transform( 1, 0,  0, -1,   0, bh); break;
    case 5: ctx.transform( 0, 1,  1,  0,   0,  0); break;
    case 6: ctx.transform( 0, 1, -1,  0,  bh,  0); break;
    case 7: ctx.transform( 0,-1, -1,  0,  bh, bw); break;
    case 8: ctx.transform( 0,-1,  1,  0,   0, bw); break;
  }
  ctx.drawImage(bmp, 0, 0);
  ctx.restore();
  return { w: cw, h: ch };
}

/** Convert a data-URL to an ArrayBuffer (sync, slices first 64 KB). */
function dataUrlToPartialBuffer(dataUrl: string): ArrayBuffer {
  const b64   = dataUrl.split(',')[1];
  // 64 KB binary → ceil(65536 * 4/3) base64 chars
  const slice = b64.slice(0, 87382);
  const bin   = atob(slice);
  const buf   = new ArrayBuffer(bin.length);
  const u8    = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return buf;
}

export interface ImageCanvasHandle {
  getExportDataUrl: (
    mimeType: string,
    quality: number,
    targetW?: number,
    targetH?: number,
  ) => string | null;
}

export interface HealInteractionProps {
  spots: HealSpot[];
  selectedSpotId: string | null;
  brushSizePx: number;   // brush radius in screen pixels
  activeMode: HealMode;
  feather: number;
  opacity: number;
  onSpotAdded: (spot: HealSpot) => void;
  onMoveSpotDst: (id: string, normX: number, normY: number) => void;
  onMoveSpotSrc: (id: string, normX: number, normY: number) => void;
  onSelectSpot: (id: string | null) => void;
  onDeleteSpot: (id: string) => void;
  onBrushSizeChange: (px: number) => void;
}

interface Props {
  dataUrl: string | null;
  healSpots?: HealSpot[];
  healInteractionProps?: HealInteractionProps;
  hideOverlay?: boolean;
  onImageLoaded?: (w: number, h: number) => void;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 16;

export const ImageCanvas = forwardRef<ImageCanvasHandle, Props>(
  ({ dataUrl, healSpots = [], healInteractionProps, hideOverlay = false, onImageLoaded }, ref) => {
    const containerRef   = useRef<HTMLDivElement>(null);
    const canvasRef      = useRef<HTMLCanvasElement>(null);
    const rendererRef    = useRef<WebGLRenderer | null>(null);
    const originalImgRef = useRef<HTMLCanvasElement | null>(null);
    const imageDataRef   = useRef<ImageData | null>(null);  // cached full-res pixel data
    const gpuSpotsRef    = useRef<SpotGPUData[]>([]);        // latest computed GPU data
    const [canvasDims, setCanvasDims] = useState({ w: 0, h: 0 });
    const adjustments = useAdjustmentsStore((s) => s.adjustments);

    // ── View state (zoom + pan) ────────────────────────────────────────────
    const [zoom, setZoom]       = useState(1);
    const [pan, setPan]         = useState({ x: 0, y: 0 });
    const [isSpaceDown, setIsSpaceDown] = useState(false);
    const [isPanning, setIsPanning]     = useState(false);
    const isSpaceDownRef = useRef(false);
    const panStartRef    = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
    // Keep latest zoom/pan in refs so event handler closures stay fresh
    const zoomRef = useRef(zoom);
    const panRef  = useRef(pan);
    useEffect(() => { zoomRef.current = zoom; }, [zoom]);
    useEffect(() => { panRef.current  = pan;  }, [pan]);

    // ── Export ─────────────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      getExportDataUrl: (mimeType, quality, targetW, targetH) => {
        const img = originalImgRef.current;
        if (!img) return null;
        const adj = useAdjustmentsStore.getState().adjustments;
        return WebGLRenderer.exportDataUrl(img, adj, mimeType, quality, targetW, targetH, gpuSpotsRef.current);
      },
    }));

    // ── Helpers ────────────────────────────────────────────────────────────
    function renderToCanvas() {
      const canvas   = canvasRef.current;
      const renderer = rendererRef.current;
      const img      = originalImgRef.current;
      if (!canvas || !renderer || !img) return;
      try {
        renderer.render(canvas, useAdjustmentsStore.getState().adjustments);
      } catch (err) {
        console.error('[ImageCanvas] render error:', err);
      }
    }

    function computeAndUploadSpots(spots: HealSpot[]) {
      const renderer = rendererRef.current;
      const imgData  = imageDataRef.current;
      const src      = originalImgRef.current;
      if (!renderer || !imgData || !src) return;

      const w = src.width;
      const h = src.height;

      const gpuData: SpotGPUData[] = spots.map((spot) => ({
        dst: spot.dst,
        src: spot.src,
        radius: spot.radius,
        feather: spot.feather / 100,
        opacity: spot.opacity / 100,
        mode: (spot.mode === 'heal' ? 0 : spot.mode === 'clone' ? 1 : 2) as 0 | 1 | 2,
        colorData: HealEngine.precomputeColorData(imgData.data, spot, w, h),
      }));

      gpuSpotsRef.current = gpuData;
      renderer.setHealSpots(gpuData);
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
      let cancelled = false;

      (async () => {
        try {
          // Parse EXIF from raw bytes — before any browser auto-correction
          const exifBuf    = dataUrlToPartialBuffer(dataUrl);
          const orientation = readExifOrientationFromBuffer(exifBuf);

          // createImageBitmap with imageOrientation:'none' gives us raw pixels
          // with NO browser-applied EXIF rotation — we apply it ourselves below.
          const mimeType = dataUrl.split(';')[0].slice(5) || 'image/jpeg';
          const b64  = dataUrl.split(',')[1];
          const bin  = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const blob = new Blob([bytes], { type: mimeType });
          const bmp  = await createImageBitmap(blob, { imageOrientation: 'none' });

          if (cancelled) { bmp.close(); return; }

          const canvas    = canvasRef.current;
          const container = containerRef.current;
          if (!canvas || !container || !rendererRef.current) { bmp.close(); return; }

          // Draw with EXIF correction onto a temp canvas
          const tmp   = document.createElement('canvas');
          const ctx2d = tmp.getContext('2d')!;
          const { w: imgW, h: imgH } = drawBitmapWithOrientation(ctx2d, bmp, orientation);
          bmp.close();

          onImageLoaded?.(imgW, imgH);

          const cw = container.clientWidth  || 800;
          const ch = container.clientHeight || 600;
          const scale = Math.min(cw / imgW, ch / imgH, 1);
          canvas.width  = Math.max(1, Math.round(imgW * scale));
          canvas.height = Math.max(1, Math.round(imgH * scale));
          setCanvasDims({ w: canvas.width, h: canvas.height });

          setZoom(1);
          setPan({ x: 0, y: 0 });

          imageDataRef.current  = ctx2d.getImageData(0, 0, imgW, imgH);
          originalImgRef.current = tmp;
          gpuSpotsRef.current   = [];

          rendererRef.current!.loadImage(tmp);
          rendererRef.current!.setHealSpots([]);
          computeAndUploadSpots(healSpots);
          renderToCanvas();
        } catch (err) {
          console.error('[ImageCanvas] load error:', err);
        }
      })();

      return () => { cancelled = true; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dataUrl]);

    // ── Re-apply heal ──────────────────────────────────────────────────────
    useEffect(() => {
      computeAndUploadSpots(healSpots);
      renderToCanvas();
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

    // ── Zoom: Cmd/Ctrl + scroll ────────────────────────────────────────────
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const onWheel = (e: WheelEvent) => {
        if (!e.metaKey && !e.ctrlKey) return;
        e.preventDefault();

        const rect = container.getBoundingClientRect();
        // Mouse offset from container center (the natural anchor of the flex layout)
        const Dx = e.clientX - rect.left  - rect.width  / 2;
        const Dy = e.clientY - rect.top   - rect.height / 2;

        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        const oldZoom = zoomRef.current;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * factor));
        const ratio   = newZoom / oldZoom;

        setZoom(newZoom);
        setPan((p) => ({
          x: Dx * (1 - ratio) + p.x * ratio,
          y: Dy * (1 - ratio) + p.y * ratio,
        }));
      };

      container.addEventListener('wheel', onWheel, { passive: false });
      return () => container.removeEventListener('wheel', onWheel);
    }, []);

    // ── Space key: hand/pan tool ───────────────────────────────────────────
    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        // Don't hijack space when typing in an input
        if ((e.target as HTMLElement).tagName === 'INPUT') return;

        if (e.code === 'Space' && !e.repeat) {
          e.preventDefault();
          isSpaceDownRef.current = true;
          setIsSpaceDown(true);
        }
        // Cmd+0: reset zoom
        if ((e.metaKey || e.ctrlKey) && e.key === '0') {
          e.preventDefault();
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }
      };
      const onKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
          isSpaceDownRef.current = false;
          setIsSpaceDown(false);
          panStartRef.current = null;
          setIsPanning(false);
        }
      };

      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup',   onKeyUp);
      return () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup',   onKeyUp);
      };
    }, []);

    // ── Pan: window-level mouse move/up ───────────────────────────────────
    useEffect(() => {
      const onMove = (e: MouseEvent) => {
        const start = panStartRef.current;
        if (!start) return;
        setPan({ x: start.px + (e.clientX - start.mx), y: start.py + (e.clientY - start.my) });
      };
      const onUp = () => {
        if (panStartRef.current) {
          panStartRef.current = null;
          setIsPanning(false);
        }
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup',   onUp);
      return () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup',   onUp);
      };
    }, []);

    const handleContainerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isSpaceDownRef.current || e.button !== 0) return;
      e.preventDefault();
      panStartRef.current = { mx: e.clientX, my: e.clientY, px: panRef.current.x, py: panRef.current.y };
      setIsPanning(true);
    };

    // ── Heal overlay: add-spot with auto-source ────────────────────────────
    const handleOverlayAddSpot = useCallback(
      (normX: number, normY: number) => {
        if (!healInteractionProps) return;
        const src     = originalImgRef.current;
        const imgData = imageDataRef.current;
        if (!src || !imgData) return;

        const { brushSizePx, activeMode, feather, opacity, onSpotAdded } = healInteractionProps;
        const w = src.width;
        const h = src.height;
        // brushSizePx is in screen pixels; convert to image-normalized radius
        const storedBrushRadius = brushSizePx / (canvasDims.w * zoomRef.current);
        const radiusPx = Math.max(1, Math.round(storedBrushRadius * w));
        const pixX = Math.round(normX * w);
        const pixY = Math.round(normY * h);

        // Use cached imageData — no more drawImage/getImageData here!
        const srcPx = HealEngine.autoFindSource(imgData.data, pixX, pixY, radiusPx, w, h);

        onSpotAdded({
          id: crypto.randomUUID(),
          mode: activeMode,
          dst: { x: normX, y: normY },
          src: { x: srcPx.x / w, y: srcPx.y / h },
          radius: storedBrushRadius,
          feather,
          opacity,
        });
      },
      [healInteractionProps],
    );

    const showHeal = !!healInteractionProps && canvasDims.w > 0 && !hideOverlay;

    // Cursor for the container
    const containerCursor = isPanning ? 'grabbing' : isSpaceDown ? 'grab' : 'default';

    return (
      <div
        ref={containerRef}
        className="relative flex items-center justify-center w-full h-full overflow-hidden"
        style={{ cursor: containerCursor }}
        onMouseDown={handleContainerMouseDown}
      >
        {/* Inner wrapper: zoom + pan applied here */}
        <div
          className="relative shadow-[0_4px_32px_rgba(0,0,0,0.6)]"
          style={{
            width:           canvasDims.w || undefined,
            height:          canvasDims.h || undefined,
            display:         dataUrl ? 'block' : 'none',
            transform:       `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            willChange:      'transform',
          }}
        >
          <canvas ref={canvasRef} className="block" />

          {showHeal && (
            <HealOverlay
              canvasWidth={canvasDims.w}
              canvasHeight={canvasDims.h}
              spots={healInteractionProps!.spots}
              selectedSpotId={healInteractionProps!.selectedSpotId}
              brushSizePx={healInteractionProps!.brushSizePx}
              zoom={zoom}
              activeMode={healInteractionProps!.activeMode}
              onAddSpot={handleOverlayAddSpot}
              onMoveSpotDst={healInteractionProps!.onMoveSpotDst}
              onMoveSpotSrc={healInteractionProps!.onMoveSpotSrc}
              onSelectSpot={healInteractionProps!.onSelectSpot}
              onDeleteSpot={healInteractionProps!.onDeleteSpot}
              onBrushSizeChange={healInteractionProps!.onBrushSizeChange}
              // Disable overlay interactions while panning
              style={isSpaceDown ? { pointerEvents: 'none' } : undefined}
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
