export const BULK_PHASE = {
  SETUP: 'setup',
  PROCESSING: 'processing',
  COMPLETE: 'complete',
} as const;

export type BulkPhase = (typeof BULK_PHASE)[keyof typeof BULK_PHASE];

export const JOB_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  DONE: 'done',
  ERROR: 'error',
  CANCELLED: 'cancelled',
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];
