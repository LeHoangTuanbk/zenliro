import { app, dialog, type BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';

export async function exportLogsToFile(mainWindow: BrowserWindow) {
  const logDir = app.getPath('logs');
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Logs',
    defaultPath: path.join(app.getPath('desktop'), `zenliro-logs-${Date.now()}.log`),
    filters: [{ name: 'Log Files', extensions: ['log', 'txt'] }],
  });

  if (result.canceled || !result.filePath) {
    return { saved: false };
  }

  const content = readAllLogs(logDir);
  fs.writeFileSync(result.filePath, content, 'utf-8');
  return { saved: true, filePath: result.filePath };
}

function readAllLogs(logDir: string): string {
  if (!fs.existsSync(logDir)) return '';

  const files = fs
    .readdirSync(logDir)
    .filter((f) => f.endsWith('.log'))
    .sort();

  return files
    .map((f) => {
      const content = fs.readFileSync(path.join(logDir, f), 'utf-8');
      return `--- ${f} ---\n${content}`;
    })
    .join('\n\n');
}
