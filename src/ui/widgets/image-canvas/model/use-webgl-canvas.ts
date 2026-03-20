import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ForwardedRef, RefObject } from 'react';
import { type SpotGPUData, type MaskGPUData, WebGLRenderer } from '@shared/lib/webgl';
import { useAdjustmentsStore } from '@/features/develop/edit';
import { type Mask } from '@/features/develop/mask';
import { type HealSpot, HealEngine } from '@/features/develop/heal';
import { useToneCurveStore } from '@/features/develop/edit/tone-curve';
import { generateLUT, combineLUTs } from '@/features/develop/edit/tone-curve';
import { useColorMixerStore } from '@/features/develop/edit/color-mixer';
import type { HslChannel } from '@/features/develop/edit/color-mixer';
import { useColorGradingStore } from '@/features/develop/edit/color-grading';
import { useEffectsStore } from '@/features/develop/edit/effects';
import {
  arrayBufferToBlob,
  dataUrlToBlob,
  dataUrlToArrayBuffer,
  drawBitmapWithOrientation,
  readExifOrientation,
} from '../lib/image-utils';
import type { CropInteractionProps, HealInteractionProps, ImageCanvasHandle } from '../store/types';
import type { CropState } from '@/features/develop/crop';

type Params = {
  photoId?: string | null;
  dataUrl: string | null;
  imageBuffer?: ArrayBuffer | null;
  imageMimeType?: string | null;
  orientation?: number;
  masks: Mask[];
  healSpots: HealSpot[];
  healInteractionProps?: HealInteractionProps;
  cropInteractionProps?: CropInteractionProps;
  confirmedCropState?: CropState | null;
  onImageLoaded?: (w: number, h: number) => void;
  onImageRendered?: () => void;
  containerRef: RefObject<HTMLElement | null>;
  zoomRef: RefObject<number>;
  onResetView: () => void;
};

