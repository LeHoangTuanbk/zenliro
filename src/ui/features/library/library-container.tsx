import { useCallback, useMemo, useState } from 'react';
import { LibraryView } from './ui/library-view';
import { DeleteConfirmDialog } from './ui/delete-confirm-dialog';
import { LibraryInfoPanel } from '@features/histogram/ui/library-info-panel';
import { useLibrary } from './hook/use-library';
import { useInfiniteScroll } from './hook/use-infinite-scroll';
import { useLibraryFilter } from './hook/use-library-filter';
import { useDragReorder } from './hook/use-drag-reorder';
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
  } = useLibrary();

  const filteredPhotos = useLibraryFilter(photos, catalogPhotos, filter);
  const { visibleCount, setSentinel } = useInfiniteScroll(filteredPhotos.length);
  const { activePhoto, handleDragStart, handleDragEnd, handleDragCancel } =
    useDragReorder(filteredPhotos, onReorder);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    catalogPhotos.forEach((p) => p.tags?.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [catalogPhotos]);

  const deleteTarget = photos.find((p) => p.id === deleteTargetId);
  const photoIds = useMemo(() => filteredPhotos.map((p) => p.id), [filteredPhotos]);

  const handleConfirmDelete = useCallback(() => {
    if (deleteTargetId) {
      onDelete(deleteTargetId);
      closeDeleteDialog();
    }
  }, [deleteTargetId, onDelete, closeDeleteDialog]);

  const handleConfirmBulkDelete = useCallback(async () => {
    await onBulkDelete(selectedIds);
    clearSelection();
    closeBulkDelete();
  }, [selectedIds, onBulkDelete, clearSelection, closeBulkDelete]);

  const onPhotoClick = useCallback((id: string, e: React.MouseEvent) => {
    handlePhotoClick(id, e, photoIds);
    // Also set the primary selection (for info panel) on normal click
    if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
      onSelect(id);
    }
  }, [handlePhotoClick, photoIds, onSelect]);

  return (
    <div className="flex flex-1 overflow-hidden">
      <LibraryView
        photos={filteredPhotos}
        catalogPhotos={catalogPhotos}
        importProgress={importProgress}
        selectedId={selectedId}
        selectedIds={selectedIds}
        isMetaHeld={isMetaHeld}
        filter={filter}
        allTags={allTags}
        visibleCount={visibleCount}
        totalCount={photos.length}
        filteredCount={filteredPhotos.length}
        activePhoto={activePhoto}
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
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
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
    </div>
  );
}
