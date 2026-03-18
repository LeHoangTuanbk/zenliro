import { useEffect, useRef, useState } from 'react';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 16;

export function useZoomPan(containerRef: React.RefObject<HTMLElement | null>) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  const isSpaceDownRef = useRef(false);
  const panStartRef = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Cmd/Ctrl + scroll to zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const Dx = e.clientX - rect.left - rect.width / 2;
      const Dy = e.clientY - rect.top - rect.height / 2;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const oldZoom = zoomRef.current;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * factor));
      const ratio = newZoom / oldZoom;
      setZoom(newZoom);
      setPan((p) => ({ x: Dx * (1 - ratio) + p.x * ratio, y: Dy * (1 - ratio) + p.y * ratio }));
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [containerRef]);

  // Space key: hand tool + Cmd+0 reset
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        isSpaceDownRef.current = true;
        setIsSpaceDown(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        reset();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpaceDownRef.current = false;
        setIsSpaceDown(false);
        panStartRef.current = null;
        setIsPanning(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Window-level mouse move/up for panning
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const start = panStartRef.current;
      if (!start) return;
      setPan({ x: start.px + (e.clientX - start.mx), y: start.py + (e.clientY - start.my) });
    };
    const onUp = () => {
      if (panStartRef.current) {
        panStartRef.current = null;
        setIsPanning(false);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isSpaceDownRef.current || e.button !== 0) return;
    e.preventDefault();
    panStartRef.current = { mx: e.clientX, my: e.clientY, px: panRef.current.x, py: panRef.current.y };
    setIsPanning(true);
  };

  return { zoom, pan, isSpaceDown, isPanning, zoomRef, reset, handleMouseDown };
}
