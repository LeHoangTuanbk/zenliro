import { useCallback, type RefObject } from 'react';
import { useCropStore } from '@/features/develop/crop/store/crop-store';
import type { ExportSettings } from '@/features/export/export-dialog-container';
import type { ImageCanvasHandle } from '@widgets/image-canvas/ui/image-canvas';
import { createRendererLogger } from '@shared/lib/logger';

const log = createRendererLogger('export');

export function useExport(
  selected: ImportedPhoto | null,
  selectedId: string | null,
  canvasRef: RefObject<ImageCanvasHandle | null>,
) {
  return useCallback(
    async (settings: ExportSettings) => {
      if (!canvasRef.current || !selected) {
        log.error('No canvas or photo selected');
        return;
      }
      try {
        const w = selected.width || 2000;
        const h = selected.height || 2000;
        let exportW: number | undefined, exportH: number | undefined;
        if (settings.resizeToFit) {
          const d = settings.resizeDimension;
          if (settings.resizeMode === 'long-edge') {
            const s = d / Math.max(w, h);
            exportW = Math.round(w * s);
            exportH = Math.round(h * s);
          } else if (settings.resizeMode === 'short-edge') {
            const s = d / Math.min(w, h);
            exportW = Math.round(w * s);
            exportH = Math.round(h * s);
          } else if (settings.resizeMode === 'width') {
            exportW = d;
            exportH = Math.round(h * (d / w));
          } else if (settings.resizeMode === 'height') {
            exportH = d;
            exportW = Math.round(w * (d / h));
          }
        }
        const crop = selectedId ? useCropStore.getState().getCrop(selectedId) : null;
        const dataUrl = canvasRef.current.getExportDataUrl(
          settings.format,
          settings.quality / 100,
          exportW,
          exportH,
          crop,
        );
        if (!dataUrl) {
          log.error('Failed to generate data URL');
          return;
        }
        log.info(`Exporting: ${selected.fileName} (${settings.format})`);
        await window.electron.exportPhoto({
          base64: dataUrl.split(',')[1],
          mimeType: settings.format as ExportPhotoRequest['mimeType'],
          defaultName: selected.fileName,
          customText: settings.customText || undefined,
          namingTemplate: settings.namingTemplate as ExportPhotoRequest['namingTemplate'],
          startNumber: settings.startNumber,
          destFolder: settings.exportFolder || undefined,
        });
        log.info('Export complete');
      } catch (err) {
        log.error('Export failed', err);
        throw err;
      }
    },
    [selected, selectedId, canvasRef],
  );
}
