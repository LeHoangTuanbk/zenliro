import { useCallback, useRef, useState } from 'react';
import { ImageCanvas, type ImageCanvasHandle } from './widgets/image-canvas/ui/image-canvas';
import { DevelopPanel } from './features/develop/ui/develop-panel';
import { ExportDialog, type ExportSettings } from './features/export/ui/export-dialog';
import { WebGLRenderer } from './features/develop/lib/webgl-renderer';
import { useAdjustmentsStore } from './features/develop/model/adjustments-store';
import './app.css';

export default function App() {
  const [photos, setPhotos]     = useState<ImportedPhoto[]>([]);
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

    // Determine export dimensions
    let exportW: number | undefined;
    let exportH: number | undefined;

    if (settings.resizeToFit && selected) {
      const dim = settings.resizeDimension;
      const w = selected.width  || 2000;
      const h = selected.height || 2000;
      if (settings.resizeMode === 'long-edge') {
        const scale = dim / Math.max(w, h);
        exportW = Math.round(w * scale);
        exportH = Math.round(h * scale);
      } else if (settings.resizeMode === 'short-edge') {
        const scale = dim / Math.min(w, h);
        exportW = Math.round(w * scale);
        exportH = Math.round(h * scale);
      } else if (settings.resizeMode === 'width') {
        exportW = dim;
        exportH = Math.round(h * (dim / w));
      } else if (settings.resizeMode === 'height') {
        exportH = dim;
        exportW = Math.round(w * (dim / h));
      }
    }

    const dataUrl = canvasRef.current.getExportDataUrl(
      settings.format,
      settings.quality / 100,
      exportW,
      exportH,
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

  // Sync selected photo width/height from actual loaded image
  const handleImageLoaded = useCallback((w: number, h: number) => {
    setPhotos((prev) => prev.map((p) =>
      p.id === selectedId ? { ...p, width: w, height: h } : p
    ));
  }, [selectedId]);

  return (
    <div className="lr-app">
      {/* ── Top toolbar ─────────────────────────────────── */}
      <header className="lr-toolbar">
        <span className="lr-logo">Bright Room</span>
        <div className="toolbar-actions">
          {selected && (
            <button className="btn-export" onClick={() => setShowExport(true)}>
              Export
            </button>
          )}
          <button className="btn-import" onClick={handleImport}>
            Import
          </button>
        </div>
      </header>

      <div className="lr-body">
        {/* ── Left filmstrip ──────────────────────────────── */}
        <aside className="lr-filmstrip">
          {photos.length === 0 && (
            <div className="filmstrip-empty">No photos</div>
          )}
          {photos.map((p) => (
            <button
              key={p.id}
              className={`film-thumb ${p.id === selectedId ? 'selected' : ''}`}
              onClick={() => setSelectedId(p.id)}
              title={p.fileName}
            >
              <img src={p.dataUrl} alt={p.fileName} />
              <span className="film-name">{p.fileName}</span>
            </button>
          ))}
        </aside>

        {/* ── Center canvas ───────────────────────────────── */}
        <main className="lr-center">
          <ImageCanvas
            ref={canvasRef}
            dataUrl={selected?.dataUrl ?? null}
            onImageLoaded={handleImageLoaded}
          />
        </main>

        {/* ── Right develop panel ─────────────────────────── */}
        <aside className="lr-right">
          <DevelopPanel />
        </aside>
      </div>

      {/* ── Export dialog ───────────────────────────────── */}
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

// Silence unused import warning — WebGLRenderer used via canvasRef.getExportDataUrl
void WebGLRenderer;
void useAdjustmentsStore;
