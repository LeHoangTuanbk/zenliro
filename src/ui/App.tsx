import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImageCanvas, type ImageCanvasHandle } from './widgets/image-canvas/ui/image-canvas';
import { LibraryView } from './widgets/library-view/ui/library-view';
import { EditPanel } from './features/edit/ui/edit-panel';
import { HealPanel } from './features/heal/ui/heal-panel';
import { CropPanel } from './features/crop/ui/crop-panel';
import { ExportDialog, type ExportSettings } from './features/export/ui/export-dialog';
import { useAdjustmentsStore } from './features/edit/model/adjustments-store';
import { useHealStore } from './features/heal/model/heal-store';
import { useCropStore } from './features/crop/model/crop-store';
import type { ActiveTool, HealSpot } from './features/heal/model/types';
import { ToolStrip } from './features/edit/ui/tool-strip';
import { Histogram } from './features/histogram/ui/histogram';
import { LibraryInfoPanel } from './features/histogram/ui/library-info-panel';
import { histogramFromDataUrl, computeHistogram, type HistogramData } from './features/histogram/lib/compute-histogram';
import { readExifFromDataUrl, type PhotoExif } from './features/histogram/lib/read-exif';
import './app.css';

const EMPTY_SPOTS: HealSpot[] = [];
type ActiveView = 'library' | 'develop';

