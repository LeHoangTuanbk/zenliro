import { useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';
import { useBulkEditStore } from '../store/bulk-edit-store';
import { useAgentStore } from '@features/agent/store/agent-store';
import type { AgentProvider } from '@features/agent/store/agent-store';
import { useBulkEditActions } from '../hook/use-bulk-edit-actions';
import { ShortcutHint } from '@/shared/ui/shortcut-hint';

export function BulkEditSetup() {
  const jobs = useBulkEditStore((s) => s.jobs);
  const prompt = useBulkEditStore((s) => s.prompt);
  const parallelCount = useBulkEditStore((s) => s.parallelCount);
  const modelId = useBulkEditStore((s) => s.modelId);
  const setPrompt = useBulkEditStore((s) => s.setPrompt);
  const setParallelCount = useBulkEditStore((s) => s.setParallelCount);
  const setModelId = useBulkEditStore((s) => s.setModelId);
  const removePhoto = useBulkEditStore((s) => s.removePhoto);
  const close = useBulkEditStore((s) => s.close);
  const { startBulkEdit } = useBulkEditActions();

  // Reuse the same model list from the agent store (supports claude, codex, etc.)
  const models = useAgentStore((s) => s.models);
  const modelsLoaded = useAgentStore((s) => s.modelsLoaded);
  const loadModelsAction = useAgentStore((s) => s.loadModels);

  // Load models if not yet loaded (e.g. bulk edit opened before develop view)
  useEffect(() => {
    if (modelsLoaded) return;
    window.electron?.agent?.loadModels().then((loaded) => {
      if (loaded && loaded.length > 0) {
        loadModelsAction(
          loaded.map((m) => ({
            id: m.id,
            label: m.label,
            description: m.description,
            provider: m.provider as AgentProvider,
          })),
        );
      }
    });
  }, [modelsLoaded, loadModelsAction]);

  const canStart = prompt.trim().length > 0 && jobs.length >= 1;

  return (
    <div
      className="flex flex-col gap-3 p-4"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          close();
        }
      }}
      tabIndex={-1}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#c4a0ff]" />
          <span className="text-[13px] font-medium text-white">
            AI Bulk Edit <ShortcutHint shortcutId="bulk-edit.open" className="text-[#c4a0ff]" />
          </span>
          <span className="text-[11px] text-br-dim">{jobs.length} photos selected</span>
        </div>
        <button
          onClick={close}
          className="p-1 text-br-dim hover:text-white cursor-pointer transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Thumbnail strip */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {jobs.map((job) => (
          <div key={job.photoId} className="relative group shrink-0">
            <div className="w-12 h-12 rounded-[2px] overflow-hidden bg-[#1a1a1a] border border-[#333]">
              {job.thumbnailUrl ? (
                <img
                  src={job.thumbnailUrl}
                  alt={job.fileName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[8px] text-br-dim">
                  {job.fileName.slice(0, 6)}
                </div>
              )}
            </div>
            <button
              onClick={() => removePhoto(job.photoId)}
              className="absolute -top-1 -right-1 w-4 h-4 bg-[#333] border border-[#555] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-red-500/50"
            >
              <X className="w-2.5 h-2.5 text-white" />
            </button>
          </div>
        ))}
      </div>

      {/* Prompt */}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canStart) {
            e.preventDefault();
            startBulkEdit();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            close();
          }
        }}
        placeholder="Describe how you want to edit these photos... e.g., 'Make all photos warm and cinematic with subtle film grain'"
        className="w-full h-20 px-3 py-2 text-[12px] bg-[#1a1a1a] border border-[#3a3a3a] rounded-[3px] text-white placeholder:text-br-muted outline-none focus:border-[#c4a0ff]/50 resize-none"
        autoFocus
      />

      {/* Options row */}
      <div className="flex items-center gap-4">
        {/* Parallel agents */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-br-dim">Parallel agents:</span>
          <select
            value={parallelCount}
            onChange={(e) => setParallelCount(Number(e.target.value))}
            className="text-[11px] bg-[#2a2a2a] border border-[#3a3a3a] rounded-[2px] text-white px-2 py-1 outline-none cursor-pointer"
          >
            {[1, 2, 3, 4, 5]
              .filter((n) => n <= jobs.length)
              .map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
          </select>
        </div>

        {/* Model — reuses all models from agent store (claude, codex, etc.) */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-br-dim">Model:</span>
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="text-[11px] bg-[#2a2a2a] border border-[#3a3a3a] rounded-[2px] text-white px-2 py-1 outline-none cursor-pointer"
          >
            {Object.entries(
              models.reduce<Record<string, typeof models>>((acc, m) => {
                const group = m.provider.toUpperCase();
                (acc[group] ??= []).push(m);
                return acc;
              }, {}),
            ).map(([provider, group]) => (
              <optgroup key={provider} label={provider}>
                {group.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Spacer + actions */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={close}
            className="px-3 py-1.5 text-[11px] text-br-dim hover:text-white cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={startBulkEdit}
            disabled={!canStart}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-medium rounded-[3px] transition-colors ${
              canStart
                ? 'bg-[#c4a0ff]/20 text-[#c4a0ff] border border-[#c4a0ff]/30 hover:bg-[#c4a0ff]/30 cursor-pointer'
                : 'bg-[#2a2a2a] text-br-muted border border-[#3a3a3a] cursor-not-allowed'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Start Bulk Edit
            <ShortcutHint shortcutId="bulk-edit.start" className="text-[#c4a0ff]/50" />
          </button>
        </div>
      </div>
    </div>
  );
}
