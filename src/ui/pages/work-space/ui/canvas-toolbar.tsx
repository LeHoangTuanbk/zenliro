import { cn } from '@/shared/lib/utils';
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

function SingleIcon() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
      <rect x="2" y="1" width="12" height="10" rx="1.5" opacity="0.9" />
    </svg>
  );
}

function CompareIcon() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
      <rect x="1" y="1" width="6" height="10" rx="1.5" opacity="0.6" />
      <rect x="9" y="1" width="6" height="10" rx="1.5" opacity="0.9" />
    </svg>
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
        <SingleIcon />
      </ToolbarBtn>

      <ToolbarBtn
        active={activeMode === CanvasMode.Compare}
        title="Compare View"
        onClick={() =>
          onModeChange(
            activeMode === CanvasMode.Compare ? CanvasMode.Loupe : CanvasMode.Compare,
          )
        }
      >
        <CompareIcon />
      </ToolbarBtn>
    </div>
  );
}
