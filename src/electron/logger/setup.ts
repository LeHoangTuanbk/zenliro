import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const electronLog = require('electron-log/main') as typeof import('electron-log');
import { LOG_MAX_SIZE, LOG_MAX_FILES } from './constants.js';
import { isDev } from '../utils.js';

export function initializeLogger() {
  electronLog.initialize();

  // File transport
  electronLog.transports.file.maxSize = LOG_MAX_SIZE;

  electronLog.transports.file.format = ({ data, level, message }) => {
    const iso = message.date.toISOString();
    const scope = message.scope;
    const tag = scope ? `[${scope}]` : '';
    const text = data
      .map((d: unknown) => (typeof d === 'object' ? JSON.stringify(d) : String(d)))
      .join(' ');
    return [`[${iso}] [${level.toUpperCase()}] ${tag} ${text}`.trim()];
  };

  // Keep only N most recent files
  electronLog.transports.file.archiveLogFn = (oldLogFile: { path: string }) => {
    const dir = path.dirname(oldLogFile.path);

    const logFiles = fs
      .readdirSync(dir)
      .filter((f: string) => f.endsWith('.log'))
      .sort();

    while (logFiles.length >= LOG_MAX_FILES) {
      const oldest = logFiles.shift()!;
      fs.unlinkSync(path.join(dir, oldest));
    }

    const date = new Date().toISOString().split('T')[0];
    const archivePath = path.join(dir, `main-${date}.log`);
    fs.renameSync(oldLogFile.path, archivePath);
  };

  // Console transport: only in dev
  electronLog.transports.console.level = isDev() ? 'debug' : false;

  // File log level: info by default, debug if ZENLIRO_DEBUG=1
  electronLog.transports.file.level = process.env.ZENLIRO_DEBUG === '1' ? 'debug' : 'info';
}

export const mainLogger = electronLog;
