import { cn } from '@/shared/lib/utils';
import { RectangleVertical, Columns2, X } from 'lucide-react';
import { useCanvasZoomStore } from '@widgets/image-canvas/store/canvas-zoom-store';
import { CanvasMode } from '../const';

type Props = {
  activeMode: CanvasMode;
  onModeChange: (mode: CanvasMode) => void;
};

function ToolbarBtn({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        onMouseDown={(e) => e.currentTarget.blur()}
        onKeyDown={(e) => e.key === ' ' && e.preventDefault()}
        tabIndex={-1}
        className={cn(
          'w-7 h-6 flex items-center justify-center rounded-[2px] transition-colors',
          active
            ? 'bg-br-accent/20 text-br-accent'
            : 'text-[#666] hover:text-[#aaa] hover:bg-white/5',
        )}
      >
        {children}
      </button>
      <div className="pointer-events-none absolute bottom-full left-0 mb-1.5 px-2 py-0.5 bg-[#111] border border-[#333] text-br-text text-[10px] tracking-wide rounded-[3px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity delay-300 z-50">
        {title}
      </div>
    </div>
  );
}


function ZoomIndicator() {
  const zoom = useCanvasZoomStore((s) => s.zoom);
  const resetZoom = useCanvasZoomStore((s) => s.resetZoom);
  const isZoomed = Math.abs(zoom - 1) > 0.01;
  const pct = `${Math.round(zoom * 100)}%`;

  if (!isZoomed) return null;

  return (
    <button
      onClick={() => resetZoom?.()}
      className="h-5 px-1.5 text-[10px] text-[#999] hover:text-br-text hover:bg-white/5 rounded-[2px] transition-colors flex items-center gap-1 tabular-nums"
      title="Reset zoom (⌘0)"
    >
      <span>{pct}</span>
      <X size={10} />
    </button>
  );
}

export function CanvasToolbar({ activeMode, onModeChange }: Props) {
  return (
    <div className="h-7 bg-[#161616] border-t border-black flex items-center justify-start gap-0.5 px-2 shrink-0">
      <ToolbarBtn
        active={activeMode === CanvasMode.Loupe}
        title="Loupe View"
        onClick={() => onModeChange(CanvasMode.Loupe)}
      >
        <RectangleVertical size={12} />
      </ToolbarBtn>

      <ToolbarBtn
        active={activeMode === CanvasMode.Compare}
        title="Compare View (C)"
        onClick={() =>
          onModeChange(
            activeMode === CanvasMode.Compare ? CanvasMode.Loupe : CanvasMode.Compare,
          )
        }
      >
        <Columns2 size={12} />
      </ToolbarBtn>

      <div className="flex-1" />

      <ZoomIndicator />
    </div>
  );
}
