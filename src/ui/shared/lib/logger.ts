export function createRendererLogger(scope: string) {
  return {
    error: (msg: string, meta?: unknown) => window.electron.logger.error(scope, msg, meta),
    warn: (msg: string, meta?: unknown) => window.electron.logger.warn(scope, msg, meta),
    info: (msg: string, meta?: unknown) => window.electron.logger.info(scope, msg, meta),
    debug: (msg: string, meta?: unknown) => window.electron.logger.debug(scope, msg, meta),
  };
}
