import { BrowserWindow, ipcMain } from 'electron';
import { AGENT_RESPONSE_PREFIX } from './const.js';

let mainWindowRef: BrowserWindow | null = null;
let requestCounter = 0;

export function setMainWindow(win: BrowserWindow) {
  mainWindowRef = win;
}

export function requestFromRenderer<T>(
  channel: string,
  payload?: unknown,
  timeoutMs = 10_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!mainWindowRef || mainWindowRef.isDestroyed()) {
      return reject(new Error('Main window not available'));
    }

    const requestId = `${channel}-${++requestCounter}`;
    const responseChannel = `${AGENT_RESPONSE_PREFIX}${requestId}`;

    const timer = setTimeout(() => {
      ipcMain.removeAllListeners(responseChannel);
      reject(new Error(`Timeout waiting for ${channel}`));
    }, timeoutMs);

    ipcMain.once(responseChannel, (_event, result: T) => {
      clearTimeout(timer);
      resolve(result);
    });

    mainWindowRef.webContents.send(channel, { requestId, payload });
  });
}
