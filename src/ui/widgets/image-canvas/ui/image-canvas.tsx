import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { WebGLRenderer } from '../../../features/develop/lib/webgl-renderer';
import { useAdjustmentsStore } from '../../../features/develop/model/adjustments-store';

export interface ImageCanvasHandle {
  getExportDataUrl: (
    mimeType: string,
    quality: number,
    targetW?: number,
    targetH?: number,
  ) => string | null;
}

interface Props {
  dataUrl: string | null;
  onImageLoaded?: (w: number, h: number) => void;
}

export const ImageCanvas = forwardRef<ImageCanvasHandle, Props>(({ dataUrl, onImageLoaded }, ref) => {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const imageRef    = useRef<HTMLImageElement | null>(null);
  const adjustments = useAdjustmentsStore((s) => s.adjustments);

  useImperativeHandle(ref, () => ({
    getExportDataUrl: (mimeType, quality, targetW, targetH) => {
      const img = imageRef.current;
      if (!img) return null;
      return WebGLRenderer.exportDataUrl(
        img,
        useAdjustmentsStore.getState().adjustments,
        mimeType,
        quality,
        targetW,
        targetH,
      );
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current!;
    const renderer = new WebGLRenderer();
    try {
      renderer.init(canvas);
      rendererRef.current = renderer;
    } catch (err) {
      console.error('[WebGL] init failed:', err);
    }
    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!dataUrl || !rendererRef.current) return;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas || !rendererRef.current) return;
      onImageLoaded?.(img.naturalWidth, img.naturalHeight);
      const container = canvas.parentElement!;
      const cw = container.clientWidth  || 800;
      const ch = container.clientHeight || 600;
      const scale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight, 1);
      canvas.width  = Math.max(1, Math.round(img.naturalWidth  * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      try {
        rendererRef.current.loadImage(img);
        imageRef.current = img;
        rendererRef.current.render(canvas, useAdjustmentsStore.getState().adjustments);
      } catch (err) {
        console.error('[WebGL] render failed:', err);
      }
    };
    img.onerror = (e) => console.error('[ImageCanvas] failed to load image', e);
    img.src = dataUrl;
  }, [dataUrl, onImageLoaded]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rendererRef.current || !imageRef.current) return;
    try {
      rendererRef.current.render(canvas, adjustments);
    } catch (err) {
      console.error('[WebGL] render failed:', err);
    }
  }, [adjustments]);

  return (
    <div className="relative flex items-center justify-center w-full h-full">
      <canvas
        ref={canvasRef}
        className="block max-w-full max-h-full shadow-[0_4px_32px_rgba(0,0,0,0.6)]"
        style={{ display: dataUrl ? 'block' : 'none' }}
      />
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
});

ImageCanvas.displayName = 'ImageCanvas';
