import { forwardRef, useRef } from 'react';
import { useZoomPan } from '../store/use-zoom-pan';
import { useWebGLCanvas } from '../model/use-webgl-canvas';
import { ImageCanvasView } from './image-canvas-view';
import type { ImageCanvasHandle, ImageCanvasProps } from '../store/types';

export type { ImageCanvasHandle, ImageCanvasProps };
export type { CropInteractionProps, HealInteractionProps } from '../store/types';

export const ImageCanvas = forwardRef<ImageCanvasHandle, ImageCanvasProps>(
  (
    {
      dataUrl,
      healSpots = [],
      healInteractionProps,
      cropInteractionProps,
      confirmedCropState,
      hideOverlay = false,
      onImageLoaded,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { zoom, pan, isSpaceDown, isPanning, zoomRef, reset, handleMouseDown } =
      useZoomPan(containerRef);

    const { canvasRef, canvasDims, isLoading, handleOverlayAddSpot } = useWebGLCanvas(ref, {
      dataUrl,
      healSpots,
      healInteractionProps,
      cropInteractionProps,
      confirmedCropState,
      onImageLoaded,
      zoomRef,
      onResetView: reset,
    });

    const showHeal = !!healInteractionProps && canvasDims.w > 0 && !hideOverlay;
    const showCrop = !!cropInteractionProps && canvasDims.w > 0;

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
        healInteractionProps={healInteractionProps}
        cropInteractionProps={cropInteractionProps}
        onMouseDown={handleMouseDown}
        onAddSpot={handleOverlayAddSpot}
      />
    );
  },
);

ImageCanvas.displayName = 'ImageCanvas';
