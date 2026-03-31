import { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import type { CollisionDetection } from '@dnd-kit/core';
import { useShortcut } from '@shared/lib/shortcuts';
import { LibraryView, DragOverlayCard, CollectionDragOverlay } from './ui/library-view';
import { DeleteConfirmDialog } from './ui/delete-confirm-dialog';
import { MoveToDialog } from './ui/move-to-dialog';
import { LibraryInfoPanel } from '@features/histogram/ui/library-info-panel';
import { BulkEditPanel } from '@features/bulk-edit/ui/bulk-edit-panel';
import { useLibrary } from './hook/use-library';
import { useInfiniteScroll } from './hook/use-infinite-scroll';
import { useLibraryFilter } from './hook/use-library-filter';
import { useDragReorder } from './hook/use-drag-reorder';
import { useCatalogStore } from '@/pages/work-space/store/catalog-store';
import { useBulkEditStore } from '@features/bulk-edit';
import { DEFAULT_FILTER } from './const/filter';
import type { LibraryFilter } from './const/filter';
import type { HistogramData } from '@features/histogram/lib/compute-histogram';
import type { PhotoExif } from '@features/histogram/lib/read-exif';
import type { ImportProgress } from '@/pages/work-space/hook/use-photos';

const ACTIVATION_CONSTRAINT = { distance: 8 };

/** Prioritize bulk-edit-drop zone when pointer is over it, otherwise use closestCenter */
const bulkEditAwareCollision: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const bulkHit = pointerCollisions.find((c) => c.id === 'bulk-edit-drop');
  if (bulkHit) return [bulkHit];
  return closestCenter(args);
};

function BulkEditDropWrapper({ onOpenDevelop }: { onOpenDevelop?: (id: string) => void }) {
  const isPanelOpen = useBulkEditStore((s) => s.isPanelOpen);
  const phase = useBulkEditStore((s) => s.phase);
  const { setNodeRef, isOver } = useDroppable({ id: 'bulk-edit-drop' });

  if (!isPanelOpen) return null;

  return (
    <div
      ref={phase === 'setup' ? setNodeRef : undefined}
      className={`shrink-0 transition-colors ${isOver && phase === 'setup' ? 'ring-1 ring-inset ring-[#c4a0ff]/50' : ''}`}
    >
      {isOver && phase === 'setup' && (
        <div className="h-6 flex items-center justify-center bg-[#c4a0ff]/10 border-t border-dashed border-[#c4a0ff]">
          <span className="text-[10px] text-[#c4a0ff]">Drop to add to bulk edit</span>
        </div>
      )}
      <BulkEditPanel onOpenDevelop={onOpenDevelop} />
    </div>
  );
}

type LibraryContainerProps = {
  photos: ImportedPhoto[];
  catalogPhotos: CatalogPhoto[];
  importProgress: ImportProgress;
  selectedId: string | null;
  selected: ImportedPhoto | null;
  histogramData: HistogramData | null;
  exifData: PhotoExif | null;
  onSelect: (id: string) => void;
  onImport: () => void;
  onOpenDevelop: (id: string) => void;
  onDelete: (id: string) => void;
  onBulkDelete: (ids: Set<string>) => Promise<void>;
  onReorder: (from: number, to: number) => void;
  onRatingChange: (id: string, rating: number) => void;
};

