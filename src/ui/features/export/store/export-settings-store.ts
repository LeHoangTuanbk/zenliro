import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ExportSettings } from '../export-dialog-container';

interface ExportSettingsStore {
  settings: ExportSettings;
  set: <K extends keyof ExportSettings>(key: K, val: ExportSettings[K]) => void;
}

const DEFAULT_SETTINGS: ExportSettings = {
  exportFolder: '~/Pictures',
  putInSubfolder: false,
  subfolderName: '',
  namingTemplate: 'filename-sequence',
  customText: '',
  startNumber: 1,
  format: 'image/jpeg',
  quality: 92,
  colorSpace: 'srgb',
  limitFileSize: false,
  maxFileSizeKb: 500,
  resizeToFit: false,
  resizeMode: 'long-edge',
  resizeDimension: 2048,
  resizeUnit: 'px',
  resolution: 300,
  sharpen: false,
  sharpenFor: 'screen',
  sharpenAmount: 'standard',
};

export const useExportSettingsStore = create<ExportSettingsStore>()(
  persist(
    (setStore) => ({
      settings: DEFAULT_SETTINGS,
      set: (key, val) => setStore((s) => ({ settings: { ...s.settings, [key]: val } })),
    }),
    { name: 'bright-room-export-settings' },
  ),
);