export function useWebGLCanvas(ref: ForwardedRef<ImageCanvasHandle>, params: Params) {
  const {
    photoId,
    dataUrl,
    imageBuffer,
    imageMimeType,
    orientation: precomputedOrientation,
    masks,
    healSpots,
    healInteractionProps,
    cropInteractionProps,
    confirmedCropState,
    onImageLoaded,
    onImageRendered,
    containerRef,
    zoomRef,
    onResetView,
  } = params;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const originalImgRef = useRef<HTMLCanvasElement | null>(null);
  const imageDataRef = useRef<ImageData | null>(null);
  const decodedImageCacheRef = useRef<Map<string, {
    canvas: HTMLCanvasElement;
    imageData: ImageData;
    width: number;
    height: number;
  }>>(new Map());
  const gpuSpotsRef = useRef<SpotGPUData[]>([]);
  const uploadedStrokesRef = useRef<Map<string, number>>(new Map()); // maskId → count uploaded
  const prevSlotMaskIdsRef = useRef<(string | null)[]>([null, null, null, null]);
  const [canvasDims, setCanvasDims] = useState({ w: 0, h: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const adjustments = useAdjustmentsStore((s) => s.adjustments);
  const toneCurvePoints = useToneCurveStore((s) => s.points);
  const toneCurveParametric = useToneCurveStore((s) => s.parametric);
  const colorMixerHue = useColorMixerStore((s) => s.hue);
  const colorMixerSat = useColorMixerStore((s) => s.saturation);
  const colorMixerLum = useColorMixerStore((s) => s.luminance);
  const cgShadows = useColorGradingStore((s) => s.shadows);
  const cgMidtones = useColorGradingStore((s) => s.midtones);
  const cgHighlights = useColorGradingStore((s) => s.highlights);
  const cgBlending = useColorGradingStore((s) => s.blending);
  const cgBalance = useColorGradingStore((s) => s.balance);
  const effects = useEffectsStore();

  // ── Export handle ────────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    getExportDataUrl: (mimeType, quality, targetW, targetH, crop) => {
      const img = originalImgRef.current;
      if (!img) return null;
      return WebGLRenderer.exportDataUrl(
        img,
        useAdjustmentsStore.getState().adjustments,
        mimeType,
        quality,
        targetW,
        targetH,
        gpuSpotsRef.current,
        crop,
      );
    },
    getRenderedPixels: () => rendererRef.current?.readCurrentPixels() ?? null,
  }));

  const renderToCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer || !originalImgRef.current) return;
    try {
      renderer.render(canvas, useAdjustmentsStore.getState().adjustments);
    } catch (err) {
      console.error('[ImageCanvas] render error:', err);
    }
  }, []);

  function computeAndUploadSpots(spots: HealSpot[]) {
    const renderer = rendererRef.current;
    const imgData = imageDataRef.current;
    const src = originalImgRef.current;
    if (!renderer || !imgData || !src) return;
    const { width: w, height: h } = src;
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

  function rememberDecodedImage(
    key: string,
    canvas: HTMLCanvasElement,
    imageData: ImageData,
    width: number,
    height: number,
  ) {
    const cache = decodedImageCacheRef.current;
    cache.delete(key);
    cache.set(key, { canvas, imageData, width, height });
    while (cache.size > 12) {
      const oldestKey = cache.keys().next().value;
      if (!oldestKey) break;
      cache.delete(oldestKey);
    }
  }

  function applyLoadedImage(
    sourceCanvas: HTMLCanvasElement,
    imageData: ImageData,
    imgW: number,
    imgH: number,
  ) {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !container || !renderer) return;

    onImageLoaded?.(imgW, imgH);

    const dpr = window.devicePixelRatio || 1;
    const cw = container.clientWidth || 800;
    const ch = container.clientHeight || 600;
    const scale = Math.min(cw / imgW, ch / imgH, 1);
    const cssW = Math.max(1, Math.round(imgW * scale));
    const cssH = Math.max(1, Math.round(imgH * scale));
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    setCanvasDims({ w: cssW, h: cssH });
    onResetView();

    imageDataRef.current = imageData;
    originalImgRef.current = sourceCanvas;
    gpuSpotsRef.current = [];

    renderer.loadImage(sourceCanvas);
    renderer.setHealSpots([]);
    computeAndUploadSpots(healSpots);
    renderToCanvas();
  }

  // ── Init WebGL ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current!;
    const renderer = new WebGLRenderer();
    try {
      renderer.init(canvas, { preserveDrawingBuffer: true });
      rendererRef.current = renderer;
    } catch (err) {
      console.error('[WebGL] init failed:', err);
    }
    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  // ── Load image ───────────────────────────────────────────────────────────
  useEffect(() => {
    if ((!dataUrl && !imageBuffer) || !rendererRef.current) return;
    const cacheKey = photoId ?? dataUrl ?? `${imageMimeType ?? 'image'}:${imageBuffer?.byteLength ?? 0}`;
    const cached = decodedImageCacheRef.current.get(cacheKey);
    if (cached) {
      applyLoadedImage(cached.canvas, cached.imageData, cached.width, cached.height);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const sourceBuffer = imageBuffer ?? dataUrlToArrayBuffer(dataUrl!);
        const orientation = precomputedOrientation ?? await readExifOrientation(sourceBuffer);
        const blob = imageBuffer
          ? arrayBufferToBlob(imageBuffer, imageMimeType ?? 'image/jpeg')
          : dataUrlToBlob(dataUrl!);
        const bmp = await createImageBitmap(blob, { imageOrientation: 'none' });

        if (cancelled) {
          bmp.close();
          return;
        }

        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container || !rendererRef.current) {
          bmp.close();
          return;
        }

        const tmp = document.createElement('canvas');
        const ctx2d = tmp.getContext('2d')!;
        const { w: imgW, h: imgH } = drawBitmapWithOrientation(ctx2d, bmp, orientation);
        bmp.close();

        const imageData = ctx2d.getImageData(0, 0, imgW, imgH);
        rememberDecodedImage(cacheKey, tmp, imageData, imgW, imgH);
        applyLoadedImage(tmp, imageData, imgW, imgH);
        if (!cancelled) setIsLoading(false);
      } catch (err) {
        console.error('[ImageCanvas] load error:', err);
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUrl, imageBuffer, imageMimeType, photoId]);

  useEffect(() => {
    computeAndUploadSpots(healSpots);
    renderToCanvas();
  }, [healSpots, renderToCanvas]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!renderer || !canvas || !container) return;

    // Determine effective dimensions for canvas sizing
    const cropState = cropInteractionProps?.cropState ?? confirmedCropState;
    const steps = cropState?.rotationSteps ?? 0;
    const swap = (steps % 2) !== 0;
    const imgW = renderer.imageWidth;
    const imgH = renderer.imageHeight;
    // In crop-editing mode: show full image. In confirmed mode: use cropped dims.
    const cropRect = (!cropInteractionProps && confirmedCropState) ? confirmedCropState.rect : null;
    const baseW = cropRect ? imgW * cropRect.w : imgW;
    const baseH = cropRect ? imgH * cropRect.h : imgH;
    const effectiveW = swap ? baseH : baseW;
    const effectiveH = swap ? baseW : baseH;

    // Resize canvas to fit rotated dimensions
    if (effectiveW > 0 && effectiveH > 0) {
      const dpr = window.devicePixelRatio || 1;
      const cw = container.clientWidth || 800;
      const ch = container.clientHeight || 600;
      const scale = Math.min(cw / effectiveW, ch / effectiveH, 1);
      const cssW = Math.max(1, Math.round(effectiveW * scale));
      const cssH = Math.max(1, Math.round(effectiveH * scale));
      const pxW = Math.round(cssW * dpr);
      const pxH = Math.round(cssH * dpr);
      if (canvas.width !== pxW || canvas.height !== pxH) {
        canvas.width = pxW;
        canvas.height = pxH;
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;
        setCanvasDims({ w: cssW, h: cssH });
      }
    }

    if (cropInteractionProps) {
      const cs = cropInteractionProps.cropState;
      const hasTransform = cs.flipH || cs.flipV || cs.rotationSteps !== 0 || cs.rotation !== 0;
      renderer.setCropState(hasTransform ? {
        ...cs,
        rect: { x: 0, y: 0, w: 1, h: 1 },
      } : null);
    } else {
      renderer.setCropState(confirmedCropState ?? null);
    }
    renderToCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmedCropState, cropInteractionProps, renderToCanvas]);

  useEffect(() => {
    if (!canvasRef.current || !rendererRef.current) return;
    renderToCanvas();
  }, [adjustments, renderToCanvas]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const { points } = useToneCurveStore.getState();
    const rgbLut = generateLUT(points.rgb);
    const rLut = combineLUTs(rgbLut, generateLUT(points.r));
    const gLut = combineLUTs(rgbLut, generateLUT(points.g));
    const bLut = combineLUTs(rgbLut, generateLUT(points.b));
    renderer.setToneCurveLUT(rLut, gLut, bLut);
    renderToCanvas();
  }, [renderToCanvas, toneCurveParametric, toneCurvePoints]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const channels: HslChannel[] = [
      'red',
      'orange',
      'yellow',
      'green',
      'aqua',
      'blue',
      'purple',
      'magenta',
    ];
    renderer.setColorMixer(
      channels.map((c) => colorMixerHue[c]),
      channels.map((c) => colorMixerSat[c]),
      channels.map((c) => colorMixerLum[c]),
    );
    renderToCanvas();
  }, [colorMixerHue, colorMixerLum, colorMixerSat, renderToCanvas]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const toVec = (w: typeof cgShadows): [number, number, number] => [
      w.hue / 360,
      w.sat,
      w.lum / 100,
    ];
    renderer.setColorGrading(
      toVec(cgShadows),
      toVec(cgMidtones),
      toVec(cgHighlights),
      cgBlending / 100,
      cgBalance / 100,
    );
    renderToCanvas();
  }, [cgBalance, cgBlending, cgHighlights, cgMidtones, cgShadows, renderToCanvas]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setEffects(
      effects.vigAmount / 100,
      effects.vigMidpoint / 100,
      effects.vigRoundness / 100,
      effects.vigFeather / 100,
      effects.vigHighlights / 100,
      effects.grainAmount / 100,
      effects.grainSize / 100,
      effects.grainRoughness / 100,
    );
    renderToCanvas();
  }, [effects, renderToCanvas]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    const activeMasks = masks.filter((m) => m.enabled).slice(0, 4);

    // Upload uniforms + handle brush slots incrementally
    const gpuMasks: MaskGPUData[] = activeMasks.map((m): MaskGPUData => {
      const adj = m.adjustments;
      const base = {
        adj: {
          exposure: adj.exposure,
          contrast: adj.contrast,
          highlights: adj.highlights,
          shadows: adj.shadows,
          whites: adj.whites,
          blacks: adj.blacks,
          temp: adj.temp,
          tint: adj.tint,
          texture: adj.texture,
          clarity: adj.clarity,
          dehaze: adj.dehaze,
          vibrance: adj.vibrance,
          saturation: adj.saturation,
        },
      };
      if (m.mask.type === 'brush') return { type: 1, ...base };
      if (m.mask.type === 'linear') {
        const d = m.mask.data;
        return { type: 2, linear: [d.x1, d.y1, d.x2, d.y2, d.feather], ...base };
      }
      const d = m.mask.data;
      return {
        type: 3,
        radial: [d.cx, d.cy, d.rx, d.ry, d.angle, d.feather, d.invert ? 1 : 0],
        ...base,
      };
    });
    renderer.setMasks(gpuMasks);

    // Incremental brush stroke rendering
    activeMasks.forEach((m, slotIndex) => {
      const prevId = prevSlotMaskIdsRef.current[slotIndex];
      if (prevId !== m.id) {
        // Different mask in this slot — clear FBO and reset upload count
        renderer.clearBrushMask(slotIndex);
        if (prevId) uploadedStrokesRef.current.delete(prevId);
        prevSlotMaskIdsRef.current[slotIndex] = m.id;
      }
      if (m.mask.type !== 'brush') return;
      const uploaded = uploadedStrokesRef.current.get(m.id) ?? 0;
      const strokes = m.mask.strokes;
      if (strokes.length < uploaded) {
        // Strokes removed (undo/reset) — clear and re-render all
        renderer.clearBrushMask(slotIndex);
        uploadedStrokesRef.current.set(m.id, 0);
      }
      const newCount = uploadedStrokesRef.current.get(m.id) ?? 0;
      if (strokes.length > newCount) {
        const paintStrokes = strokes.slice(newCount).filter((s) => !s.erase);
        const eraseStrokes = strokes.slice(newCount).filter((s) => s.erase);
        if (paintStrokes.length > 0) renderer.addBrushStrokes(slotIndex, paintStrokes, false);
        if (eraseStrokes.length > 0) renderer.addBrushStrokes(slotIndex, eraseStrokes, true);
        uploadedStrokesRef.current.set(m.id, strokes.length);
      }
    });

    // Clear FBOs for unused slots
    for (let i = activeMasks.length; i < 4; i++) {
      if (prevSlotMaskIdsRef.current[i] !== null) {
        renderer.clearBrushMask(i);
        if (prevSlotMaskIdsRef.current[i])
          uploadedStrokesRef.current.delete(prevSlotMaskIdsRef.current[i]!);
        prevSlotMaskIdsRef.current[i] = null;
      }
    }

    renderToCanvas();
  }, [masks, renderToCanvas]);

  // ── Heal: add spot with auto-source ─────────────────────────────────────
  const handleOverlayAddSpot = useCallback(
    (normX: number, normY: number) => {
      if (!healInteractionProps) return;
      const src = originalImgRef.current;
      const imgData = imageDataRef.current;
      if (!src || !imgData) return;
      const { brushSizePx, activeMode, feather, opacity, onSpotAdded } = healInteractionProps;
      const { width: w, height: h } = src;
      const storedBrushRadius = brushSizePx / (canvasDims.w * zoomRef.current);
      const radiusPx = Math.max(1, Math.round(storedBrushRadius * w));
      const srcPx = HealEngine.autoFindSource(
        imgData.data,
        Math.round(normX * w),
        Math.round(normY * h),
        radiusPx,
        w,
        h,
      );
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
    [healInteractionProps, canvasDims.w, zoomRef],
  );

  return { canvasRef, canvasDims, isLoading, handleOverlayAddSpot };
}
