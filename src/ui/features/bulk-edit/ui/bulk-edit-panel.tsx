import { useCallback, useRef, useState } from 'react';
import { useBulkEditStore } from '../store/bulk-edit-store';
import { BulkEditSetup } from './bulk-edit-setup';
import { BulkEditMonitor } from './bulk-edit-monitor';

const MIN_HEIGHT = 180;
const MAX_HEIGHT = 600;
const DEFAULT_HEIGHT = 300;

type BulkEditPanelProps = {
  onOpenDevelop?: (photoId: string) => void;
};

export function BulkEditPanel({ onOpenDevelop }: BulkEditPanelProps) {
  const isPanelOpen = useBulkEditStore((s) => s.isPanelOpen);
  const phase = useBulkEditStore((s) => s.phase);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startH = useRef(0);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragging.current = true;
      startY.current = e.clientY;
      startH.current = height;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [height],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const delta = startY.current - e.clientY;
    setHeight(Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startH.current + delta)));
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  if (!isPanelOpen) return null;

  return (
    <div className="flex flex-col shrink-0 bg-[#222]" style={{ height }}>
      {/* Resize handle */}
      <div
        className="h-1 cursor-row-resize group relative shrink-0"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div className="absolute inset-x-0 -top-1 bottom-0 h-3" />
        <div className="h-px bg-[#c4a0ff]/20 group-hover:bg-[#c4a0ff]/50 transition-colors" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {phase === 'setup' && <BulkEditSetup />}
        {(phase === 'processing' || phase === 'complete') && (
          <BulkEditMonitor onOpenDevelop={onOpenDevelop} />
        )}
      </div>
    </div>
  );
}
