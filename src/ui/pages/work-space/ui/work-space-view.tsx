import { memo, useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { ImageCanvas, type ImageCanvasHandle } from '@widgets/image-canvas/ui/image-canvas';
import { LibraryContainer } from '@features/library';
import { EditPanel, ToolStrip } from '@/features/develop/edit';
import { HealPanel } from '@/features/develop/heal/ui/heal-panel';
import { CropPanel } from '@/features/develop/crop/ui/crop-panel';
import { ExportDialog, type ExportSettings } from '@/features/export/export-dialog-container';
import { Histogram } from '@features/histogram/ui/histogram';
import type { HealSpot } from '@/features/develop/heal/store/types';
import { ActiveTool } from '@features/develop/const';
import type { CropState } from '@/features/develop/crop/store/types';
import type {
  HealInteractionProps,
  CropInteractionProps,
} from '@widgets/image-canvas/ui/image-canvas';
import type { HistogramData } from '@features/histogram/lib/compute-histogram';
import type { PhotoExif } from '@features/histogram/lib/read-exif';
import type { ActiveView } from '../const';
import { CanvasMode } from '../const';
import { CompareBeforePanel, useCompareStore } from '@features/develop/compare';
import type { ExternalZoomPan, MaskInteractionProps } from '@widgets/image-canvas/ui/image-canvas';
import { MaskPanel } from '@/features/develop/mask/ui/mask-panel';
import type { Mask } from '@/features/develop/mask';
import { CanvasToolbar } from './canvas-toolbar';
import { HistoryPanel } from '@features/develop/history';
import type { ImportProgress } from '../hook/use-photos';

type FilmstripItemProps = {
  photo: ImportedPhoto;
  isSelected: boolean;
  onSelectId: (id: string) => void;
  registerRef: (node: HTMLButtonElement | null) => void;
};

const FilmstripItem = memo(function FilmstripItem({
  photo,
  isSelected,
  onSelectId,
  registerRef,
}: FilmstripItemProps) {
  const imgSrc = photo.thumbnailDataUrl;

  return (
    <button
      ref={registerRef}
      onClick={() => onSelectId(photo.id)}
      className={`bg-[#111] rounded-[2px] overflow-hidden cursor-pointer border-2 transition-colors p-0 shrink-0 ${
        isSelected
          ? 'border-br-accent'
          : 'border-transparent hover:border-[#444]'
      }`}
      title={photo.fileName}
    >
      {imgSrc ? (
        <img
          src={imgSrc}
          alt={photo.fileName}
          className="w-full object-contain block"
          loading="eager"
          decoding="async"
        />
      ) : (
        <div className="w-full aspect-[3/4] bg-[#1a1a1a]" />
      )}
    </button>
  );
}, (prev, next) => (
  prev.isSelected === next.isSelected &&
  prev.photo.id === next.photo.id &&
  prev.photo.fileName === next.photo.fileName &&
  prev.photo.thumbnailDataUrl === next.photo.thumbnailDataUrl
));

export type WorkSpaceViewProps = {
  photos: ImportedPhoto[];
  catalogPhotos: CatalogPhoto[];
  importProgress: ImportProgress;
  selectedId: string | null;
  selected: ImportedPhoto | null;
  activeView: ActiveView;
  activeTool: ActiveTool;
  showExport: boolean;
  histogramData: HistogramData | null;
  exifData: PhotoExif | null;
  healSpots: HealSpot[];
  previewOriginal: boolean;
  cropState: CropState | null;
  imageAspect: number;
  canvasRef: RefObject<ImageCanvasHandle | null>;
  masks: Mask[];
  healInteractionProps: HealInteractionProps | undefined;
  maskInteractionProps: MaskInteractionProps | undefined;
  cropInteractionProps: CropInteractionProps | undefined;
  onImport: () => void;
  onExport: (settings: ExportSettings) => Promise<void>;
  onImageLoaded: (w: number, h: number) => void;
  onSelectId: (id: string) => void;
  onOpenDevelop: (id: string) => void;
  onDelete: (id: string) => void;
  onBulkDelete: (ids: Set<string>) => Promise<void>;
  onReorder: (from: number, to: number) => void;
  onRatingChange: (id: string, rating: number) => void;
  onActiveViewChange: (v: ActiveView) => void;
  onActiveToolChange: (t: ActiveTool) => void;
  onShowExportChange: (show: boolean) => void;
};

export function WorkSpaceView({
  photos,
  catalogPhotos,
  importProgress,
  selectedId,
  selected,
  activeView,
  activeTool,
  showExport,
  histogramData,
  exifData,
  masks,
  healSpots,
  previewOriginal,
  cropState,
  imageAspect,
  canvasRef,
  healInteractionProps,
  maskInteractionProps,
  cropInteractionProps,
  onImport,
  onExport,
  onImageLoaded,
  onSelectId,
  onOpenDevelop,
  onDelete,
  onBulkDelete,
  onReorder,
  onRatingChange,
  onActiveViewChange,
  onActiveToolChange,
  onShowExportChange,
}: WorkSpaceViewProps) {
  const isCompareMode = useCompareStore((s) => s.isCompareMode);
  const toggleCompare = useCompareStore((s) => s.toggle);
  const compareZoom = useCompareStore((s) => s.zoom);
  const comparePan = useCompareStore((s) => s.pan);
  const setZoomPan = useCompareStore((s) => s.setZoomPan);
  const filmstripRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());

  const externalZoomPan: ExternalZoomPan = {
    zoom: compareZoom,
    pan: comparePan,
    onChange: setZoomPan,
  };

  useEffect(() => {
    if (activeView !== 'develop' || !selectedId) return;
    const container = filmstripRef.current;
    const selectedItem = itemRefs.current.get(selectedId);
    if (!container || !selectedItem) return;

    const containerRect = container.getBoundingClientRect();
    const itemRect = selectedItem.getBoundingClientRect();
    const isAbove = itemRect.top < containerRect.top;
    const isBelow = itemRect.bottom > containerRect.bottom;

    if (isAbove || isBelow) {
      selectedItem.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [activeView, selectedId]);

  return (
    <div className="flex flex-col w-full h-screen bg-[#1a1a1a] text-[#929292] font-sans text-[11px]">
      {/* ── Title bar ────────────────────────────────────────────────────────── */}
      <header
        className="flex items-center h-9 bg-[#111] border-b border-black flex-shrink-0 relative"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="w-44 px-3 flex items-center flex-shrink-0">
          <span className="text-lg font-bold text-[#f2f2f2] tracking-wide">Zenliro</span>
        </div>

        {/* Module tabs */}
        <div
          className="absolute left-1/2 -translate-x-1/2 flex items-center"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {(['library', 'develop'] as const).map((v, i) => (
            <button
              key={v}
              onClick={() => onActiveViewChange(v)}
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

        {/* Export action */}
        <div
          className="ml-auto pr-3 flex items-center gap-2 flex-shrink-0"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {selected && (
            <button
              className="px-3 py-1 text-[10px] text-[#7ec88a] bg-[#2e5533] border border-[#3a6b40] rounded-[3px] cursor-pointer hover:bg-[#38683f] transition-colors"
              onClick={() => onShowExportChange(true)}
            >
              Export
            </button>
          )}
        </div>
      </header>

      {/* ── Library view ─────────────────────────────────────────────────────── */}
      {activeView === 'library' && (
        <LibraryContainer
          photos={photos}
          catalogPhotos={catalogPhotos}
          importProgress={importProgress}
          selectedId={selectedId}
          selected={selected}
          histogramData={histogramData}
          exifData={exifData}
          onSelect={onSelectId}
          onImport={onImport}
          onOpenDevelop={onOpenDevelop}
          onDelete={onDelete}
          onBulkDelete={onBulkDelete}
          onReorder={onReorder}
          onRatingChange={onRatingChange}
        />
      )}

      {/* ── Develop view ─────────────────────────────────────────────────────── */}
      {activeView === 'develop' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Left filmstrip */}
          <aside className="w-[180px] bg-br-bg border-r border-black flex flex-col shrink-0">
            <button
              onClick={onImport}
              className="mx-2 my-2 py-1 text-[10px] text-br-muted bg-br-input border border-br-elevated rounded-[2px] cursor-pointer hover:text-br-text transition-colors"
            >
              + Add
            </button>
            <div
              ref={filmstripRef}
              className="flex-1 overflow-y-auto flex flex-col gap-1 px-1.5 pb-2"
            >
              {photos.map((p) => (
                <FilmstripItem
                  key={p.id}
                  photo={p}
                  isSelected={p.id === selectedId}
                  onSelectId={onSelectId}
                  registerRef={(node) => {
                    if (node) itemRefs.current.set(p.id, node);
                    else itemRefs.current.delete(p.id);
                  }}
                />
              ))}
            </div>
            <div className="border-t border-black shrink-0">
              <HistoryPanel photoId={selectedId} />
            </div>
          </aside>

          {/* Canvas + toolbar */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <main className="relative flex-1 bg-[#111] flex overflow-hidden">
              {/* Before panel — only shown in compare mode */}
              {isCompareMode && (
                <CompareBeforePanel
                  dataUrl={selected?.dataUrl ?? null}
                  externalZoomPan={externalZoomPan}
                />
              )}

              {/* After / single — ImageCanvas always mounted to preserve WebGL context */}
              <div className="relative flex-1 overflow-hidden flex items-center justify-center">
                {isCompareMode && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 px-2 py-0.5 bg-black/50 text-br-muted text-[10px] tracking-wider rounded-[2px] select-none pointer-events-none">
                    After
                  </div>
                )}
                <ImageCanvas
                  ref={canvasRef}
                  photoId={selectedId}
                  dataUrl={selected?.dataUrl ?? null}
                  orientation={selected?.orientation}
                  masks={masks}
                  healSpots={healSpots}
                  hideOverlay={previewOriginal}
                  healInteractionProps={healInteractionProps}
                  maskInteractionProps={maskInteractionProps}
                  cropInteractionProps={cropInteractionProps}
                  confirmedCropState={activeTool !== ActiveTool.Crop ? cropState : null}
                  externalZoomPan={isCompareMode ? externalZoomPan : undefined}
                  onImageLoaded={onImageLoaded}
                />
              </div>
            </main>

            {selected && (
              <CanvasToolbar
                activeMode={isCompareMode ? CanvasMode.Compare : CanvasMode.Loupe}
                onModeChange={(mode) => {
                  if (mode === CanvasMode.Compare && !isCompareMode) toggleCompare();
                  if (mode === CanvasMode.Loupe && isCompareMode) toggleCompare();
                }}
              />
            )}
          </div>

          {/* Right panel */}
          <aside className="w-[260px] bg-[#222] border-l border-black flex flex-col flex-shrink-0">
            <Histogram data={histogramData} exif={exifData} />
            <ToolStrip activeTool={activeTool} onSelect={onActiveToolChange} />
            <div className="flex-1 overflow-y-auto">
              {activeTool === ActiveTool.Edit && <EditPanel />}
              {activeTool === ActiveTool.Heal && <HealPanel photoId={selectedId} />}
              {activeTool === ActiveTool.Mask && <MaskPanel photoId={selectedId} />}
              {activeTool === ActiveTool.Crop && (
                <CropPanel
                  photoId={selectedId}
                  imageAspect={imageAspect}
                  onDone={() => onActiveToolChange(ActiveTool.Edit)}
                />
              )}
            </div>
          </aside>
        </div>
      )}

      {/* ── Export dialog ─────────────────────────────────────────────────────── */}
      {showExport && selected && (
        <ExportDialog
          fileName={selected.fileName}
          originalW={selected.width}
          originalH={selected.height}
          fileCount={1}
          onExport={onExport}
          onClose={() => onShowExportChange(false)}
        />
      )}
    </div>
  );
}
