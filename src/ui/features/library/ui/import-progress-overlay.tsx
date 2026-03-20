import type { ImportProgress } from '@/pages/work-space/hook/use-photos';

type ImportProgressOverlayProps = {
  progress: ImportProgress;
};

export function ImportProgressOverlay({ progress }: ImportProgressOverlayProps) {
  if (!progress) return null;

  const percent = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="flex flex-col items-center gap-3 px-8 py-6 bg-[#2a2a2a] rounded-[4px] border border-[#444]">
        {/* Spinner */}
        <div className="w-8 h-8 border-2 border-[#555] border-t-[#4d9fec] rounded-full animate-spin" />
        <p className="text-[12px] text-[#f2f2f2]">
          Importing {progress.current} / {progress.total}
        </p>
        {/* Progress bar */}
        <div className="w-48 h-1.5 bg-[#444] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#4d9fec] transition-[width] duration-150"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
