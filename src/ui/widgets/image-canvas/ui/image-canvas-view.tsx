import type { RefObject } from 'react';
import { HealOverlay } from '@/features/develop/heal';
import { CropOverlay } from '@/features/develop/crop';
import { Spinner } from '@/shared/ui/base';
import type { CropInteractionProps, HealInteractionProps } from '../store/types';

type Props = {
  containerRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  canvasDims: { w: number; h: number };
  dataUrl: string | null;
  isLoading: boolean;
  zoom: number;
  pan: { x: number; y: number };
  isSpaceDown: boolean;
  isPanning: boolean;
  showHeal: boolean;
  showCrop: boolean;
  healInteractionProps?: HealInteractionProps;
  cropInteractionProps?: CropInteractionProps;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onAddSpot: (normX: number, normY: number) => void;
};

export function ImageCanvasView({
  containerRef,
  canvasRef,
  canvasDims,
  dataUrl,
  isLoading,
  zoom,
  pan,
  isSpaceDown,
  isPanning,
  showHeal,
  showCrop,
  healInteractionProps,
  cropInteractionProps,
  onMouseDown,
  onAddSpot,
}: Props) {
  const cursor = isPanning ? 'grabbing' : isSpaceDown ? 'grab' : 'default';
  const noPointer = isSpaceDown ? { pointerEvents: 'none' as const } : undefined;

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center w-full h-full overflow-hidden"
      style={{ cursor }}
      onMouseDown={onMouseDown}
    >
      <div
        className="relative shadow-[0_4px_32px_rgba(0,0,0,0.6)]"
        style={{
          width: canvasDims.w || undefined,
          height: canvasDims.h || undefined,
          display: dataUrl ? 'block' : 'none',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          willChange: 'transform',
        }}
      >
        <canvas ref={canvasRef} className="block" />

        {showCrop && (
          <CropOverlay
            canvasWidth={canvasDims.w}
            canvasHeight={canvasDims.h}
            cropState={cropInteractionProps!.cropState}
            zoom={zoom}
            imageAspect={cropInteractionProps!.imageAspect}
            onChange={cropInteractionProps!.onChange}
            style={noPointer}
          />
        )}

        {showHeal && (
          <HealOverlay
            canvasWidth={canvasDims.w}
            canvasHeight={canvasDims.h}
            spots={healInteractionProps!.spots}
            selectedSpotId={healInteractionProps!.selectedSpotId}
            brushSizePx={healInteractionProps!.brushSizePx}
            zoom={zoom}
            activeMode={healInteractionProps!.activeMode}
            onAddSpot={onAddSpot}
            onMoveSpotDst={healInteractionProps!.onMoveSpotDst}
            onMoveSpotSrc={healInteractionProps!.onMoveSpotSrc}
            onSelectSpot={healInteractionProps!.onSelectSpot}
            onDeleteSpot={healInteractionProps!.onDeleteSpot}
            onBrushSizeChange={healInteractionProps!.onBrushSizeChange}
            style={noPointer}
          />
        )}
      </div>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#111]/80 z-10">
          <Spinner className="size-7 text-[#4d9fec]" />
        </div>
      )}

      {!dataUrl && !isLoading && (
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
}
