import { useRef, useState, useCallback } from 'react';
import type { ExternalZoomPan } from '@widgets/image-canvas/ui/image-canvas';
import { useZoomPan } from '@widgets/image-canvas/store/use-zoom-pan';

type Props = {
  dataUrl: string | null;
  externalZoomPan: ExternalZoomPan;
};

export function CompareBeforePanel({ dataUrl, externalZoomPan }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isSpaceDown, isPanning, handleMouseDown } = useZoomPan(containerRef, externalZoomPan);
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);

  const { zoom, pan } = externalZoomPan;
  const cursor = isPanning ? 'grabbing' : isSpaceDown ? 'grab' : 'default';

  const handleLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const container = containerRef.current;
    if (!container) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;

    // Fit image to container, same logic as WebGL canvas
    const scale = Math.min(cw / nw, ch / nh, 1);
    setImgDims({ w: Math.round(nw * scale), h: Math.round(nh * scale) });
  }, []);

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
          className="block shadow-[0_4px_32px_rgba(0,0,0,0.6)] select-none"
          style={{
            width: imgDims?.w,
            height: imgDims?.h,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            willChange: 'transform',
            pointerEvents: isSpaceDown ? 'none' : 'auto',
          }}
          draggable={false}
          onLoad={handleLoad}
        />
      )}
    </div>
  );
}
