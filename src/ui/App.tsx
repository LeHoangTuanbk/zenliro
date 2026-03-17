import { useCallback, useRef, useState } from 'react';
import { ImageCanvas, type ImageCanvasHandle } from './widgets/image-canvas/ui/image-canvas';
import { DevelopPanel } from './features/develop/ui/develop-panel';
import { ExportDialog, type ExportSettings } from './features/export/ui/export-dialog';
import { WebGLRenderer } from './features/develop/lib/webgl-renderer';
import { useAdjustmentsStore } from './features/develop/model/adjustments-store';
import './app.css';

export default function App() {
  const [photos, setPhotos]         = useState<ImportedPhoto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const canvasRef = useRef<ImageCanvasHandle>(null);

  const selected = photos.find((p) => p.id === selectedId) ?? null;

  const handleImport = useCallback(async () => {
    const imported = await window.electron.importPhotos();
    if (imported.length === 0) return;
    setPhotos((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      return [...prev, ...imported.filter((p) => !existingIds.has(p.id))];
    });
    setSelectedId(imported[0].id);
  }, []);

  const handleExport = useCallback(async (settings: ExportSettings) => {
    if (!canvasRef.current) return;

    let exportW: number | undefined;
    let exportH: number | undefined;

    if (settings.resizeToFit && selected) {
      const dim = settings.resizeDimension;
      const w = selected.width  || 2000;
      const h = selected.height || 2000;
      if (settings.resizeMode === 'long-edge') {
        const scale = dim / Math.max(w, h);
        exportW = Math.round(w * scale); exportH = Math.round(h * scale);
      } else if (settings.resizeMode === 'short-edge') {
        const scale = dim / Math.min(w, h);
        exportW = Math.round(w * scale); exportH = Math.round(h * scale);
      } else if (settings.resizeMode === 'width') {
        exportW = dim; exportH = Math.round(h * (dim / w));
      } else if (settings.resizeMode === 'height') {
        exportH = dim; exportW = Math.round(w * (dim / h));
      }
    }

    const dataUrl = canvasRef.current.getExportDataUrl(
      settings.format, settings.quality / 100, exportW, exportH,
    );
    if (!dataUrl) return;

    const base64 = dataUrl.split(',')[1];
    await window.electron.exportPhoto({
      base64,
      mimeType: settings.format as ExportPhotoRequest['mimeType'],
      defaultName: selected?.fileName ?? 'export',
      destFolder: settings.exportFolder || undefined,
    });
  }, [selected]);

  const handleImageLoaded = useCallback((w: number, h: number) => {
    setPhotos((prev) => prev.map((p) =>
      p.id === selectedId ? { ...p, width: w, height: h } : p,
    ));
  }, [selectedId]);

  return (
    <div className="flex flex-col w-full h-screen bg-[#1a1a1a] text-[#929292] font-sans text-[11px]">

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between h-10 px-3 bg-[#111] border-b border-black flex-shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="text-[13px] font-semibold text-[#f2f2f2] tracking-wide">Bright Room</span>
        <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
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
                p.id === selectedId
                  ? 'border-[#4d9fec]'
                  : 'border-transparent hover:border-[#555]'
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
            onImageLoaded={handleImageLoaded}
          />
        </main>

        {/* ── Develop panel ───────────────────────────────────────────────── */}
        <aside className="w-[260px] bg-[#222] border-l border-black overflow-y-auto flex-shrink-0 scrollbar-thin">
          <DevelopPanel />
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
