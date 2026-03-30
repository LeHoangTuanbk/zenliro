/**
 * Offscreen WebGL rendering context for bulk edit agents.
 * Each context manages its own canvas + renderer + edit state for one photo.
 */

import { WebGLRenderer } from '@shared/lib/webgl/renderer';
import {
  DEFAULT_ADJUSTMENTS,
  type Adjustments,
} from '@features/develop/edit/store/adjustments-store';
import type { Mask } from '@features/develop/mask/store/types';
import type { MaskGPUData } from '@shared/lib/webgl/types';

const DEFAULT_COLOR_GRADING = {
  shadows: { hue: 0, sat: 0, lum: 0 },
  midtones: { hue: 0, sat: 0, lum: 0 },
  highlights: { hue: 0, sat: 0, lum: 0 },
  blending: 50,
  balance: 0,
};

const DEFAULT_EFFECTS = {
  vigAmount: 0,
  vigMidpoint: 50,
  vigRoundness: 0,
  vigFeather: 50,
  vigHighlights: 0,
  grainAmount: 0,
  grainSize: 25,
  grainRoughness: 50,
};

type WheelData = { hue: number; sat: number; lum: number };

type ColorGradingState = {
  shadows: WheelData;
  midtones: WheelData;
  highlights: WheelData;
  blending: number;
  balance: number;
};

type EffectsState = typeof DEFAULT_EFFECTS;

function wheelToVec3(w: WheelData): [number, number, number] {
  const rad = (w.hue * Math.PI) / 180;
  return [Math.cos(rad) * w.sat, Math.sin(rad) * w.sat, w.lum / 100];
}

export class OffscreenEditContext {
  readonly photoId: string;
  private canvas: HTMLCanvasElement;
  private renderer: WebGLRenderer;
  private imageElement: HTMLImageElement | HTMLCanvasElement | null = null;
  private ready = false;

  // Edit state (self-contained, not Zustand)
  adjustments: Adjustments = { ...DEFAULT_ADJUSTMENTS };
  toneCurve: { r: Uint8Array; g: Uint8Array; b: Uint8Array } | null = null;
  colorMixer: { hue: number[]; sat: number[]; lum: number[] } | null = null;
  colorGrading: ColorGradingState = { ...DEFAULT_COLOR_GRADING };
  effects: EffectsState = { ...DEFAULT_EFFECTS };
  masks: Mask[] = [];

  getImageElement(): HTMLImageElement | HTMLCanvasElement | null {
    return this.imageElement;
  }

  constructor(photoId: string) {
    this.photoId = photoId;
    this.canvas = document.createElement('canvas');
    this.renderer = new WebGLRenderer();
    this.renderer.init(this.canvas, { preserveDrawingBuffer: true });
  }

