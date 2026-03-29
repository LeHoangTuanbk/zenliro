import { useCallback, useEffect, useRef, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { HistoryPanel } from '@features/develop/history';
import { useShortcut } from '@shared/lib/shortcuts';
import { ShortcutHint } from '@shared/ui/shortcut-hint';

type FilmstripPanelProps = {
  photos: ImportedPhoto[];
  selectedId: string | null;
  isVisible: boolean;
  onSelect: (id: string) => void;
};

export function FilmstripPanel({ photos, selectedId, isVisible, onSelect }: FilmstripPanelProps) {
  const filmstripRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const [isOpen, setIsOpen] = useState(true);
  const togglePanel = useCallback(() => setIsOpen((v) => !v), []);
  useShortcut([{ id: 'develop.toggle-filmstrip', handler: togglePanel }]);

  useEffect(() => {
    if (!selectedId || !isVisible || !isOpen) return;
    itemRefs.current.get(selectedId)?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [selectedId, isVisible, isOpen]);

  return (
    <div className="flex shrink-0 relative">
      <aside
        className="bg-br-bg border-r border-black flex flex-col shrink-0 transition-[width] duration-200 overflow-hidden"
        style={{ width: isOpen ? 180 : 0 }}
      >
        <div ref={filmstripRef} className="flex-1 overflow-y-auto flex flex-col gap-1 px-1.5 pb-2">
          {photos.map((p) => (
            <button
              key={p.id}
              ref={(node) => {
                if (node) itemRefs.current.set(p.id, node);
                else itemRefs.current.delete(p.id);
              }}
              onClick={() => onSelect(p.id)}
              className={`bg-[#111] rounded-[2px] overflow-hidden cursor-pointer border-2 transition-colors p-0 shrink-0 ${
                p.id === selectedId ? 'border-br-accent' : 'border-transparent hover:border-[#444]'
              }`}
              title={p.fileName}
            >
              {p.thumbnailDataUrl || p.dataUrl ? (
                <img
                  src={p.thumbnailDataUrl || p.dataUrl}
                  alt={p.fileName}
                  className="w-full h-[90px] object-cover block"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-[90px] bg-[#1a1a1a]" />
              )}
            </button>
          ))}
        </div>
        <div className="border-t border-black shrink-0">
          <HistoryPanel photoId={selectedId} />
        </div>
      </aside>

      {/* Small toggle icon — top-left, just outside sidebar */}
      <div className="absolute top-1.5 -right-7 z-20 flex flex-col items-center gap-0.5 group">
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="w-6 h-6 flex items-center justify-center rounded-[3px] text-[#555] hover:text-[#ccc] hover:bg-white/5 transition-colors cursor-pointer"
          title={isOpen ? 'Hide panel' : 'Show panel'}
        >
          {isOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
        </button>
        <ShortcutHint
          shortcutId="develop.toggle-filmstrip"
          className="text-br-dim opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </div>
    </div>
  );
}
