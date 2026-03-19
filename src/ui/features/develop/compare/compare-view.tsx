import { useRef } from 'react';
import type { ExternalZoomPan } from '@widgets/image-canvas/ui/image-canvas';
import { useZoomPan } from '@widgets/image-canvas/store/use-zoom-pan';
import { cn } from '@/shared/lib/utils';

type Props = {
  dataUrl: string | null;
  externalZoomPan: ExternalZoomPan;
};

export function CompareBeforePanel({ dataUrl, externalZoomPan }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isSpaceDown, isPanning, handleMouseDown } = useZoomPan(containerRef, externalZoomPan);

  const { zoom, pan } = externalZoomPan;
  const cursor = isPanning ? 'grabbing' : isSpaceDown ? 'grab' : 'default';

  return (
    <div
      ref={containerRef}
      className="relative flex-1 flex items-center justify-center overflow-hidden border-r border-[#333]"
      style={{ cursor }}
      onMouseDown={handleMouseDown}
    >
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 px-2 py-0.5 bg-black/50 text-br-muted text-[10px] tracking-wider rounded-[2px] select-none pointer-events-none">
        Before
      </div>
      {dataUrl && (
        <img
          src={dataUrl}
          alt="original"
          className={cn('block shadow-[0_4px_32px_rgba(0,0,0,0.6)] select-none')}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            willChange: 'transform',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            pointerEvents: isSpaceDown ? 'none' : 'auto',
          }}
          draggable={false}
        />
      )}
    </div>
  );
}