export function LibraryContainer({
  photos,
  catalogPhotos,
  importProgress,
  selectedId,
  selected,
  histogramData,
  exifData,
  onSelect,
  onImport,
  onOpenDevelop,
  onDelete,
  onBulkDelete,
  onReorder,
  onRatingChange,
}: LibraryContainerProps) {
  const [filter, setFilter] = useState<LibraryFilter>(DEFAULT_FILTER);

  // Collections
  const collections = useCatalogStore((s) => s.collections);
  const activeCollectionId = useCatalogStore((s) => s.activeCollectionId);
  const setActiveCollectionId = useCatalogStore((s) => s.setActiveCollectionId);
  const addCollection = useCatalogStore((s) => s.addCollection);
  const renameCollection = useCatalogStore((s) => s.renameCollection);
  const deleteCollection = useCatalogStore((s) => s.deleteCollection);
  const movePhotosToCollection = useCatalogStore((s) => s.movePhotosToCollection);
  const moveCollection = useCatalogStore((s) => s.moveCollection);
  const libraryOrder = useCatalogStore((s) => s.libraryOrder);
  const reorderLibrary = useCatalogStore((s) => s.reorderLibrary);
  const reorderInsideCollection = useCatalogStore((s) => s.reorderInsideCollection);
  const saveToDisk = useCatalogStore((s) => s.saveToDisk);

  // Filter photos for current level, preserving collection's photoIds order
  const collectionFilteredPhotos = useMemo(() => {
    if (activeCollectionId) {
      const col = collections.find((c) => c.id === activeCollectionId);
      if (!col) return photos;
      const photoMap = new Map(photos.map((p) => [p.id, p]));
      return col.photoIds.map((id) => photoMap.get(id)).filter(Boolean) as ImportedPhoto[];
    }
    // Root: show only photos not in any collection
    const allCollectionPhotoIds = new Set<string>();
    collections.forEach((c) => c.photoIds.forEach((pid) => allCollectionPhotoIds.add(pid)));
    return photos.filter((p) => !allCollectionPhotoIds.has(p.id));
  }, [photos, activeCollectionId, collections]);

  const filteredPhotos = useLibraryFilter(collectionFilteredPhotos, catalogPhotos, filter);
  const photoIds = useMemo(() => filteredPhotos.map((p) => p.id), [filteredPhotos]);

  const {
    deleteTargetId,
    selectedIds,
    showBulkDelete,
    openDeleteDialog,
    closeDeleteDialog,
    handlePhotoClick,
    clearSelection,
    openBulkDelete,
    closeBulkDelete,
    isMetaHeld,
  } = useLibrary({ photoIds });

  const { visibleCount, setSentinel } = useInfiniteScroll(filteredPhotos.length);
  const {
    activeId: activeDragId,
    activePhoto,
    handleDragStart,
    handleDragCancel,
  } = useDragReorder(filteredPhotos, onReorder);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: ACTIVATION_CONSTRAINT }),
  );

  const allTags = useMemo(() => {
    const set = new Set<string>();
    catalogPhotos.forEach((p) => p.tags?.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [catalogPhotos]);

  // Collection handlers
  const handleCollectionClick = useCallback(
    (id: string) => {
      setActiveCollectionId(id === '__root__' ? null : id);
      saveToDisk();
    },
    [setActiveCollectionId, saveToDisk],
  );

  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);

  const handleCollectionCreate = useCallback(() => {
    const id = addCollection('New Collection', activeCollectionId);
    setEditingCollectionId(id);
    saveToDisk();
  }, [addCollection, activeCollectionId, saveToDisk]);

  useShortcut([{ id: 'library.new-collection', handler: handleCollectionCreate }]);

  const handleCollectionRename = useCallback(
    (id: string, name: string) => {
      renameCollection(id, name);
      saveToDisk();
    },
    [renameCollection, saveToDisk],
  );

  // Move dialogs
  const [movePhotoIds, setMovePhotoIds] = useState<string[] | null>(null);
  const [moveCollectionId, setMoveCollectionId] = useState<string | null>(null);

  const handleOpenMove = useCallback(
    (photoId: string) => {
      const ids =
        selectedIds.size > 0 && selectedIds.has(photoId) ? Array.from(selectedIds) : [photoId];
      setMovePhotoIds(ids);
    },
    [selectedIds],
  );

  const handleConfirmMove = useCallback(
    (targetId: string | null) => {
      if (movePhotoIds) {
        movePhotosToCollection(movePhotoIds, targetId);
        saveToDisk();
        setMovePhotoIds(null);
      }
    },
    [movePhotoIds, movePhotosToCollection, saveToDisk],
  );

  const handleConfirmMoveCollection = useCallback(
    (targetId: string | null) => {
      if (moveCollectionId) {
        moveCollection(moveCollectionId, targetId);
        saveToDisk();
        setMoveCollectionId(null);
      }
    },
    [moveCollectionId, moveCollection, saveToDisk],
  );

  const [deleteCollectionTarget, setDeleteCollectionTarget] = useState<string | null>(null);
  const deleteCollectionName = deleteCollectionTarget
    ? (collections.find((c) => c.id === deleteCollectionTarget)?.name ?? '')
    : '';

  const handleConfirmCollectionDelete = useCallback(() => {
    if (deleteCollectionTarget) {
      deleteCollection(deleteCollectionTarget);
      saveToDisk();
      setDeleteCollectionTarget(null);
    }
  }, [deleteCollectionTarget, deleteCollection, saveToDisk]);

  // Unified drag end: reorder in libraryOrder, or add photo/collection to collection
  const handleDragEndWithCollections = useCallback(
    (event: import('@dnd-kit/core').DragEndEvent) => {
      const activeId = event.active.id as string;
      const overId = event.over?.id as string | undefined;
      if (!overId || activeId === overId) {
        handleDragCancel();
        return;
      }

      // Photo dropped onto bulk edit drop zone
      if (overId === 'bulk-edit-drop' && !activeId.startsWith('collection:')) {
        const photo = photos.find((p) => p.id === activeId);
        if (photo) {
          useBulkEditStore.getState().addPhoto({
            id: activeId,
            fileName: photo.fileName,
            thumbnailUrl: photo.thumbnailDataUrl ?? '',
          });
        }
        handleDragCancel();
        return;
      }

      const isActiveCollection = activeId.startsWith('collection:');
      const isOverCollection = overId.startsWith('collection:');

      if (isActiveCollection && isOverCollection) {
        const srcId = activeId.replace('collection:', '');
        const dstId = overId.replace('collection:', '');
        moveCollection(srcId, dstId);
        saveToDisk();
        handleDragCancel();
        return;
      }

      if (!isActiveCollection && isOverCollection) {
        const collectionId = overId.replace('collection:', '');
        const photoIdsToMove =
          selectedIds.size > 0 && selectedIds.has(activeId) ? Array.from(selectedIds) : [activeId];
        movePhotosToCollection(photoIdsToMove, collectionId);
        saveToDisk();
        handleDragCancel();
        return;
      }

      if (activeCollectionId && !isActiveCollection && !isOverCollection) {
        reorderInsideCollection(activeCollectionId, activeId, overId);
        saveToDisk();
        handleDragCancel();
        return;
      }

      if (!activeCollectionId) {
        reorderLibrary(activeId, overId);
        saveToDisk();
      }
      handleDragCancel();
    },
    [
      handleDragCancel,
      selectedIds,
      activeCollectionId,
      movePhotosToCollection,
      moveCollection,
      reorderLibrary,
      reorderInsideCollection,
      saveToDisk,
      photos,
    ],
  );

  const handleBulkAiEdit = useCallback(() => {
    const ids = Array.from(selectedIds);
    const photoMeta = ids.map((id) => {
      const photo = photos.find((p) => p.id === id);
      const catalogPhoto = catalogPhotos.find((p) => p.id === id);
      return {
        id,
        fileName: photo?.fileName ?? catalogPhoto?.fileName ?? id,
        thumbnailUrl: photo?.thumbnailDataUrl ?? '',
      };
    });
    useBulkEditStore.getState().openSetup(ids, photoMeta);
  }, [selectedIds, photos, catalogPhotos]);

  useShortcut([{ id: 'library.bulk-edit', handler: handleBulkAiEdit }]);

  const deleteTarget = photos.find((p) => p.id === deleteTargetId);

  const handleConfirmDelete = useCallback(() => {
    if (deleteTargetId) {
      closeDeleteDialog();
      onDelete(deleteTargetId);
    }
  }, [deleteTargetId, onDelete, closeDeleteDialog]);

  const handleConfirmBulkDelete = useCallback(async () => {
    closeBulkDelete();
    await onBulkDelete(selectedIds);
    clearSelection();
  }, [selectedIds, onBulkDelete, clearSelection, closeBulkDelete]);

  const onPhotoClick = useCallback(
    (id: string, e: React.MouseEvent) => {
      const bulkState = useBulkEditStore.getState();
      if (bulkState.isPanelOpen && bulkState.phase === 'setup') {
        if (bulkState.selectedPhotoIds.includes(id)) {
          bulkState.removePhoto(id);
        } else {
          const photo = photos.find((p) => p.id === id);
          if (photo) {
            bulkState.addPhoto({
              id,
              fileName: photo.fileName,
              thumbnailUrl: photo.thumbnailDataUrl ?? '',
            });
          }
        }
        return;
      }

      handlePhotoClick(id, e, photoIds);
      if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
        onSelect(id);
      }
    },
    [handlePhotoClick, photoIds, onSelect, photos],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={bulkEditAwareCollision}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEndWithCollections}
      onDragCancel={handleDragCancel}
    >
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top row: grid + info panel */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <LibraryView
            photos={filteredPhotos}
            catalogPhotos={catalogPhotos}
            collections={collections}
            libraryOrder={libraryOrder}
            activeCollectionId={activeCollectionId}
            importProgress={importProgress}
            selectedId={selectedId}
            selectedIds={selectedIds}
            isMetaHeld={isMetaHeld}
            filter={filter}
            allTags={allTags}
            visibleCount={visibleCount}
            totalCount={collectionFilteredPhotos.length}
            filteredCount={filteredPhotos.length}
            setSentinel={setSentinel}
            onPhotoClick={onPhotoClick}
            onImport={onImport}
            onOpenDevelop={onOpenDevelop}
            onDelete={openDeleteDialog}
            onBulkDelete={openBulkDelete}
            onClearSelection={clearSelection}
            onFilterChange={setFilter}
            onRatingChange={onRatingChange}
            onCollectionClick={handleCollectionClick}
            onCollectionCreate={handleCollectionCreate}
            onCollectionRename={handleCollectionRename}
            onCollectionDelete={setDeleteCollectionTarget}
            onMovePhoto={handleOpenMove}
            onMoveCollection={setMoveCollectionId}
            editingCollectionId={editingCollectionId}
            onEditingDone={() => setEditingCollectionId(null)}
            onBulkAiEdit={handleBulkAiEdit}
          />
          {selected && (
            <aside className="w-[260px] bg-[#222] border-l border-black flex flex-col shrink-0 overflow-y-auto">
              <LibraryInfoPanel photo={selected} histogramData={histogramData} exif={exifData} />
            </aside>
          )}
        </div>

        {/* Bulk edit panel — full width at bottom */}
        <BulkEditDropWrapper onOpenDevelop={onOpenDevelop} />
      </div>

      {/* DragOverlay — no drop animation (prevents snap-back on bulk edit drop) */}
      <DragOverlay dropAnimation={null}>
        {activePhoto ? (
          <DragOverlayCard photo={activePhoto} />
        ) : activeDragId?.startsWith('collection:') ? (
          <CollectionDragOverlay
            collection={collections.find((c) => `collection:${c.id}` === activeDragId) ?? null}
          />
        ) : null}
      </DragOverlay>

      {/* Dialogs */}
      {deleteTarget && (
        <DeleteConfirmDialog
          count={1}
          fileName={deleteTarget.fileName}
          open={!!deleteTargetId}
          onConfirm={handleConfirmDelete}
          onCancel={closeDeleteDialog}
        />
      )}
      {showBulkDelete && selectedIds.size > 0 && (
        <DeleteConfirmDialog
          count={selectedIds.size}
          open={showBulkDelete}
          onConfirm={handleConfirmBulkDelete}
          onCancel={closeBulkDelete}
        />
      )}
      {deleteCollectionTarget && (
        <DeleteConfirmDialog
          count={1}
          fileName={deleteCollectionName}
          open={!!deleteCollectionTarget}
          onConfirm={handleConfirmCollectionDelete}
          onCancel={() => setDeleteCollectionTarget(null)}
          collectionMode
        />
      )}
      {movePhotoIds && (
        <MoveToDialog
          open={!!movePhotoIds}
          photoCount={movePhotoIds.length}
          collections={collections}
          currentCollectionId={activeCollectionId}
          onMove={handleConfirmMove}
          onCancel={() => setMovePhotoIds(null)}
        />
      )}
      {moveCollectionId && (
        <MoveToDialog
          open={!!moveCollectionId}
          photoCount={0}
          collectionName={collections.find((c) => c.id === moveCollectionId)?.name}
          collections={collections}
          currentCollectionId={moveCollectionId}
          onMove={handleConfirmMoveCollection}
          onCancel={() => setMoveCollectionId(null)}
        />
      )}
    </DndContext>
  );
}
