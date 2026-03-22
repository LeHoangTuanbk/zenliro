import { useEffect, useRef, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { HistoryPanel } from '@features/develop/history';

type FilmstripPanelProps = {
  photos: ImportedPhoto[];
  selectedId: string | null;
  isVisible: boolean;
  onSelect: (id: string) => void;
  onImport: () => void;
};

export function FilmstripPanel({ photos, selectedId, isVisible, onSelect, onImport }: FilmstripPanelProps) {
  const filmstripRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    if (!selectedId || !isVisible || !isOpen) return;
    requestAnimationFrame(() => {
      const container = filmstripRef.current;
      const item = itemRefs.current.get(selectedId);
      if (!container || !item) return;
      const cRect = container.getBoundingClientRect();
      const iRect = item.getBoundingClientRect();
      const above = iRect.top < cRect.top;
      const below = iRect.bottom > cRect.bottom;
      if (above || below) {
        container.scrollTop += iRect.top - cRect.top - cRect.height / 2 + iRect.height / 2;
      }
    });
  }, [selectedId, isVisible, isOpen]);

  return (
    <div className="flex shrink-0 relative">
      <aside
        className="bg-br-bg border-r border-black flex flex-col shrink-0 transition-[width] duration-200 overflow-hidden"
        style={{ width: isOpen ? 180 : 0 }}
      >
        <button
          onClick={onImport}
          className="mx-2 my-2 py-1 text-[10px] text-br-muted bg-br-input border border-br-elevated rounded-[2px] cursor-pointer hover:text-br-text transition-colors"
        >
          + Add
        </button>
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
              <img
                src={p.thumbnailDataUrl || p.dataUrl}
                alt={p.fileName}
                className="w-full h-[90px] object-cover block"
                loading="lazy"
              />
            </button>
          ))}
        </div>
        <div className="border-t border-black shrink-0">
          <HistoryPanel photoId={selectedId} />
        </div>
      </aside>

      {/* Small toggle icon — top-left, just outside sidebar */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="absolute top-1.5 -right-7 z-20 w-6 h-6 flex items-center justify-center rounded-[3px] text-[#555] hover:text-[#ccc] hover:bg-white/5 transition-colors cursor-pointer"
        title={isOpen ? 'Hide panel (Tab)' : 'Show panel (Tab)'}
      >
        {isOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
      </button>
    </div>
  );
}
