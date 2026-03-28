import { dialog, clipboard, ipcMain, type BrowserWindow } from 'electron';
import { mainLogger } from './setup.js';
import { IPC_RENDERER_CRASH } from './constants.js';
import { validateEventFrame } from '../utils.js';

type RendererCrashReport = {
  message: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
};

export function installMainCrashHandler() {
  process.on('uncaughtException', (error) => {
    mainLogger.error('[CRASH] Uncaught exception:', error);
    showCrashDialog('Uncaught Exception', formatError(error));
  });

  process.on('unhandledRejection', (reason) => {
    mainLogger.error('[CRASH] Unhandled rejection:', reason);
    showCrashDialog('Unhandled Promise Rejection', formatError(reason));
  });
}

export function installRendererCrashHandler(mainWindow: BrowserWindow) {
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    mainLogger.error('[CRASH] Renderer process gone:', details);
    showCrashDialog('Renderer Process Crashed', `Reason: ${details.reason}\nExit code: ${details.exitCode}`);
  });

  ipcMain.handle(IPC_RENDERER_CRASH, (event, report: RendererCrashReport) => {
    validateEventFrame(event.senderFrame!);
    const detail = report.stack || report.message;
    mainLogger.error('[CRASH] Renderer error:', detail);
    showCrashDialog('Renderer Error', detail);
  });
}

function showCrashDialog(title: string, errorText: string) {
  const fullText = `${title}\n\n${errorText}`;
  const buttonIndex = dialog.showMessageBoxSync({
    type: 'error',
    title: `Zenliro — ${title}`,
    message: 'An unexpected error occurred.',
    detail: errorText,
    buttons: ['Copy Error & Close', 'Close'],
    defaultId: 0,
  });

  if (buttonIndex === 0) {
    clipboard.writeText(fullText);
  }
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.stack || err.message;
  return String(err);
}
