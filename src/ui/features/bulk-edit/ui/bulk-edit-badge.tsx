import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { useBulkEditStore } from '../store/bulk-edit-store';

export function BulkEditBadge() {
  const isMinimized = useBulkEditStore((s) => s.isMinimized);
  const phase = useBulkEditStore((s) => s.phase);
  const jobs = useBulkEditStore((s) => s.jobs);
  const restore = useBulkEditStore((s) => s.restore);

  const { done, total } = useMemo(() => {
    const total = jobs.length;
    const done = jobs.filter(
      (j) => j.status === 'done' || j.status === 'error' || j.status === 'cancelled',
    ).length;
    return { done, total };
  }, [jobs]);

  if (!isMinimized) return null;

  return (
    <button
      onClick={restore}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 bg-[#222] border border-[#c4a0ff]/30 rounded-[4px] shadow-lg cursor-pointer hover:bg-[#2a2a2a] transition-colors"
    >
      <Sparkles className="w-3.5 h-3.5 text-[#c4a0ff]" />
      <span className="text-[11px] text-white">
        {phase === 'complete' ? 'Bulk Edit Done' : `Bulk Edit: ${done}/${total}`}
      </span>
      {phase === 'processing' && (
        <div className="w-2 h-2 bg-[#4d9fec] rounded-full animate-pulse" />
      )}
    </button>
  );
}
