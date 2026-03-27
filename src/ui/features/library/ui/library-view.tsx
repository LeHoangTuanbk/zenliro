import { BrButton } from '@/shared/ui/base';
import { LibraryPhotoCard, DragOverlayCard } from './library-photo-card';
import { LibraryToolbar } from './library-toolbar';
import { ImportProgressOverlay } from './import-progress-overlay';
import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import type { LibraryFilter } from '../const/filter';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import type { ImportProgress } from '@/pages/work-space/hook/use-photos';

type LibraryViewProps = {
  photos: ImportedPhoto[];
  catalogPhotos: CatalogPhoto[];
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
};

const ACTIVATION_CONSTRAINT = { distance: 8 };

export function LibraryView({
  photos,
  catalogPhotos,
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
}: LibraryViewProps) {
  const visiblePhotos = photos.slice(0, visibleCount);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: ACTIVATION_CONSTRAINT }));
  const hasMultiSelection = selectedIds.size > 0 || isMetaHeld;

  return (
    <div className="relative flex flex-col w-full h-full bg-br-bg">
      <LibraryToolbar
        filter={filter}
        photoCount={totalCount}
        filteredCount={filteredCount}
        selectedCount={selectedIds.size}
        allTags={allTags}
        onFilterChange={onFilterChange}
        onImport={onImport}
        onBulkDelete={onBulkDelete}
        onClearSelection={onClearSelection}
      />

      {photos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-br-dim select-none">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <p className="text-[13px]">{totalCount === 0 ? 'No photos yet' : 'No photos match filters'}</p>
          {totalCount === 0 && (
            <BrButton variant="primary" size="md" className="px-5 py-2 text-[12px]" onClick={onImport}>
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
            <div data-library-grid className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
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
            </div>
            {visibleCount < photos.length && (
              <div ref={setSentinel} className="h-4" />
            )}
          </div>
          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
            {activePhoto ? <DragOverlayCard photo={activePhoto} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <ImportProgressOverlay progress={importProgress} />
    </div>
  );
}