export default function App() {
  const [photos, setPhotos]         = useState<ImportedPhoto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('library');
  const [showExport, setShowExport] = useState(false);
  const [activeTool, setActiveTool] = useState<ActiveTool>('edit');
  const canvasRef = useRef<ImageCanvasHandle>(null);

  const selected    = photos.find((p) => p.id === selectedId) ?? null;
  const imageAspect = selected?.width && selected?.height ? selected.width / selected.height : 1;

  const healStore       = useHealStore();
  const healSpots       = useHealStore((s) => (selectedId && s.spotsByPhoto[selectedId]) || EMPTY_SPOTS);
  const previewOriginal = useHealStore((s) => s.previewOriginal);
  const { selectedSpotId, brushSizePx, activeMode, feather, opacity } = healStore;

  const cropStore = useCropStore();
  const cropState = selectedId ? cropStore.getCrop(selectedId) : null;

  // ── Histogram + EXIF ───────────────────────────────────────────────────────
  const [histogramData, setHistogramData] = useState<HistogramData | null>(null);
  const [exifData, setExifData] = useState<PhotoExif | null>(null);
  const adjustments = useAdjustmentsStore((s) => s.adjustments);

  // Initial histogram from original pixels (fast, no adjustments applied yet)
  useEffect(() => {
    if (!selected?.dataUrl) { setHistogramData(null); setExifData(null); return; }
    let cancelled = false;
    histogramFromDataUrl(selected.dataUrl).then((d) => { if (!cancelled) setHistogramData(d); });
    readExifFromDataUrl(selected.dataUrl).then((e) => { if (!cancelled) setExifData(e); });
    return () => { cancelled = true; };
  }, [selected?.dataUrl]);

  // Update histogram from rendered WebGL canvas when adjustments change.
  // Child effects run before parent effects, so ImageCanvas has already re-rendered.
  useEffect(() => {
    const pixels = canvasRef.current?.getRenderedPixels();
    if (!pixels) return;
    setHistogramData(computeHistogram(pixels.data));
  // adjustments object changes on every slider move — that's our trigger
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleExport = useCallback(async (settings: ExportSettings) => {
    if (!canvasRef.current || !selected) return;
    const w = selected.width || 2000, h = selected.height || 2000;
    let exportW: number | undefined, exportH: number | undefined;
    if (settings.resizeToFit) {
      const d = settings.resizeDimension;
      if      (settings.resizeMode === 'long-edge')  { const s = d / Math.max(w, h); exportW = Math.round(w * s); exportH = Math.round(h * s); }
      else if (settings.resizeMode === 'short-edge') { const s = d / Math.min(w, h); exportW = Math.round(w * s); exportH = Math.round(h * s); }
      else if (settings.resizeMode === 'width')      { exportW = d; exportH = Math.round(h * (d / w)); }
      else if (settings.resizeMode === 'height')     { exportH = d; exportW = Math.round(w * (d / h)); }
    }
    const crop    = selectedId ? useCropStore.getState().getCrop(selectedId) : null;
    const dataUrl = canvasRef.current.getExportDataUrl(settings.format, settings.quality / 100, exportW, exportH, crop);
    if (!dataUrl) return;
    await window.electron.exportPhoto({ base64: dataUrl.split(',')[1], mimeType: settings.format as ExportPhotoRequest['mimeType'], defaultName: selected.fileName, destFolder: settings.exportFolder || undefined });
  }, [selected, selectedId]);

  const handleImageLoaded = useCallback((w: number, h: number) => {
    setPhotos((prev) => prev.map((p) => p.id === selectedId ? { ...p, width: w, height: h } : p));
  }, [selectedId]);

  const openDevelop = (id: string) => { setSelectedId(id); setActiveView('develop'); };

  const cropInteractionProps = useMemo(() => {
    if (activeTool !== 'crop' || !selectedId || !cropState) return undefined;
    const pid = selectedId;
    return { cropState, imageAspect, onChange: (patch: Partial<typeof cropState>) => cropStore.setCrop(pid, patch) };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, selectedId, cropState, imageAspect]);

  const healInteractionProps = useMemo(() => {
    if (activeTool !== 'heal' || !selectedId) return undefined;
    const pid = selectedId;
    return {
      spots: healSpots, selectedSpotId, brushSizePx, activeMode, feather, opacity,
      onSpotAdded:       (s: HealSpot)                  => healStore.addSpot(pid, s),
      onMoveSpotDst:     (id: string, nx: number, ny: number) => healStore.updateSpot(pid, id, { dst: { x: nx, y: ny } }),
      onMoveSpotSrc:     (id: string, nx: number, ny: number) => healStore.updateSpot(pid, id, { src: { x: nx, y: ny } }),
      onSelectSpot:      healStore.setSelectedSpotId,
      onDeleteSpot:      (id: string) => healStore.removeSpot(pid, id),
      onBrushSizeChange: healStore.setBrushSizePx,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, selectedId, healSpots, selectedSpotId, brushSizePx, activeMode, feather, opacity]);

  return (
    <div className="flex flex-col w-full h-screen bg-[#1a1a1a] text-[#929292] font-sans text-[11px]">
      {/* ── Title bar / Module tabs ─────────────────────────────────────────── */}
      <header
        className="flex items-center h-9 bg-[#111] border-b border-black flex-shrink-0 relative"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Logo */}
        <div className="w-44 px-3 flex items-center flex-shrink-0">
          <span className="text-[12px] font-semibold text-[#f2f2f2] tracking-wide">Bright Room</span>
        </div>

        {/* Module tabs — centered */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-0"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {(['library', 'develop'] as const).map((v, i) => (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              className={`px-4 h-9 text-[11px] font-medium tracking-wide cursor-pointer transition-colors border-none ${
                activeView === v
                  ? 'text-[#f2f2f2] bg-[#1a1a1a]'
                  : 'text-[#929292] bg-transparent hover:text-[#d0d0d0]'
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
              {i === 0 && <span className="ml-4 text-[#333]">|</span>}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="ml-auto pr-3 flex items-center gap-2 flex-shrink-0"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {selected && (
            <button className="px-3 py-1 text-[10px] text-[#7ec88a] bg-[#2e5533] border border-[#3a6b40] rounded-[3px] cursor-pointer hover:bg-[#38683f] transition-colors" onClick={() => setShowExport(true)}>
              Export
            </button>
          )}
        </div>
      </header>

      {/* ── Views ───────────────────────────────────────────────────────────── */}
      {activeView === 'library' && (
        <div className="flex flex-1 overflow-hidden">
          <LibraryView photos={photos} selectedId={selectedId} onSelect={setSelectedId} onImport={handleImport} onOpenDevelop={openDevelop} />
          {/* Right info panel — shown when a photo is selected */}
          {selected && (
            <aside className="w-[260px] bg-[#222] border-l border-black flex flex-col flex-shrink-0 overflow-y-auto">
              <LibraryInfoPanel photo={selected} histogramData={histogramData} exif={exifData} />
            </aside>
          )}
        </div>
      )}

      {activeView === 'develop' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Left filmstrip */}
          <aside className="w-[120px] bg-[#1a1a1a] border-r border-black flex flex-col flex-shrink-0">
            <button onClick={handleImport} className="mx-2 my-2 py-1 text-[10px] text-[#929292] bg-[#2a2a2a] border border-[#3a3a3a] rounded-[2px] cursor-pointer hover:text-[#f2f2f2] transition-colors">+ Add</button>
            <div className="flex-1 overflow-y-auto flex flex-col gap-1 px-1.5 pb-2">
              {photos.map((p) => (
                <button key={p.id} onClick={() => setSelectedId(p.id)}
                  className={`bg-[#111] rounded-[2px] overflow-hidden cursor-pointer border-2 transition-colors p-0 ${p.id === selectedId ? 'border-[#4d9fec]' : 'border-transparent hover:border-[#444]'}`}
                  title={p.fileName}
                >
                  <img src={p.dataUrl} alt={p.fileName} className="w-full aspect-[3/2] object-cover block" />
                </button>
              ))}
            </div>
          </aside>

          {/* Canvas */}
          <main className="flex-1 bg-[#111] flex items-center justify-center overflow-hidden">
            <ImageCanvas
              ref={canvasRef}
              dataUrl={selected?.dataUrl ?? null}
              healSpots={healSpots}
              hideOverlay={previewOriginal}
              healInteractionProps={healInteractionProps}
              cropInteractionProps={cropInteractionProps}
              confirmedCropState={activeTool !== 'crop' ? cropState : null}
              onImageLoaded={handleImageLoaded}
            />
          </main>

          {/* Right panel */}
          <aside className="w-[260px] bg-[#222] border-l border-black flex flex-col flex-shrink-0">
            <Histogram data={histogramData} exif={exifData} />
            <ToolStrip activeTool={activeTool} onSelect={setActiveTool} />
            <div className="flex-1 overflow-y-auto">
              {activeTool === 'edit'  && <EditPanel />}
              {activeTool === 'heal'  && <HealPanel photoId={selectedId} />}
              {activeTool === 'crop'  && <CropPanel photoId={selectedId} imageAspect={imageAspect} onDone={() => setActiveTool('edit')} />}
            </div>
          </aside>
        </div>
      )}

      {showExport && selected && (
        <ExportDialog fileName={selected.fileName} originalW={selected.width} originalH={selected.height} fileCount={1} onExport={handleExport} onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}

void useAdjustmentsStore;