  async loadImageFromUrl(imageUrl: string): Promise<void> {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to load image: ${imageUrl}`));
      img.src = imageUrl;
    });

    this.canvas.width = img.naturalWidth;
    this.canvas.height = img.naturalHeight;
    this.imageElement = img;
    this.renderer.loadImage(img);
    this.ready = true;
    this.renderCurrent();
  }

  /** Re-render with current edit state */
  renderCurrent(): void {
    if (!this.ready) return;

    if (this.toneCurve) {
      this.renderer.setToneCurveLUT(this.toneCurve.r, this.toneCurve.g, this.toneCurve.b);
    }
    if (this.colorMixer) {
      this.renderer.setColorMixer(this.colorMixer.hue, this.colorMixer.sat, this.colorMixer.lum);
    }

    const cg = this.colorGrading;
    this.renderer.setColorGrading(
      wheelToVec3(cg.shadows),
      wheelToVec3(cg.midtones),
      wheelToVec3(cg.highlights),
      cg.blending,
      cg.balance,
    );

    const e = this.effects;
    this.renderer.setEffects(
      e.vigAmount,
      e.vigMidpoint,
      e.vigRoundness,
      e.vigFeather,
      e.vigHighlights,
      e.grainAmount,
      e.grainSize,
      e.grainRoughness,
    );

    // Masks
    const activeMasks = this.masks.filter((m) => m.enabled).slice(0, 4);
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
    this.renderer.setMasks(gpuMasks);

    this.renderer.render(this.canvas, this.adjustments);
  }

  getRenderedPixels(): { data: Uint8ClampedArray; width: number; height: number } | null {
    if (!this.ready) return null;
    this.renderCurrent();
    return this.renderer.readCurrentPixels();
  }

  getExportDataUrl(mimeType: string, quality: number): string | null {
    if (!this.ready || !this.imageElement) return null;
    return WebGLRenderer.exportDataUrl(this.imageElement, this.adjustments, mimeType, quality, {
      toneCurve: this.toneCurve ?? undefined,
      colorMixer: this.colorMixer ?? undefined,
      colorGrading: {
        shadows: wheelToVec3(this.colorGrading.shadows),
        midtones: wheelToVec3(this.colorGrading.midtones),
        highlights: wheelToVec3(this.colorGrading.highlights),
        blending: this.colorGrading.blending,
        balance: this.colorGrading.balance,
      },
      effects: this.effects,
      masks: this.masks,
    });
  }

  /** Get current edits as PhotoEdits for saving to catalog */
  captureEdits(): PhotoEdits {
    const cm = this.colorMixer;
    const cg = this.colorGrading;
    const e = this.effects;

    return {
      adjustments: { ...this.adjustments },
      toneCurve: {
        points: {
          rgb: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
          r: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
          g: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
          b: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
        },
        parametric: {
          rgb: { highlights: 0, lights: 0, darks: 0, shadows: 0 },
          r: { highlights: 0, lights: 0, darks: 0, shadows: 0 },
          g: { highlights: 0, lights: 0, darks: 0, shadows: 0 },
          b: { highlights: 0, lights: 0, darks: 0, shadows: 0 },
        },
      },
      colorMixer: {
        hue: cm
          ? Object.fromEntries(
              ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'].map(
                (k, i) => [k, cm.hue[i] ?? 0],
              ),
            )
          : {},
        saturation: cm
          ? Object.fromEntries(
              ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'].map(
                (k, i) => [k, cm.sat[i] ?? 0],
              ),
            )
          : {},
        luminance: cm
          ? Object.fromEntries(
              ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'].map(
                (k, i) => [k, cm.lum[i] ?? 0],
              ),
            )
          : {},
      },
      colorGrading: {
        shadows: cg.shadows,
        midtones: cg.midtones,
        highlights: cg.highlights,
        blending: cg.blending,
        balance: cg.balance,
      },
      effects: {
        vigAmount: e.vigAmount,
        vigMidpoint: e.vigMidpoint,
        vigRoundness: e.vigRoundness,
        vigFeather: e.vigFeather,
        vigHighlights: e.vigHighlights,
        grainAmount: e.grainAmount,
        grainSize: e.grainSize,
        grainRoughness: e.grainRoughness,
      },
      masks: this.masks.map((m) => ({
        id: m.id,
        name: m.name,
        enabled: m.enabled,
        mask: m.mask,
        adjustments: m.adjustments,
      })),
    };
  }

  dispose(): void {
    this.renderer.dispose();
    this.imageElement = null;
    this.ready = false;
  }
}

/**
 * Global manager for offscreen editing contexts (one per bulk-editing photo).
 */
class BulkContextManager {
  private contexts = new Map<string, OffscreenEditContext>();

  get(photoId: string): OffscreenEditContext | undefined {
    return this.contexts.get(photoId);
  }

  async create(photoId: string, imageUrl: string): Promise<OffscreenEditContext> {
    // Dispose existing if any
    this.dispose(photoId);

    const ctx = new OffscreenEditContext(photoId);
    await ctx.loadImageFromUrl(imageUrl);
    this.contexts.set(photoId, ctx);
    return ctx;
  }

  dispose(photoId: string): void {
    const ctx = this.contexts.get(photoId);
    if (ctx) {
      ctx.dispose();
      this.contexts.delete(photoId);
    }
  }

  disposeAll(): void {
    for (const ctx of this.contexts.values()) {
      ctx.dispose();
    }
    this.contexts.clear();
  }

  has(photoId: string): boolean {
    return this.contexts.has(photoId);
  }
}

export const bulkContextManager = new BulkContextManager();
