import type { CropState } from '@/features/develop/crop';
import type { HealMode, HealSpot } from '@/features/develop/heal';
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

export type ImageCanvasProps = {
  dataUrl: string | null;
  healSpots?: HealSpot[];
  healInteractionProps?: HealInteractionProps;
  cropInteractionProps?: CropInteractionProps;
  confirmedCropState?: CropState | null;
  hideOverlay?: boolean;
  externalZoomPan?: ExternalZoomPan;
  onImageLoaded?: (w: number, h: number) => void;
};

export type { ExternalZoomPan };
