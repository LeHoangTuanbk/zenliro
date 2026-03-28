export const LOG_MAX_SIZE = 5 * 1024 * 1024; // 5MB per file
export const LOG_MAX_FILES = 10;

export const IPC_RENDERER_LOG = 'logger:renderer-log';
export const IPC_RENDERER_CRASH = 'logger:renderer-crash';
export const IPC_EXPORT_LOGS = 'logger:export-logs';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export const LOG_LEVELS = ['error', 'warn', 'info', 'debug'] as const;
