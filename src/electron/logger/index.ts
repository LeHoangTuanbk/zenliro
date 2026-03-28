export { initializeLogger, mainLogger } from './setup.js';
export { installMainCrashHandler, installRendererCrashHandler } from './crash-handler.js';
export { exportLogsToFile } from './export-logs.js';
export { IPC_RENDERER_LOG, IPC_RENDERER_CRASH, IPC_EXPORT_LOGS } from './constants.js';
export type { LogLevel } from './constants.js';

import { mainLogger } from './setup.js';

export function createLogger(scope: string) {
  return mainLogger.scope(scope);
}
