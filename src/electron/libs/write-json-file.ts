import fs from 'fs/promises';

const queues = new Map<string, Promise<void>>();

/**
 * Write JSON without blocking the main process (which also routes renderer input).
 * Writes to the same path are serialized and land atomically via temp file + rename.
 */
export function writeJsonFile(filePath: string, data: unknown, space?: number): Promise<void> {
  const previous = queues.get(filePath) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      const tmpPath = `${filePath}.tmp`;
      await fs.writeFile(tmpPath, JSON.stringify(data, null, space), 'utf-8');
      await fs.rename(tmpPath, filePath);
    });
  queues.set(filePath, next);
  void next.finally(() => {
    if (queues.get(filePath) === next) queues.delete(filePath);
  });
  return next;
}
