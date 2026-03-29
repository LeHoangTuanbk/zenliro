import { BrButton } from '@/shared/ui/base';
import { LibraryPhotoCard, DragOverlayCard } from './library-photo-card';
import { CollectionCard, CollectionDragOverlay } from './collection-card';
import { LibraryToolbar } from './library-toolbar';
import { ImportProgressOverlay } from './import-progress-overlay';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { ChevronRight } from 'lucide-react';
import type { LibraryFilter } from '../const/filter';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import type { ImportProgress } from '@/pages/work-space/hook/use-photos';

type LibraryViewProps = {
  photos: ImportedPhoto[];
  catalogPhotos: CatalogPhoto[];
  collections: Collection[];
  libraryOrder: string[];
  activeCollectionId: string | null;
  importProgress: ImportProgress;
  selectedId: string | null;
  selectedIds: Set<string>;
  isMetaHeld: boolean;
  filter: LibraryFilter;
  allTags: string[];
  visibleCount: number;
  totalCount: number;
  filteredCount: number;
  activePhoto: ImportedPhoto | null;
  activeDragId: string | null;
  setSentinel: (node: HTMLDivElement | null) => void;
  onPhotoClick: (id: string, e: React.MouseEvent) => void;
  onImport: () => void;
  onOpenDevelop: (id: string) => void;
  onDelete: (id: string) => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
  onFilterChange: (filter: LibraryFilter) => void;
  onRatingChange: (id: string, rating: number) => void;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: () => void;
  onCollectionClick: (id: string) => void;
  onCollectionBack: () => void;
  onCollectionCreate: () => void;
  onCollectionRename: (id: string, name: string) => void;
  onCollectionDelete: (id: string) => void;
};

const ACTIVATION_CONSTRAINT = { distance: 8 };

