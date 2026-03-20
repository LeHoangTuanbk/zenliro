import type { CropState } from '@/features/develop/crop';
import type { HealMode, HealSpot } from '@/features/develop/heal';
import type { Mask } from '@/features/develop/mask';
import type { ExternalZoomPan } from './use-zoom-pan';

export type ImageCanvasHandle = {
  getExportDataUrl: (
    mimeType: string,
    quality: number,
    targetW?: number,
    targetH?: number,
    crop?: CropState | null,
  ) => string | null;
  getRenderedPixels: () => { data: Uint8ClampedArray; width: number; height: number } | null;
};

export type CropInteractionProps = {
  cropState: CropState;
  imageAspect: number;
  onChange: (patch: Partial<CropState>) => void;
};

export type HealInteractionProps = {
  spots: HealSpot[];
  selectedSpotId: string | null;
  brushSizePx: number;
  activeMode: HealMode;
  feather: number;
  opacity: number;
  onSpotAdded: (spot: HealSpot) => void;
  onMoveSpotDst: (id: string, normX: number, normY: number) => void;
  onMoveSpotSrc: (id: string, normX: number, normY: number) => void;
  onSelectSpot: (id: string | null) => void;
  onDeleteSpot: (id: string) => void;
  onBrushSizeChange: (px: number) => void;
};

type BrushMaskInteractionProps = {
  maskType: 'brush';
  photoId: string;
  selectedMaskId: string;
  brushSizePx: number;
  brushFeather: number;
  brushOpacity: number;
  brushErase: boolean;
  strokes: import('@/features/develop/mask').BrushStroke[];
  onStrokeAdded: (stroke: import('@/features/develop/mask').BrushStroke) => void;
  onBrushSizeChange: (px: number) => void;
};

type LinearMaskInteractionProps = {
  maskType: 'linear';
  photoId: string;
  selectedMaskId: string;
  linearData: import('@/features/develop/mask').LinearMaskData;
  onUpdate: (data: import('@/features/develop/mask').LinearMaskData) => void;
};

type RadialMaskInteractionProps = {
  maskType: 'radial';
  photoId: string;
  selectedMaskId: string;
  radialData: import('@/features/develop/mask').RadialMaskData;
  onUpdate: (data: import('@/features/develop/mask').RadialMaskData) => void;
};

export type MaskInteractionProps =
  | BrushMaskInteractionProps
  | LinearMaskInteractionProps
  | RadialMaskInteractionProps;

export type ImageCanvasProps = {
  photoId?: string | null;
  hasSelection?: boolean;
  dataUrl: string | null;
  imageBuffer?: ArrayBuffer | null;
  imageMimeType?: string | null;
  orientation?: number;
  masks?: Mask[];
  healSpots?: HealSpot[];
  healInteractionProps?: HealInteractionProps;
  maskInteractionProps?: MaskInteractionProps;
  cropInteractionProps?: CropInteractionProps;
  confirmedCropState?: CropState | null;
  hideOverlay?: boolean;
  externalZoomPan?: ExternalZoomPan;
  onImageLoaded?: (w: number, h: number) => void;
};

export type { ExternalZoomPan };
