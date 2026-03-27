import { useCallback, useEffect, useRef, useState } from 'react';
import { useCanvasZoomStore } from './canvas-zoom-store';
import { useShortcut } from '@shared/lib/shortcuts';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 16;

export type ExternalZoomPan = {
  zoom: number;
  pan: { x: number; y: number };
  onChange: (zoom: number, pan: { x: number; y: number }) => void;
};

export function useZoomPan(
  containerRef: React.RefObject<HTMLElement | null>,
  external?: ExternalZoomPan,
) {
  const [localZoom, setLocalZoom] = useState(1);
  const [localPan, setLocalPan] = useState({ x: 0, y: 0 });
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  const zoom = external?.zoom ?? localZoom;
  const pan = external?.pan ?? localPan;

  const isSpaceDownRef = useRef(false);
  const panStartRef = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  const applyPan = (p: { x: number; y: number }) => {
    if (external) external.onChange(zoomRef.current, p);
    else setLocalPan(p);
  };

  const reset = () => {
    if (external) external.onChange(1, { x: 0, y: 0 });
    else {
      setLocalZoom(1);
      setLocalPan({ x: 0, y: 0 });
    }
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
      const newPan = {
        x: Dx * (1 - ratio) + panRef.current.x * ratio,
        y: Dy * (1 - ratio) + panRef.current.y * ratio,
      };
      if (external) {
        external.onChange(newZoom, newPan);
      } else {
        setLocalZoom(newZoom);
        setLocalPan(newPan);
      }
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [containerRef, external]);

  // Space key for pan mode (hold-type, stays local)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        isSpaceDownRef.current = true;
        setIsSpaceDown(true);
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
      applyPan({ x: start.px + (e.clientX - start.mx), y: start.py + (e.clientY - start.my) });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [external]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isSpaceDownRef.current || e.button !== 0) return;
    e.preventDefault();
    panStartRef.current = {
      mx: e.clientX,
      my: e.clientY,
      px: panRef.current.x,
      py: panRef.current.y,
    };
    setIsPanning(true);
  };

  // Sync zoom level to store for toolbar display
  useEffect(() => {
    useCanvasZoomStore.getState().setZoom(zoom);
  }, [zoom]);

  useEffect(() => {
    useCanvasZoomStore.getState().setResetZoom(reset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [external]);

  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(MAX_ZOOM, zoomRef.current * 1.25);
    if (external) external.onChange(newZoom, panRef.current);
    else {
      setLocalZoom(newZoom);
    }
  }, [external]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(MIN_ZOOM, zoomRef.current / 1.25);
    if (external) external.onChange(newZoom, panRef.current);
    else {
      setLocalZoom(newZoom);
    }
  }, [external]);

  const handleResetZoom = useCallback(() => reset(), [reset]);

  useShortcut([
    { id: 'global.reset-zoom', handler: handleResetZoom },
    { id: 'global.zoom-in', handler: handleZoomIn },
    { id: 'global.zoom-out', handler: handleZoomOut },
  ]);

  return { zoom, pan, isSpaceDown, isPanning, zoomRef, reset, handleMouseDown };
}