export function LibraryView({
  photos,
  catalogPhotos,
  collections,
  libraryOrder,
  activeCollectionId,
  importProgress,
  selectedId,
  selectedIds,
  isMetaHeld,
  filter,
  allTags,
  visibleCount,
  totalCount,
  filteredCount,
  activePhoto,
  activeDragId,
  setSentinel,
  onPhotoClick,
  onImport,
  onOpenDevelop,
  onDelete,
  onBulkDelete,
  onClearSelection,
  onFilterChange,
  onRatingChange,
  onDragStart,
  onDragEnd,
  onDragCancel,
  onCollectionClick,
  onCollectionBack,
  onCollectionCreate,
  onCollectionRename,
  onCollectionDelete,
}: LibraryViewProps) {
  const visiblePhotos = photos.slice(0, visibleCount);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: ACTIVATION_CONSTRAINT }),
  );
  const hasMultiSelection = selectedIds.size > 0 || isMetaHeld;
  const activeCollection = activeCollectionId
    ? (collections.find((c) => c.id === activeCollectionId) ?? null)
    : null;
  const isRoot = !activeCollectionId;

  // Build lookup maps
  const photoMap = new Map(photos.map((p) => [p.id, p]));
  const collectionMap = new Map(collections.map((c) => [c.id, c]));

  // Get first photo thumbnail for a collection
  const getCollectionThumbnail = (col: Collection): string | null => {
    if (col.photoIds.length === 0) return null;
    const firstPhoto = photoMap.get(col.photoIds[0]);
    return firstPhoto?.thumbnailDataUrl || null;
  };

  const hasContent = photos.length > 0 || (isRoot && collections.length > 0);
  const isEmpty = !hasContent;

  return (
    <div className="relative flex flex-col w-full h-full bg-br-bg">
      <LibraryToolbar
        filter={filter}
        photoCount={totalCount}
        filteredCount={filteredCount}
        selectedCount={selectedIds.size}
        allTags={allTags}
        onFilterChange={onFilterChange}
        onBulkDelete={onBulkDelete}
        onClearSelection={onClearSelection}
        onCollectionCreate={onCollectionCreate}
      />

      {/* Breadcrumb */}
      {activeCollection && (
        <div className="flex items-center gap-1 px-4 py-1.5 text-[11px] border-b border-[#222]">
          <button
            onClick={onCollectionBack}
            className="text-[#888] hover:text-[#ccc] cursor-pointer transition-colors"
          >
            Library
          </button>
          <ChevronRight className="w-3 h-3 text-[#555]" />
          <span className="text-[#ccc]">{activeCollection.name}</span>
          <span className="text-[#555] ml-1">({activeCollection.photoIds.length})</span>
        </div>
      )}

      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-br-dim select-none">
          <svg
            width="56"
            height="56"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <p className="text-[13px]">
            {totalCount === 0 ? 'No photos yet' : 'No photos match filters'}
          </p>
          {totalCount === 0 && (
            <BrButton
              variant="primary"
              size="md"
              className="px-5 py-2 text-[12px]"
              onClick={onImport}
            >
              Import Photos
            </BrButton>
          )}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <div className="flex-1 overflow-y-auto p-4">
            <div
              data-library-grid
              className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3"
            >
              {isRoot ? (
                <>
                  {/* Root: render items in libraryOrder (collections + photos interleaved) */}
                  {libraryOrder.map((entry) => {
                    if (entry.startsWith('collection:')) {
                      const colId = entry.replace('collection:', '');
                      const col = collectionMap.get(colId);
                      if (!col) return null;
                      return (
                        <CollectionCard
                          key={entry}
                          collection={col}
                          photoCount={col.photoIds.length}
                          thumbnail={getCollectionThumbnail(col)}
                          onClick={() => onCollectionClick(col.id)}
                          onRename={(name) => onCollectionRename(col.id, name)}
                          onDelete={() => onCollectionDelete(col.id)}
                        />
                      );
                    }
                    const photo = photoMap.get(entry);
                    if (!photo) return null;
                    const catPhoto = catalogPhotos.find((c) => c.id === photo.id);
                    return (
                      <LibraryPhotoCard
                        key={photo.id}
                        photo={photo}
                        isSelected={photo.id === selectedId}
                        isMultiSelected={selectedIds.has(photo.id)}
                        hasMultiSelection={hasMultiSelection}
                        rating={catPhoto?.rating ?? 0}
                        onClick={(e) => onPhotoClick(photo.id, e)}
                        onOpenDevelop={() => onOpenDevelop(photo.id)}
                        onDelete={() => onDelete(photo.id)}
                        onRatingChange={(val) => onRatingChange(photo.id, val)}
                      />
                    );
                  })}
                </>
              ) : (
                <>
                  {/* Inside collection: show only its photos */}
                  {visiblePhotos.map((p) => {
                    const catPhoto = catalogPhotos.find((c) => c.id === p.id);
                    return (
                      <LibraryPhotoCard
                        key={p.id}
                        photo={p}
                        isSelected={p.id === selectedId}
                        isMultiSelected={selectedIds.has(p.id)}
                        hasMultiSelection={hasMultiSelection}
                        rating={catPhoto?.rating ?? 0}
                        onClick={(e) => onPhotoClick(p.id, e)}
                        onOpenDevelop={() => onOpenDevelop(p.id)}
                        onDelete={() => onDelete(p.id)}
                        onRatingChange={(val) => onRatingChange(p.id, val)}
                      />
                    );
                  })}
                </>
              )}
            </div>
            {visibleCount < photos.length && <div ref={setSentinel} className="h-4" />}
          </div>
          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
            {activePhoto ? (
              <DragOverlayCard photo={activePhoto} />
            ) : activeDragId?.startsWith('collection:') ? (
              <CollectionDragOverlay
                collection={collections.find((c) => `collection:${c.id}` === activeDragId) ?? null}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <ImportProgressOverlay progress={importProgress} />
    </div>
  );
}
