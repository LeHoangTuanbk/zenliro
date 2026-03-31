import { useMemo } from 'react';
import { Square, Minimize2, X, CheckCircle2, RotateCcw } from 'lucide-react';
import { useBulkEditStore } from '../store/bulk-edit-store';
import { PhotoJobRow } from './photo-job-row';

type BulkEditMonitorProps = {
  onOpenDevelop?: (photoId: string) => void;
};

export function BulkEditMonitor({ onOpenDevelop }: BulkEditMonitorProps) {
  const jobs = useBulkEditStore((s) => s.jobs);
  const phase = useBulkEditStore((s) => s.phase);
  const expandedJobId = useBulkEditStore((s) => s.expandedJobId);
  const stopAll = useBulkEditStore((s) => s.stopAll);
  const minimize = useBulkEditStore((s) => s.minimize);
  const close = useBulkEditStore((s) => s.close);
  const setExpandedJob = useBulkEditStore((s) => s.setExpandedJob);

  const isComplete = phase === 'complete';

  const { done, total, pct, failed } = useMemo(() => {
    const total = jobs.length;
    const done = jobs.filter((j) => j.status === 'done').length;
    const failed = jobs.filter((j) => j.status === 'error').length;
    const finished = jobs.filter(
      (j) => j.status === 'done' || j.status === 'error' || j.status === 'cancelled',
    ).length;
    return { done, total, pct: total > 0 ? Math.round((finished / total) * 100) : 0, failed };
  }, [jobs]);

  return (
    <div className="flex flex-col h-full">
      {/* Header + progress */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#333]">
        <div className="flex items-center gap-3">
          {isComplete ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-[13px] font-medium text-white">Bulk Edit Complete</span>
              <span className="text-[11px] text-br-dim">
                {done}/{total} done{failed > 0 ? `, ${failed} failed` : ''}
              </span>
            </>
          ) : (
            <>
              <span className="text-[13px] font-medium text-white">AI Bulk Edit</span>
              <span className="text-[11px] text-br-dim">
                Progress: {done + failed}/{total} ({pct}%)
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isComplete && (
            <button
              onClick={stopAll}
              className="flex items-center gap-1 px-2 py-1 text-[10px] text-red-400 hover:bg-red-400/10 rounded-[2px] cursor-pointer transition-colors"
            >
              <Square className="w-3 h-3" />
              Stop All
            </button>
          )}
          {isComplete && (
            <>
              <button
                onClick={useBulkEditStore.getState().newBulkEdit}
                className="flex items-center gap-1 px-2 py-1 text-[10px] text-[#c4a0ff] hover:bg-[#c4a0ff]/10 rounded-[2px] cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                New Bulk Edit
              </button>
              <button
                onClick={close}
                className="p-1 text-br-dim hover:text-white cursor-pointer transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={minimize}
            className="p-1 text-br-dim hover:text-white cursor-pointer transition-colors"
            title="Minimize"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-[#1a1a1a]">
        <div
          className={`h-full transition-all duration-300 ${isComplete ? 'bg-green-400' : 'bg-[#c4a0ff]'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Job list */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <div className="flex flex-col gap-0.5">
          {jobs.map((job) => (
            <PhotoJobRow
              key={job.photoId}
              job={job}
              isExpanded={expandedJobId === job.photoId}
              onToggle={() => setExpandedJob(expandedJobId === job.photoId ? null : job.photoId)}
              onOpenDevelop={onOpenDevelop}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
