import { useState } from 'react';
import { useExportSettingsStore } from './store/export-settings-store';
import { ExportDialogView } from './ui/export-dialog-view';

export type ExportFormat = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/tiff';

export type ExportSettings = {
  exportFolder: string;
  putInSubfolder: boolean;
  subfolderName: string;
  namingTemplate: string;
  customText: string;
  startNumber: number;
  format: ExportFormat;
  quality: number;
  colorSpace: 'srgb' | 'argb';
  limitFileSize: boolean;
  maxFileSizeKb: number;
  resizeToFit: boolean;
  resizeMode: 'long-edge' | 'short-edge' | 'width' | 'height' | 'megapixels';
  resizeDimension: number;
  resizeUnit: 'px' | 'in' | 'cm';
  resolution: number;
  sharpen: boolean;
  sharpenFor: 'screen' | 'matte' | 'glossy';
  sharpenAmount: 'low' | 'standard' | 'high';
};

type Props = {
  fileName: string;
  originalW: number;
  originalH: number;
  fileCount?: number;
  onExport: (settings: ExportSettings) => Promise<void>;
  onClose: () => void;
};

export function ExportDialog({
  fileName,
  originalW,
  originalH,
  fileCount = 1,
  onExport,
  onClose,
}: Props) {
  const settings = useExportSettingsStore((s) => s.settings);
  const set = useExportSettingsStore((s) => s.set);
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await onExport(settings);
      setDone(true);
      setTimeout(onClose, 900);
    } finally {
      setExporting(false);
    }
  };

  return (
    <ExportDialogView
      fileName={fileName}
      originalW={originalW}
      originalH={originalH}
      fileCount={fileCount}
      settings={settings}
      exporting={exporting}
      done={done}
      set={set}
      onExport={handleExport}
      onClose={onClose}
    />
  );
}
