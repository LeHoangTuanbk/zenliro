import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAdjustmentsStore } from '@/features/develop/edit/model/adjustments-store';
import { useHealStore } from '@/features/develop/heal/model/heal-store';
import { useCropStore } from '@/features/develop/crop/model/crop-store';
import type { HealSpot } from '@/features/develop/heal/model/types';
import {
  histogramFromDataUrl,
  computeHistogram,
  type HistogramData,
} from '@features/histogram/lib/compute-histogram';
import { readExifFromDataUrl, type PhotoExif } from '@features/histogram/lib/read-exif';
import type { ExportSettings } from '@features/export/ui/export-dialog';
import type { ImageCanvasHandle } from '@widgets/image-canvas/ui/image-canvas';
import { WorkSpaceView } from './ui/work-space-view';
import { ActiveView } from './const';
import { ActiveTool } from '@features/develop/const';
const EMPTY_SPOTS: HealSpot[] = [];

export function WorkSpaceContainer() {
  const [photos, setPhotos] = useState<ImportedPhoto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>(ActiveView.Library);
  const [activeTool, setActiveTool] = useState<ActiveTool>(ActiveTool.Edit);
  const [showExport, setShowExport] = useState(false);
  const canvasRef = useRef<ImageCanvasHandle>(null);

  const selected = photos.find((p) => p.id === selectedId) ?? null;
  const imageAspect = selected?.width && selected?.height ? selected.width / selected.height : 1;

  const healStore = useHealStore();
  const healSpots = useHealStore((s) => (selectedId && s.spotsByPhoto[selectedId]) || EMPTY_SPOTS);
  const previewOriginal = useHealStore((s) => s.previewOriginal);
  const { selectedSpotId, brushSizePx, activeMode, feather, opacity } = healStore;

  const cropStore = useCropStore();
  const cropState = selectedId ? cropStore.getCrop(selectedId) : null;

  const [histogramData, setHistogramData] = useState<HistogramData | null>(null);
  const [exifData, setExifData] = useState<PhotoExif | null>(null);
  const adjustments = useAdjustmentsStore((s) => s.adjustments);

  useEffect(() => {
    if (!selected?.dataUrl) {
      setHistogramData(null);
      setExifData(null);
      return;
    }
    let cancelled = false;
    histogramFromDataUrl(selected.dataUrl).then((d) => {
      if (!cancelled) setHistogramData(d);
    });
    readExifFromDataUrl(selected.dataUrl).then((e) => {
      if (!cancelled) setExifData(e);
    });
    return () => {
      cancelled = true;
    };
  }, [selected?.dataUrl]);

  useEffect(() => {
    const pixels = canvasRef.current?.getRenderedPixels();
    if (!pixels) return;
    setHistogramData(computeHistogram(pixels.data));
  }, [adjustments]);
  const handleImport = useCallback(async () => {
    const imported = await window.electron.importPhotos();
    if (imported.length === 0) return;
    setPhotos((prev) => {
      const ids = new Set(prev.map((p) => p.id));
      return [...prev, ...imported.filter((p) => !ids.has(p.id))];
    });
    setSelectedId(imported[0].id);
  }, []);

  const handleExport = useCallback(
    async (settings: ExportSettings) => {
      if (!canvasRef.current || !selected) return;
      const w = selected.width || 2000,
        h = selected.height || 2000;
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
    [selected, selectedId],
  );

  const handleImageLoaded = useCallback(
    (w: number, h: number) => {
      setPhotos((prev) =>
        prev.map((p) => (p.id === selectedId ? { ...p, width: w, height: h } : p)),
      );
    },
    [selectedId],
  );

  const openDevelop = useCallback((id: string) => {
    setSelectedId(id);
    setActiveView(ActiveView.Develop);
  }, []);

  const cropInteractionProps = useMemo(() => {
    if (activeTool !== ActiveTool.Crop || !selectedId || !cropState) return undefined;
    const pid = selectedId;
    return {
      cropState,
      imageAspect,
      onChange: (patch: Partial<typeof cropState>) => cropStore.setCrop(pid, patch),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, selectedId, cropState, imageAspect]);

  const healInteractionProps = useMemo(() => {
    if (activeTool !== ActiveTool.Heal || !selectedId) return undefined;
    const pid = selectedId;
    return {
      spots: healSpots,
      selectedSpotId,
      brushSizePx,
      activeMode,
      feather,
      opacity,
      onSpotAdded: (s: HealSpot) => healStore.addSpot(pid, s),
      onMoveSpotDst: (id: string, nx: number, ny: number) =>
        healStore.updateSpot(pid, id, { dst: { x: nx, y: ny } }),
      onMoveSpotSrc: (id: string, nx: number, ny: number) =>
        healStore.updateSpot(pid, id, { src: { x: nx, y: ny } }),
      onSelectSpot: healStore.setSelectedSpotId,
      onDeleteSpot: (id: string) => healStore.removeSpot(pid, id),
      onBrushSizeChange: healStore.setBrushSizePx,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTool,
    selectedId,
    healSpots,
    selectedSpotId,
    brushSizePx,
    activeMode,
    feather,
    opacity,
  ]);

  return (
    <WorkSpaceView
      photos={photos}
      selectedId={selectedId}
      selected={selected}
      activeView={activeView}
      activeTool={activeTool}
      showExport={showExport}
      histogramData={histogramData}
      exifData={exifData}
      healSpots={healSpots}
      previewOriginal={previewOriginal}
      cropState={cropState}
      imageAspect={imageAspect}
      canvasRef={canvasRef}
      healInteractionProps={healInteractionProps}
      cropInteractionProps={cropInteractionProps}
      onImport={handleImport}
      onExport={handleExport}
      onImageLoaded={handleImageLoaded}
      onSelectId={setSelectedId}
      onOpenDevelop={openDevelop}
      onActiveViewChange={setActiveView}
      onActiveToolChange={setActiveTool}
      onShowExportChange={setShowExport}
    />
  );
}
