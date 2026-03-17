import { ipcMain, WebContents, WebFrameMain } from 'electron';
import { pathToFileURL } from 'url';
import { getUIPath } from './path-resolver.js';

export function isDev(): boolean {
  return process.env.NODE_ENV === 'development';
}

export function ipcMainHandle<T extends keyof EventPayloadMapping>(
  key: T,
  handler: () => EventPayloadMapping[T] | Promise<EventPayloadMapping[T]>,
) {
  ipcMain.handle(key, (event) => {
    validateEventFrame(event.senderFrame!);
    return handler();
  });
}

export function ipcWebContentsSend<Key extends keyof EventPayloadMapping>(
  key: Key,
  webContents: WebContents,
  payload: EventPayloadMapping[Key],
) {
  webContents.send(key, payload);
}

export function validateEventFrame(frame: WebFrameMain) {
  if (isDev() && new URL(frame.url).host === 'localhost:5173') {
    return;
  }
  if (frame.url !== pathToFileURL(getUIPath()).toString()) {
    throw new Error('Malicious event');
  }
}
