import { memo } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Trash2, Check, FolderInput } from 'lucide-react';
import { StarRating } from './star-rating';

type LibraryPhotoCardProps = {
  photo: ImportedPhoto;
  isSelected: boolean;
  isMultiSelected: boolean;
  hasMultiSelection: boolean;
  isDragOverlay?: boolean;
  rating: number;
  onClick: (e: React.MouseEvent) => void;
  onOpenDevelop: () => void;
  onDelete: () => void;
  onMove: () => void;
  onRatingChange: (rating: number) => void;
};

function LibraryPhotoCardInner({
  photo,
  isSelected,
  isMultiSelected,
  hasMultiSelection,
  isDragOverlay,
  rating,
  onClick,
  onOpenDevelop,
  onDelete,
  onMove,
  onRatingChange,
}: LibraryPhotoCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({ id: photo.id, disabled: isDragOverlay });

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: photo.id });

  const imgSrc = photo.thumbnailDataUrl || null;
  const highlighted = isSelected || isMultiSelected;

  return (
    <div
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      {...listeners}
      {...attributes}
      data-photo-id={photo.id}
      onClick={onClick}
      onDoubleClick={onOpenDevelop}
      className={`group relative bg-br-bg-deep rounded-[2px] overflow-hidden cursor-pointer border-2 transition-colors text-left ${
        isDragging
          ? 'opacity-30'
          : isOver
            ? 'border-br-accent border-dashed'
            : highlighted
              ? 'border-br-accent'
              : 'border-transparent hover:border-br-border-hover'
      }`}
      title={`${photo.fileName} — double-click to edit`}
    >
      {imgSrc ? (
        <img
          src={imgSrc}
          alt={photo.fileName}
          className="w-full aspect-3/2 object-cover block"
          loading="lazy"
        />
      ) : (
        <div className="w-full aspect-3/2 bg-[#161616]" />
      )}

      {/* Bottom info bar */}
      <div className="px-1.5 py-1 bg-br-bg-deep flex flex-col gap-0.5">
        <p className="text-[9px] text-br-label truncate">{photo.fileName}</p>
        {/* Star rating — always visible on hover, shown if rated */}
        <div
          className={`transition-opacity ${rating > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <StarRating value={rating} onChange={onRatingChange} size="sm" />
        </div>
      </div>

      {/* Multi-select checkbox */}
      {(isMultiSelected || hasMultiSelection) && (
        <div
          className={`absolute top-1 right-1 w-4 h-4 rounded-[2px] flex items-center justify-center transition-colors ${
            isMultiSelected ? 'bg-[#4d9fec]' : 'bg-black/40 border border-white/30'
          }`}
        >
          {isMultiSelected && <Check className="w-3 h-3 text-white" />}
        </div>
      )}

      {/* Hover overlay — actions */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 pointer-events-none">
        <span className="text-[10px] text-white">Double-click to edit</span>
        <div
          className="flex items-center gap-1.5 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMove();
            }}
            className="p-1 rounded-[2px] text-white/60 hover:text-white cursor-pointer"
            title="Move to collection"
          >
            <FolderInput className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 rounded-[2px] text-white/60 hover:text-red-400 cursor-pointer"
            title="Remove from catalog"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

export const LibraryPhotoCard = memo(
  LibraryPhotoCardInner,
  (prev, next) =>
    prev.photo.id === next.photo.id &&
    prev.photo.fileName === next.photo.fileName &&
    prev.photo.thumbnailDataUrl === next.photo.thumbnailDataUrl &&
    prev.isSelected === next.isSelected &&
    prev.isMultiSelected === next.isMultiSelected &&
    prev.hasMultiSelection === next.hasMultiSelection &&
    prev.rating === next.rating,
);

export function DragOverlayCard({ photo }: { photo: ImportedPhoto }) {
  const imgSrc = photo.thumbnailDataUrl || null;
  return (
    <div className="bg-br-bg-deep rounded-[2px] overflow-hidden border-2 border-br-accent shadow-lg opacity-90 w-[160px]">
      {imgSrc ? (
        <img src={imgSrc} alt={photo.fileName} className="w-full aspect-3/2 object-cover block" />
      ) : (
        <div className="w-full aspect-3/2 bg-[#161616]" />
      )}
      <div className="px-1.5 py-1 bg-br-bg-deep">
        <p className="text-[9px] text-br-label truncate">{photo.fileName}</p>
      </div>
    </div>
  );
}
