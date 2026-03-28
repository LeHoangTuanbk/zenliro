import { Menu, app, type BrowserWindow } from 'electron';
import { exportLogsToFile } from './logger/index.js';

export function createMenu(mainWindow: BrowserWindow) {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    // ── App menu (macOS only) ──
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),

    // ── File ──
    {
      label: 'File',
      submenu: [
        {
          label: 'Import Photos',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => mainWindow.webContents.send('menu:import'),
        },
        {
          label: 'Export Photo',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => mainWindow.webContents.send('menu:export'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },

    // ── Edit ──
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => mainWindow.webContents.send('menu:action', 'undo'),
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: () => mainWindow.webContents.send('menu:action', 'redo'),
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
      ],
    },

    // ── View ──
    {
      label: 'View',
      submenu: [
        {
          label: 'Library',
          accelerator: 'G',
          click: () => mainWindow.webContents.send('menu:action', 'go-library'),
          registerAccelerator: false,
        },
        {
          label: 'Develop',
          accelerator: 'D',
          click: () => mainWindow.webContents.send('menu:action', 'go-develop'),
          registerAccelerator: false,
        },
        { type: 'separator' },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => mainWindow.webContents.send('menu:action', 'reset-zoom'),
        },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+=',
          click: () => mainWindow.webContents.send('menu:action', 'zoom-in'),
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => mainWindow.webContents.send('menu:action', 'zoom-out'),
        },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },

    // ── Window ──
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' as const }, { role: 'front' as const }]
          : [{ role: 'close' as const }]),
      ],
    },

    // ── Help ──
    {
      label: 'Help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+/',
          click: () => mainWindow.webContents.send('menu:action', 'shortcut-menu'),
        },
        { type: 'separator' },
        {
          label: 'Export Logs...',
          click: () => exportLogsToFile(mainWindow),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
