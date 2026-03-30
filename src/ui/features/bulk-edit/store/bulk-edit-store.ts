import { create } from 'zustand';
import type { BulkPhase, JobStatus } from '../const/channels';

export type JobLogEntry = {
  type: 'thinking' | 'tool';
  text: string;
  timestamp: number;
};

export type PhotoJob = {
  photoId: string;
  fileName: string;
  thumbnailUrl: string;
  status: JobStatus;
  agentIndex: number | null;
  startedAt: number | null;
  completedAt: number | null;
  error: string | null;
  thinking: string;
  lastToolName: string | null;
  log: JobLogEntry[];
};

type BulkEditStore = {
  // State
  isActive: boolean;
  isPanelOpen: boolean;
  isMinimized: boolean;
  phase: BulkPhase;

  // Setup
  selectedPhotoIds: string[];
  prompt: string;
  parallelCount: number;
  modelId: string;

  // Progress
  jobs: PhotoJob[];
  expandedJobId: string | null;

  // Results
  startedAt: number | null;
  completedAt: number | null;
  summary: { total: number; done: number; failed: number; cancelled: number } | null;

  // Actions — Setup
  openSetup: (
    photoIds: string[],
    photoMeta: Array<{ id: string; fileName: string; thumbnailUrl: string }>,
  ) => void;
  setPrompt: (text: string) => void;
  setParallelCount: (n: number) => void;
  setModelId: (id: string) => void;
  addPhoto: (meta: { id: string; fileName: string; thumbnailUrl: string }) => void;
  removePhoto: (photoId: string) => void;

  // Actions — Lifecycle
  startProcessing: () => void;
  stopAll: () => void;
  minimize: () => void;
  restore: () => void;
  close: () => void;

  // Actions — From IPC events
  updateJobStatus: (photoId: string, status: JobStatus, agentIndex: number | null) => void;
  updateJobThinking: (photoId: string, text: string) => void;
  updateJobToolUse: (photoId: string, name: string) => void;
  setAllDone: (summary: { total: number; done: number; failed: number; cancelled: number }) => void;
  setExpandedJob: (photoId: string | null) => void;
};

export const useBulkEditStore = create<BulkEditStore>((set, get) => ({
  isActive: false,
  isPanelOpen: false,
  isMinimized: false,
  phase: 'setup',

  selectedPhotoIds: [],
  prompt: '',
  parallelCount: 3,
  modelId: 'sonnet',

  jobs: [],
  expandedJobId: null,

  startedAt: null,
  completedAt: null,
  summary: null,

  openSetup: (photoIds, photoMeta) => {
    const jobs: PhotoJob[] = photoMeta.map((p) => ({
      photoId: p.id,
      fileName: p.fileName,
      thumbnailUrl: p.thumbnailUrl,
      status: 'queued',
      agentIndex: null,
      startedAt: null,
      completedAt: null,
      error: null,
      thinking: '',
      lastToolName: null,
      log: [],
    }));

    set({
      isActive: true,
      isPanelOpen: true,
      isMinimized: false,
      phase: 'setup',
      selectedPhotoIds: photoIds,
      jobs,
      prompt: '',
      summary: null,
      startedAt: null,
      completedAt: null,
      expandedJobId: null,
    });
  },

  setPrompt: (prompt) => set({ prompt }),
  setParallelCount: (parallelCount) =>
    set({ parallelCount: Math.min(5, Math.max(1, parallelCount)) }),
  setModelId: (modelId) => set({ modelId }),

  addPhoto: (meta) =>
    set((s) => {
      if (s.phase !== 'setup') return s;
      if (s.selectedPhotoIds.includes(meta.id)) return s;
      return {
        selectedPhotoIds: [...s.selectedPhotoIds, meta.id],
        jobs: [
          ...s.jobs,
          {
            photoId: meta.id,
            fileName: meta.fileName,
            thumbnailUrl: meta.thumbnailUrl,
            status: 'queued' as const,
            agentIndex: null,
            startedAt: null,
            completedAt: null,
            error: null,
            thinking: '',
            lastToolName: null,
            log: [],
          },
        ],
      };
    }),

  removePhoto: (photoId) =>
    set((s) => {
      const selectedPhotoIds = s.selectedPhotoIds.filter((id) => id !== photoId);
      const jobs = s.jobs.filter((j) => j.photoId !== photoId);
      if (selectedPhotoIds.length === 0) {
        return { isActive: false, isPanelOpen: false, selectedPhotoIds, jobs };
      }
      const parallelCount = Math.min(s.parallelCount, selectedPhotoIds.length);
      return { selectedPhotoIds, jobs, parallelCount };
    }),

  startProcessing: () =>
    set({
      phase: 'processing',
      startedAt: Date.now(),
      completedAt: null,
      summary: null,
    }),

  stopAll: () => {
    window.electron?.bulkEdit?.stop();
  },

  minimize: () => set({ isMinimized: true, isPanelOpen: false }),
  restore: () => set({ isMinimized: false, isPanelOpen: true }),

  close: () =>
    set({
      isActive: false,
      isPanelOpen: false,
      isMinimized: false,
      phase: 'setup',
      selectedPhotoIds: [],
      jobs: [],
      prompt: '',
      summary: null,
      startedAt: null,
      completedAt: null,
      expandedJobId: null,
    }),

  updateJobStatus: (photoId, status, agentIndex) =>
    set((s) => {
      const updatedJobs = s.jobs.map((j) =>
        j.photoId === photoId
          ? {
              ...j,
              status,
              agentIndex: agentIndex ?? j.agentIndex,
              startedAt: status === 'processing' ? Date.now() : j.startedAt,
              completedAt:
                status === 'done' || status === 'error' || status === 'cancelled'
                  ? Date.now()
                  : j.completedAt,
              ...(status === 'done' || status === 'error' || status === 'cancelled'
                ? { lastToolName: null }
                : {}),
            }
          : j,
      );
      // Auto-expand first processing job if nothing is expanded
      const autoExpand = status === 'processing' && !s.expandedJobId ? photoId : s.expandedJobId;
      return { jobs: updatedJobs, expandedJobId: autoExpand };
    }),

  updateJobThinking: (photoId, text) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.photoId === photoId
          ? {
              ...j,
              thinking: text,
              log: [...j.log, { type: 'thinking' as const, text, timestamp: Date.now() }],
            }
          : j,
      ),
    })),

  updateJobToolUse: (photoId, name) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.photoId === photoId
          ? {
              ...j,
              lastToolName: name,
              log: [...j.log, { type: 'tool' as const, text: name, timestamp: Date.now() }],
            }
          : j,
      ),
    })),

  setAllDone: (summary) =>
    set({
      phase: 'complete',
      completedAt: Date.now(),
      summary,
    }),

  setExpandedJob: (expandedJobId) => set({ expandedJobId }),
}));
