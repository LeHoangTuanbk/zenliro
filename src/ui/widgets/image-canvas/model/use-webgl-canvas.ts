import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ForwardedRef, RefObject } from 'react';
import { type SpotGPUData, WebGLRenderer } from '@shared/lib/webgl';
import { useAdjustmentsStore } from '@/features/develop/edit';
import { type HealSpot, HealEngine } from '@/features/develop/heal';
import { useToneCurveStore } from '@/features/develop/edit/tone-curve';
import { generateLUT, combineLUTs } from '@/features/develop/edit/tone-curve';
import { useColorMixerStore } from '@/features/develop/edit/color-mixer';
import type { HslChannel } from '@/features/develop/edit/color-mixer';
import { useColorGradingStore } from '@/features/develop/edit/color-grading';
import { useEffectsStore } from '@/features/develop/edit/effects';
import {
  dataUrlToBlob,
  dataUrlToPartialBuffer,
  drawBitmapWithOrientation,
  readExifOrientationFromBuffer,
} from '../lib/image-utils';
import type { CropInteractionProps, HealInteractionProps, ImageCanvasHandle } from '../store/types';
import type { CropState } from '@/features/develop/crop';

type Params = {
  dataUrl: string | null;
  healSpots: HealSpot[];
  healInteractionProps?: HealInteractionProps;
  cropInteractionProps?: CropInteractionProps;
  confirmedCropState?: CropState | null;
  onImageLoaded?: (w: number, h: number) => void;
  containerRef: RefObject<HTMLElement | null>;
  zoomRef: RefObject<number>;
  onResetView: () => void;
};

export function useWebGLCanvas(ref: ForwardedRef<ImageCanvasHandle>, params: Params) {
  const {
    dataUrl,
    healSpots,
    healInteractionProps,
    cropInteractionProps,
    confirmedCropState,
    onImageLoaded,
    containerRef,
    zoomRef,
    onResetView,
  } = params;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const originalImgRef = useRef<HTMLCanvasElement | null>(null);
  const imageDataRef = useRef<ImageData | null>(null);
  const gpuSpotsRef = useRef<SpotGPUData[]>([]);
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

  function renderToCanvas() {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer || !originalImgRef.current) return;
    try {
      renderer.render(canvas, useAdjustmentsStore.getState().adjustments);
    } catch (err) {
      console.error('[ImageCanvas] render error:', err);
    }
  }

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

  // ── Init WebGL ───────────────────────────────────────────────────────────
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

  // ── Load image ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!dataUrl || !rendererRef.current) return;
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const exifBuf = dataUrlToPartialBuffer(dataUrl);
        const orientation = readExifOrientationFromBuffer(exifBuf);
        const blob = dataUrlToBlob(dataUrl);
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

        onImageLoaded?.(imgW, imgH);

        const cw = container.clientWidth || 800;
        const ch = container.clientHeight || 600;
        const scale = Math.min(cw / imgW, ch / imgH, 1);
        canvas.width = Math.max(1, Math.round(imgW * scale));
        canvas.height = Math.max(1, Math.round(imgH * scale));
        setCanvasDims({ w: canvas.width, h: canvas.height });
        onResetView();

        imageDataRef.current = ctx2d.getImageData(0, 0, imgW, imgH);
        originalImgRef.current = tmp;
        gpuSpotsRef.current = [];

        rendererRef.current!.loadImage(tmp);
        rendererRef.current!.setHealSpots([]);
        computeAndUploadSpots(healSpots);
        renderToCanvas();
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
  }, [dataUrl]);

  useEffect(() => {
    computeAndUploadSpots(healSpots);
    renderToCanvas();
  }, [healSpots]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setCropState(cropInteractionProps ? null : (confirmedCropState ?? null));
    renderToCanvas();
  }, [cropInteractionProps, confirmedCropState]);

  useEffect(() => {
    if (!canvasRef.current || !rendererRef.current) return;
    try {
      rendererRef.current.render(canvasRef.current, adjustments);
    } catch (err) {
      console.error('[WebGL] render failed:', err);
    }
  }, [adjustments]);

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
  }, [toneCurvePoints, toneCurveParametric]);

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
  }, [colorMixerHue, colorMixerSat, colorMixerLum]);

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
  }, [cgShadows, cgMidtones, cgHighlights, cgBlending, cgBalance]);

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
  }, [effects]);

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
