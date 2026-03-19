import { forwardRef, useRef } from 'react';
import { useZoomPan } from '../store/use-zoom-pan';
import { useWebGLCanvas } from '../model/use-webgl-canvas';
import { ImageCanvasView } from './image-canvas-view';
import type { ImageCanvasHandle, ImageCanvasProps } from '../store/types';

export type { ImageCanvasHandle, ImageCanvasProps };
export type {
  CropInteractionProps,
  HealInteractionProps,
  MaskInteractionProps,
  ExternalZoomPan,
} from '../store/types';

export const ImageCanvas = forwardRef<ImageCanvasHandle, ImageCanvasProps>(
  (
    {
      dataUrl,
      masks = [],
      healSpots = [],
      healInteractionProps,
      maskInteractionProps,
      cropInteractionProps,
      confirmedCropState,
      hideOverlay = false,
      externalZoomPan,
      onImageLoaded,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { zoom, pan, isSpaceDown, isPanning, zoomRef, reset, handleMouseDown } =
      useZoomPan(containerRef, externalZoomPan);

    const { canvasRef, canvasDims, isLoading, handleOverlayAddSpot } = useWebGLCanvas(ref, {
      dataUrl,
      masks,
      healSpots,
      healInteractionProps,
      cropInteractionProps,
      confirmedCropState,
      onImageLoaded,
      containerRef,
      zoomRef,
      onResetView: reset,
    });

    const showHeal = !!healInteractionProps && canvasDims.w > 0 && !hideOverlay;
    const showCrop = !!cropInteractionProps && canvasDims.w > 0;
    const showMask = !!maskInteractionProps && canvasDims.w > 0;

    return (
      <ImageCanvasView
        containerRef={containerRef}
        canvasRef={canvasRef}
        canvasDims={canvasDims}
        dataUrl={dataUrl}
        isLoading={isLoading}
        zoom={zoom}
        pan={pan}
        isSpaceDown={isSpaceDown}
        isPanning={isPanning}
        showHeal={showHeal}
        showCrop={showCrop}
        showMask={showMask}
        healInteractionProps={healInteractionProps}
        maskInteractionProps={maskInteractionProps}
        cropInteractionProps={cropInteractionProps}
        onMouseDown={handleMouseDown}
        onAddSpot={handleOverlayAddSpot}
      />
    );
  },
);

ImageCanvas.displayName = 'ImageCanvas';
