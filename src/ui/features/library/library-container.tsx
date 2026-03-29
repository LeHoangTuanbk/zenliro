import { useCallback, useMemo, useState } from 'react';
import { useShortcut } from '@shared/lib/shortcuts';
import { LibraryView } from './ui/library-view';
import { DeleteConfirmDialog } from './ui/delete-confirm-dialog';
import { MoveToDialog } from './ui/move-to-dialog';
import { LibraryInfoPanel } from '@features/histogram/ui/library-info-panel';
import { useLibrary } from './hook/use-library';
import { useInfiniteScroll } from './hook/use-infinite-scroll';
import { useLibraryFilter } from './hook/use-library-filter';
import { useDragReorder } from './hook/use-drag-reorder';
import { useCatalogStore } from '@/pages/work-space/store/catalog-store';
import { DEFAULT_FILTER } from './const/filter';
import type { LibraryFilter } from './const/filter';
import type { HistogramData } from '@features/histogram/lib/compute-histogram';
import type { PhotoExif } from '@features/histogram/lib/read-exif';
import type { ImportProgress } from '@/pages/work-space/hook/use-photos';

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

      const isActiveCollection = activeId.startsWith('collection:');
      const isOverCollection = overId.startsWith('collection:');

      // Collection dropped onto another collection → move into it
      if (isActiveCollection && isOverCollection) {
        const srcId = activeId.replace('collection:', '');
        const dstId = overId.replace('collection:', '');
        moveCollection(srcId, dstId);
        saveToDisk();
        handleDragCancel();
        return;
      }

      // Photo dropped onto collection → move to that collection
      if (!isActiveCollection && isOverCollection) {
        const collectionId = overId.replace('collection:', '');
        const photoIdsToMove =
          selectedIds.size > 0 && selectedIds.has(activeId) ? Array.from(selectedIds) : [activeId];
        movePhotosToCollection(photoIdsToMove, collectionId);
        saveToDisk();
        handleDragCancel();
        return;
      }

      // Inside a collection: reorder photos within that collection
      if (activeCollectionId && !isActiveCollection && !isOverCollection) {
        reorderInsideCollection(activeCollectionId, activeId, overId);
        saveToDisk();
        handleDragCancel();
        return;
      }

      // Root level: reorder anything (collections, photos, mixed)
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
    ],
  );

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
      handlePhotoClick(id, e, photoIds);
      // Also set the primary selection (for info panel) on normal click
      if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
        onSelect(id);
      }
    },
    [handlePhotoClick, photoIds, onSelect],
  );

  return (
    <div className="flex flex-1 overflow-hidden">
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
        activePhoto={activePhoto}
        activeDragId={activeDragId}
        setSentinel={setSentinel}
        onPhotoClick={onPhotoClick}
        onImport={onImport}
        onOpenDevelop={onOpenDevelop}
        onDelete={openDeleteDialog}
        onBulkDelete={openBulkDelete}
        onClearSelection={clearSelection}
        onFilterChange={setFilter}
        onRatingChange={onRatingChange}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEndWithCollections}
        onDragCancel={handleDragCancel}
        onCollectionClick={handleCollectionClick}
        onCollectionCreate={handleCollectionCreate}
        onCollectionRename={handleCollectionRename}
        onCollectionDelete={setDeleteCollectionTarget}
        onMovePhoto={handleOpenMove}
        onMoveCollection={setMoveCollectionId}
        editingCollectionId={editingCollectionId}
        onEditingDone={() => {
          setEditingCollectionId(null);
        }}
      />
      {selected && (
        <aside className="w-[260px] bg-[#222] border-l border-black flex flex-col shrink-0 overflow-y-auto">
          <LibraryInfoPanel photo={selected} histogramData={histogramData} exif={exifData} />
        </aside>
      )}

      {/* Single delete dialog */}
      {deleteTarget && (
        <DeleteConfirmDialog
          count={1}
          fileName={deleteTarget.fileName}
          open={!!deleteTargetId}
          onConfirm={handleConfirmDelete}
          onCancel={closeDeleteDialog}
        />
      )}

      {/* Bulk delete dialog */}
      {showBulkDelete && selectedIds.size > 0 && (
        <DeleteConfirmDialog
          count={selectedIds.size}
          open={showBulkDelete}
          onConfirm={handleConfirmBulkDelete}
          onCancel={closeBulkDelete}
        />
      )}

      {/* Collection delete dialog */}
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

      {/* Move photo dialog */}
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

      {/* Move collection dialog */}
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
    </div>
  );
}
