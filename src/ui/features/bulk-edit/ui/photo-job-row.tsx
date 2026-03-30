import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Ban,
  Square,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { PhotoJob } from '../store/bulk-edit-store';

type PhotoJobRowProps = {
  job: PhotoJob;
  isExpanded: boolean;
  onToggle: () => void;
  onOpenDevelop?: (photoId: string) => void;
};

const STATUS_CONFIG = {
  queued: { icon: Clock, color: 'text-br-dim', label: 'Queued' },
  processing: { icon: Loader2, color: 'text-[#4d9fec]', label: 'Processing' },
  done: { icon: CheckCircle2, color: 'text-green-400', label: 'Done' },
  error: { icon: XCircle, color: 'text-red-400', label: 'Error' },
  cancelled: { icon: Ban, color: 'text-yellow-500', label: 'Cancelled' },
} as const;

function formatElapsed(startedAt: number | null, completedAt: number | null): string {
  if (!startedAt) return '—';
  const end = completedAt ?? Date.now();
  const secs = Math.round((end - startedAt) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function useTick(active: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
}

export function PhotoJobRow({ job, isExpanded, onToggle, onOpenDevelop }: PhotoJobRowProps) {
  const config = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.queued;
  const Icon = config.icon;
  const isProcessing = job.status === 'processing';
  const isDone = job.status === 'done' || job.status === 'error' || job.status === 'cancelled';
  const hasLog = job.log.length > 0;
  const hasExpandable = isProcessing || hasLog;

  useTick(isProcessing);

  const elapsed = formatElapsed(job.startedAt, job.completedAt);

  return (
    <div className="rounded-[2px]">
      <button
        onClick={onToggle}
        onDoubleClick={() => isDone && onOpenDevelop?.(job.photoId)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-[#2a2a2a] cursor-pointer transition-colors rounded-[2px]"
        title={isDone ? 'Double-click to open in Develop' : undefined}
      >
        {hasExpandable ? (
          isExpanded ? (
            <ChevronDown className="w-3 h-3 text-br-dim shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-br-dim shrink-0" />
          )
        ) : (
          <span className="w-3 shrink-0" />
        )}

        <Icon
          className={`w-3.5 h-3.5 shrink-0 ${config.color} ${isProcessing ? 'animate-spin' : ''}`}
        />

        {/* Thumbnail */}
        <div className="w-6 h-6 rounded-[2px] overflow-hidden bg-[#1a1a1a] shrink-0">
          {job.thumbnailUrl ? (
            <img src={job.thumbnailUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" />
          )}
        </div>

        <span className="text-[11px] text-white truncate flex-1">{job.fileName}</span>

        <span className={`text-[10px] ${config.color} shrink-0`}>{config.label}</span>

        {job.agentIndex !== null && (
          <span className="text-[9px] text-br-dim shrink-0">#{job.agentIndex + 1}</span>
        )}

        {(isProcessing || job.status === 'queued') && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.electron?.bulkEdit?.stopJob(job.photoId);
            }}
            className="p-0.5 text-br-dim hover:text-red-400 cursor-pointer transition-colors shrink-0"
            title="Stop this job"
          >
            <Square className="w-3 h-3" />
          </button>
        )}

        <span className="text-[10px] text-br-dim w-14 text-right shrink-0">
          {isProcessing ? `${elapsed}...` : job.completedAt ? elapsed : '—'}
        </span>
      </button>

      {/* Expanded: live view (processing) */}
      {isExpanded && isProcessing && (
        <div className="ml-8 mr-2 mb-1 px-2 py-1.5 bg-[#1a1a1a] border border-[#333] rounded-[2px]">
          {job.lastToolName && (
            <div className="text-[9px] text-[#4d9fec] mb-0.5">Using: {job.lastToolName}</div>
          )}
          {job.thinking ? (
            <p className="text-[10px] text-[#999] leading-relaxed line-clamp-6 whitespace-pre-wrap">
              {job.thinking}
            </p>
          ) : (
            <div className="text-[9px] text-br-dim italic">Waiting for agent response...</div>
          )}
        </div>
      )}

      {/* Expanded: full log (done/error/cancelled) */}
      {isExpanded && isDone && hasLog && (
        <div className="ml-8 mr-2 mb-1 max-h-[200px] overflow-y-auto">
          <div className="flex flex-col gap-0.5 px-2 py-1.5 bg-[#1a1a1a] border border-[#333] rounded-[2px]">
            {job.log.map((entry, i) => (
              <div key={i}>
                {entry.type === 'tool' ? (
                  <div className="text-[9px] text-[#4d9fec] py-0.5">Used: {entry.text}</div>
                ) : (
                  <p className="text-[10px] text-[#999] leading-relaxed whitespace-pre-wrap py-0.5">
                    {entry.text}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error message */}
      {job.status === 'error' && job.error && !isExpanded && (
        <div className="ml-8 mr-2 mb-1 px-2 py-1 bg-red-500/5 border border-red-500/20 rounded-[2px]">
          <p className="text-[10px] text-red-400 line-clamp-2">{job.error}</p>
        </div>
      )}
    </div>
  );
}
