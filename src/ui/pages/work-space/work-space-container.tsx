import { useEffect, useRef, useState } from 'react';
import type { ImageCanvasHandle } from '@widgets/image-canvas/ui/image-canvas';
import { WorkSpaceView } from './ui/work-space-view';
import { ActiveTool } from '@features/develop/const';
import { usePhotos } from './hook/use-photos';
import { useHistogram } from './hook/use-histogram';
import { useHealInteraction } from './hook/use-heal-interaction';
import { useCropInteraction } from './hook/use-crop-interaction';
import { useMaskInteraction } from './hook/use-mask-interaction';
import { useExport } from './hook/use-export';
import { usePhotoEdits } from './hook/use-photo-edits';
import { useCatalogStore } from './store/catalog-store';
import { useMaskStore } from '@/features/develop/mask';
import type { Mask } from '@/features/develop/mask';

const EMPTY_MASKS: Mask[] = [];

export function WorkSpaceContainer() {
  const canvasRef = useRef<ImageCanvasHandle>(null);
  const [activeTool, setActiveTool] = useState<ActiveTool>(ActiveTool.Edit);
  const [showExport, setShowExport] = useState(false);

  const initFromDisk = useCatalogStore((s) => s.initFromDisk);
  useEffect(() => { initFromDisk(); }, [initFromDisk]);

  const {
    photos,
    selectedId,
    selected,
    imageAspect,
    activeView,
    setSelectedId,
    setActiveView,
    handleImport,
    handleImageLoaded,
    openDevelop,
  } = usePhotos();

  const { histogramData, exifData } = useHistogram(selected?.dataUrl, canvasRef);
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
      masks={masks}
      healSpots={healSpots}
      previewOriginal={previewOriginal}
      cropState={cropState}
      imageAspect={imageAspect}
      canvasRef={canvasRef}
      healInteractionProps={healInteractionProps}
      maskInteractionProps={maskInteractionProps}
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
