import { useCallback, useEffect, useRef, useState } from 'react';
import type { ImageCanvasHandle } from '@widgets/image-canvas/ui/image-canvas';
import { WorkSpaceView } from './ui/work-space-view';
import { SplashScreen } from './ui/splash-screen';
import { ActiveTool } from '@features/develop/const';
import { usePhotos } from './hook/use-photos';
import { usePhotoResource } from './hook/use-photo-resource';
import { useHistogram } from './hook/use-histogram';
import { useHealInteraction } from './hook/use-heal-interaction';
import { useCropInteraction } from './hook/use-crop-interaction';
import { useMaskInteraction } from './hook/use-mask-interaction';
import { useExport } from './hook/use-export';
import { usePhotoEdits } from './hook/use-photo-edits';
import { useHistoryTracking } from '@features/develop/history';
import { useCatalogStore } from './store/catalog-store';
import { useMaskStore } from '@/features/develop/mask';
import type { Mask } from '@/features/develop/mask';
import { useAgentIpc } from '@/features/agent/hook/use-agent-ipc';

const EMPTY_MASKS: Mask[] = [];

export function WorkSpaceContainer() {
  const canvasRef = useRef<ImageCanvasHandle>(null);
  const [activeTool, setActiveTool] = useState<ActiveTool>(ActiveTool.Edit);
  const [showExport, setShowExport] = useState(false);

  const initFromDisk = useCatalogStore((s) => s.initFromDisk);
  const isLoaded = useCatalogStore((s) => s.isLoaded);
  const catalogPhotos = useCatalogStore((s) => s.photos);
  const setPhotoRating = useCatalogStore((s) => s.setPhotoRating);
  const saveToDisk = useCatalogStore((s) => s.saveToDisk);

  useEffect(() => { initFromDisk(); }, [initFromDisk]);

  const {
    photos,
    selectedId,
    selected,
    imageAspect,
    activeView,
    importProgress,
    setSelectedId,
    setActiveView,
    handleImport,
    handleImageLoaded,
    handleDelete,
    handleBulkDelete,
    handleReorder,
    openDevelop,
  } = usePhotos();

  const selectedResource = usePhotoResource(
    selected ? { id: selected.id, filePath: selected.filePath } : null,
  );

  const { histogramData, exifData } = useHistogram(
    activeView,
    selectedId,
    selected?.thumbnailDataUrl || null,
    selectedResource.imageBuffer,
    selectedResource.imageMimeType,
    canvasRef,
  );
  const { healInteractionProps, healSpots, previewOriginal } = useHealInteraction(
    activeTool,
    selectedId,
  );
  const { cropInteractionProps, cropState } = useCropInteraction(
    activeTool,
    selectedId,
    imageAspect,
  );
  const maskInteractionProps = useMaskInteraction(selectedId, activeTool);
  const masks = useMaskStore((s) => (selectedId ? (s.masksByPhoto[selectedId] ?? EMPTY_MASKS) : EMPTY_MASKS));

  const handleExport = useExport(selected, selectedId, canvasRef);
  usePhotoEdits(selectedId);
  useHistoryTracking(selectedId);
  useAgentIpc(canvasRef, selectedId, selected, exifData);

  const handleRatingChange = useCallback((id: string, rating: number) => {
    setPhotoRating(id, rating);
    saveToDisk();
  }, [setPhotoRating, saveToDisk]);

  if (!isLoaded) return <SplashScreen />;

  return (
    <WorkSpaceView
      photos={photos}
      catalogPhotos={catalogPhotos}
      selectedId={selectedId}
      selected={selected}
      selectedImageUrl={selectedResource.imageUrl}
      selectedImageBuffer={selectedResource.imageBuffer}
      selectedImageMimeType={selectedResource.imageMimeType}
      activeView={activeView}
      activeTool={activeTool}
      showExport={showExport}
      histogramData={histogramData}
      exifData={exifData}
      masks={masks}
      healSpots={healSpots}
      previewOriginal={previewOriginal}
      cropState={cropState}
      imageAspect={imageAspect}
      canvasRef={canvasRef}
      healInteractionProps={healInteractionProps}
      maskInteractionProps={maskInteractionProps}
      cropInteractionProps={cropInteractionProps}
      importProgress={importProgress}
      onImport={handleImport}
      onExport={handleExport}
      onImageLoaded={handleImageLoaded}
      onSelectId={setSelectedId}
      onOpenDevelop={openDevelop}
      onDelete={handleDelete}
      onBulkDelete={handleBulkDelete}
      onReorder={handleReorder}
      onRatingChange={handleRatingChange}
      onActiveViewChange={setActiveView}
      onActiveToolChange={setActiveTool}
      onShowExportChange={setShowExport}
    />
  );
}
