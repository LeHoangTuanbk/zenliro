import { useCallback, useMemo, useRef, useState } from 'react';
import { ImageCanvas, type ImageCanvasHandle } from './widgets/image-canvas/ui/image-canvas';
import { EditPanel } from './features/edit/ui/edit-panel';
import { HealPanel } from './features/heal/ui/heal-panel';
import { CropPanel } from './features/crop/ui/crop-panel';
import { ExportDialog, type ExportSettings } from './features/export/ui/export-dialog';
import { WebGLRenderer } from './features/edit/lib/webgl-renderer';
import { useAdjustmentsStore } from './features/edit/model/adjustments-store';
import { useHealStore } from './features/heal/model/heal-store';
import { useCropStore } from './features/crop/model/crop-store';
import type { ActiveTool, HealSpot } from './features/heal/model/types';
import './app.css';

const EMPTY_SPOTS: HealSpot[] = [];

const TOOLS: { id: ActiveTool; label: string }[] = [
  { id: 'edit', label: 'Edit' },
  { id: 'heal', label: 'Heal' },
  { id: 'crop', label: 'Crop' },
];

export default function App() {
  const [photos, setPhotos] = useState<ImportedPhoto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [activeTool, setActiveTool] = useState<ActiveTool>('edit');
  const canvasRef = useRef<ImageCanvasHandle>(null);

  const selected = photos.find((p) => p.id === selectedId) ?? null;

  // ── Heal store ─────────────────────────────────────────────────────────────
  const healStore = useHealStore();
  // Selector must return a stable reference when there are no spots for the photo,
  // otherwise Zustand triggers an infinite re-render loop.
  const healSpots = useHealStore((s) => (selectedId && s.spotsByPhoto[selectedId]) || EMPTY_SPOTS);
  const previewOriginal = useHealStore((s) => s.previewOriginal);
  const { selectedSpotId, brushSizePx, activeMode, feather, opacity } = healStore;

  // ── Crop store ─────────────────────────────────────────────────────────────
  const cropStore = useCropStore();
  const cropState = selectedId ? cropStore.getCrop(selectedId) : null;
  const imageAspect =
    selected && selected.width && selected.height ? selected.width / selected.height : 1;

  // ── Import ─────────────────────────────────────────────────────────────────
  const handleImport = useCallback(async () => {
    const imported = await window.electron.importPhotos();
    if (imported.length === 0) return;
    setPhotos((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      return [...prev, ...imported.filter((p) => !existingIds.has(p.id))];
    });
    setSelectedId(imported[0].id);
  }, []);

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExport = useCallback(
    async (settings: ExportSettings) => {
      if (!canvasRef.current) return;

      let exportW: number | undefined;
      let exportH: number | undefined;

      if (settings.resizeToFit && selected) {
        const dim = settings.resizeDimension;
        const w = selected.width || 2000;
        const h = selected.height || 2000;
        if (settings.resizeMode === 'long-edge') {
          const s = dim / Math.max(w, h);
          exportW = Math.round(w * s);
          exportH = Math.round(h * s);
        } else if (settings.resizeMode === 'short-edge') {
          const s = dim / Math.min(w, h);
          exportW = Math.round(w * s);
          exportH = Math.round(h * s);
        } else if (settings.resizeMode === 'width') {
          exportW = dim;
          exportH = Math.round(h * (dim / w));
        } else if (settings.resizeMode === 'height') {
          exportH = dim;
          exportW = Math.round(w * (dim / h));
        }
      }

      const activeCrop = selectedId ? useCropStore.getState().getCrop(selectedId) : null;
      const dataUrl = canvasRef.current.getExportDataUrl(
        settings.format,
        settings.quality / 100,
        exportW,
        exportH,
        activeCrop,
      );
      if (!dataUrl) return;

      const base64 = dataUrl.split(',')[1];
      await window.electron.exportPhoto({
        base64,
        mimeType: settings.format as ExportPhotoRequest['mimeType'],
        defaultName: selected?.fileName ?? 'export',
        destFolder: settings.exportFolder || undefined,
      });
    },
    [selected],
  );

  const handleImageLoaded = useCallback(
    (w: number, h: number) => {
      setPhotos((prev) =>
        prev.map((p) => (p.id === selectedId ? { ...p, width: w, height: h } : p)),
      );
    },
    [selectedId],
  );

  // ── Crop interaction props ─────────────────────────────────────────────────
  const cropInteractionProps = useMemo(() => {
    if (activeTool !== 'crop' || !selectedId || !cropState) return undefined;
    const pid = selectedId;
    return {
      cropState,
      imageAspect,
      onChange: (patch: Partial<typeof cropState>) => cropStore.setCrop(pid, patch),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, selectedId, cropState, imageAspect]);

  // ── Heal interaction props ─────────────────────────────────────────────────
  const healInteractionProps = useMemo(() => {
    if (activeTool !== 'heal' || !selectedId) return undefined;
    const pid = selectedId;
    return {
      spots: healSpots,
      selectedSpotId,
      brushSizePx,
      activeMode,
      feather,
      opacity,
      onSpotAdded: (spot: HealSpot) => healStore.addSpot(pid, spot),
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
    <div className="flex flex-col w-full h-screen bg-[#1a1a1a] text-[#929292] font-sans text-[11px]">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between h-10 px-3 bg-[#111] border-b border-black flex-shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="text-[13px] font-semibold text-[#f2f2f2] tracking-wide">Bright Room</span>
        <div
          className="flex items-center gap-2"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {selected && (
            <button
              className="px-3.5 py-1 text-[#7ec88a] bg-[#2e5533] border border-[#3a6b40] rounded-[3px] cursor-pointer hover:bg-[#38683f] transition-colors"
              onClick={() => setShowExport(true)}
            >
              Export
            </button>
          )}
          <button
            className="px-3.5 py-1 text-white bg-[#3d6fa5] rounded-[3px] cursor-pointer hover:bg-[#4d9fec] transition-colors"
            onClick={handleImport}
          >
            Import
          </button>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Filmstrip ───────────────────────────────────────────────────── */}
        <aside className="w-40 bg-[#292929] border-r border-black overflow-y-auto flex-shrink-0 flex flex-col gap-1 p-2">
          {photos.length === 0 && (
            <div className="text-center text-[#505050] py-5 text-[10px]">No photos</div>
          )}
          {photos.map((p) => (
            <button
              key={p.id}
              className={`bg-[#1a1a1a] border rounded-[2px] cursor-pointer p-0.5 flex flex-col items-center gap-1 transition-colors w-full ${
                p.id === selectedId ? 'border-[#4d9fec]' : 'border-transparent hover:border-[#555]'
              }`}
              onClick={() => setSelectedId(p.id)}
              title={p.fileName}
            >
              <img
                src={p.dataUrl}
                alt={p.fileName}
                className="w-full aspect-[3/2] object-cover rounded-[1px] block"
              />
              <span className="text-[9px] text-[#505050] truncate max-w-full">{p.fileName}</span>
            </button>
          ))}
        </aside>

        {/* ── Canvas ──────────────────────────────────────────────────────── */}
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

        {/* ── Right panel ─────────────────────────────────────────────────── */}
        <aside className="w-[260px] bg-[#222] border-l border-black flex flex-col flex-shrink-0">
          {/* Tool strip */}
          <div className="flex border-b border-black flex-shrink-0">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                className={`flex-1 py-2 text-[11px] font-semibold uppercase tracking-[0.6px] cursor-pointer border-none transition-colors ${
                  activeTool === t.id
                    ? 'bg-[#1a1a1a] text-[#f2f2f2] border-b-2 border-[#4d9fec]'
                    : 'bg-[#252525] text-[#505050] hover:text-[#929292]'
                }`}
                style={activeTool === t.id ? { borderBottom: '2px solid #4d9fec' } : {}}
                onClick={() => setActiveTool(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {activeTool === 'edit' && <EditPanel />}
            {activeTool === 'heal' && <HealPanel photoId={selectedId} />}
            {activeTool === 'crop' && (
              <CropPanel
                photoId={selectedId}
                imageAspect={imageAspect}
                onDone={() => setActiveTool('edit')}
              />
            )}
          </div>
        </aside>
      </div>

      {/* ── Export dialog ───────────────────────────────────────────────────── */}
      {showExport && selected && (
        <ExportDialog
          fileName={selected.fileName}
          originalW={selected.width}
          originalH={selected.height}
          fileCount={1}
          onExport={handleExport}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}

void WebGLRenderer;
void useAdjustmentsStore;
