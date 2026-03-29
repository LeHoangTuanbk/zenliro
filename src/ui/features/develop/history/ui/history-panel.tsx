import { useEffect, useRef } from 'react';
import { useHistoryStore } from '../store/history-store';
import { applySnapshot } from '../lib/snapshot';
import { saveHistory } from '../lib/history-db';

type HistoryPanelProps = {
  photoId: string | null;
};

const IS_MAC = navigator.platform.startsWith('Mac');
const SHORTCUT_TIP = IS_MAC ? '⌘Z Undo / ⌘⇧Z Redo' : 'Ctrl+Z Undo / Ctrl+Shift+Z Redo';

export function HistoryPanel({ photoId }: HistoryPanelProps) {
  const history = useHistoryStore((s) => (photoId ? s.getHistory(photoId) : null));
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLButtonElement>(null);

  const currentIndex = history?.currentIndex ?? -1;

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest' });
  }, [currentIndex]);

  if (!photoId || !history || history.entries.length === 0) {
    return <div className="px-3 py-3 text-[10px] text-br-dim text-center">No history</div>;
  }

  const { entries } = history;

  const jumpTo = (index: number) => {
    if (index === currentIndex || !photoId) return;
    const store = useHistoryStore.getState();
    store.setIsApplying(true);
    const updated = { ...history, currentIndex: index };
    useHistoryStore.setState((s) => ({
      historyByPhoto: {
        ...s.historyByPhoto,
        [photoId]: updated,
      },
    }));
    saveHistory(photoId, updated);
    applySnapshot(photoId, entries[index].snapshot);
    requestAnimationFrame(() => store.setIsApplying(false));
  };

  return (
    <div className="flex flex-col shrink-0">
      <div className="px-3 py-1.5 border-b border-br-elevated" title={SHORTCUT_TIP}>
        <span className="text-[10px] text-br-dim uppercase tracking-[0.6px]">History</span>
      </div>
      <div ref={scrollRef} className="max-h-[300px] overflow-y-auto flex flex-col-reverse">
        {entries.map((entry, i) => (
          <button
            key={`${entry.timestamp}-${i}`}
            ref={i === currentIndex ? currentRef : undefined}
            onClick={() => jumpTo(i)}
            title={entry.details || entry.label}
            className={`w-full text-left px-2 py-1 text-[11px] min-h-8 cursor-pointer border-none transition-colors truncate ${
              i === currentIndex
                ? 'text-br-text bg-br-accent/20'
                : i > currentIndex
                  ? 'text-br-dim hover:bg-br-elevated/30'
                  : 'text-br-muted hover:bg-br-elevated/50'
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>
    </div>
  );
}
