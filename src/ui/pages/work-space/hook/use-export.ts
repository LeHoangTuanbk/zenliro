import { useCallback, type RefObject } from 'react';
import { useCropStore } from '@/features/develop/crop/store/crop-store';
import type { ExportSettings } from '@/features/export/export-dialog-container';
import type { ImageCanvasHandle } from '@widgets/image-canvas/ui/image-canvas';

export function useExport(
  selected: ImportedPhoto | null,
  selectedId: string | null,
  canvasRef: RefObject<ImageCanvasHandle | null>,
) {
  return useCallback(
    async (settings: ExportSettings) => {
      if (!canvasRef.current || !selected) return;
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
      if (!dataUrl) return;
      await window.electron.exportPhoto({
        base64: dataUrl.split(',')[1],
        mimeType: settings.format as ExportPhotoRequest['mimeType'],
        defaultName: selected.fileName,
        destFolder: settings.exportFolder || undefined,
      });
    },
    [selected, selectedId, canvasRef],
  );
}
