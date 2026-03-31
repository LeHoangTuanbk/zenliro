import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { useBulkEditStore } from '../store/bulk-edit-store';

type BulkEditCompleteProps = {
  onReview?: () => void;
  onOpenDevelop?: (photoId: string) => void;
};

function formatDuration(startedAt: number | null, completedAt: number | null): string {
  if (!startedAt || !completedAt) return '—';
  const secs = Math.round((completedAt - startedAt) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}m ${rem}s`;
}

export function BulkEditComplete({ onReview, onOpenDevelop }: BulkEditCompleteProps) {
  const jobs = useBulkEditStore((s) => s.jobs);
  const summary = useBulkEditStore((s) => s.summary);
  const startedAt = useBulkEditStore((s) => s.startedAt);
  const completedAt = useBulkEditStore((s) => s.completedAt);
  const close = useBulkEditStore((s) => s.close);

  const duration = useMemo(() => formatDuration(startedAt, completedAt), [startedAt, completedAt]);

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-green-400" />
        <span className="text-[13px] font-medium text-white">Bulk Edit Complete!</span>
        {summary && (
          <span className="text-[11px] text-br-dim">
            {summary.done}/{summary.total} photos done
          </span>
        )}
      </div>

      {/* Thumbnail results strip */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {jobs.map((job) => (
          <div
            key={job.photoId}
            className={`shrink-0 w-12 h-12 rounded-[2px] overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity ${
              job.status === 'done'
                ? 'border-green-500/30'
                : job.status === 'error'
                  ? 'border-red-500/30'
                  : 'border-[#333]'
            }`}
            onDoubleClick={() => onOpenDevelop?.(job.photoId)}
            title={`${job.fileName} — double-click to open in Develop`}
          >
            {job.thumbnailUrl ? (
              <img
                src={job.thumbnailUrl}
                alt={job.fileName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-[#1a1a1a]" />
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-[11px] text-br-dim">
        {summary && (
          <>
            <span className="text-green-400">{summary.done} successful</span>
            {summary.failed > 0 && <span className="text-red-400">{summary.failed} failed</span>}
            {summary.cancelled > 0 && (
              <span className="text-yellow-500">{summary.cancelled} cancelled</span>
            )}
          </>
        )}
        <span>Total time: {duration}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        {onReview && (
          <button
            onClick={onReview}
            className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-medium bg-[#c4a0ff]/20 text-[#c4a0ff] border border-[#c4a0ff]/30 rounded-[3px] hover:bg-[#c4a0ff]/30 cursor-pointer transition-colors"
          >
            Review Results
          </button>
        )}
        <button
          onClick={close}
          className="px-3 py-1.5 text-[11px] text-br-dim hover:text-white cursor-pointer transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
