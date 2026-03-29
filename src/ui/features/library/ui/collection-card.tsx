import { memo, useState, useRef, useEffect } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Folder, Trash2, Pencil, FolderInput } from 'lucide-react';

type CollectionCardProps = {
  collection: Collection;
  photoCount: number;
  childCount: number;
  autoEdit?: boolean;
  onEditingDone?: () => void;
  onClick: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onMove?: () => void;
};

function CollectionCardInner({
  collection,
  photoCount,
  childCount,
  autoEdit,
  onEditingDone,
  onClick,
  onRename,
  onDelete,
  onMove,
}: CollectionCardProps) {
  const [isEditing, setIsEditing] = useState(!!autoEdit);
  const [editName, setEditName] = useState(collection.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({ id: `collection:${collection.id}` });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `collection:${collection.id}` });

  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  const handleSubmitRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== collection.name) onRename(trimmed);
    else setEditName(collection.name);
    setIsEditing(false);
    onEditingDone?.();
  };

  return (
    <div
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      {...listeners}
      {...attributes}
      onDoubleClick={onClick}
      className={`group relative bg-br-bg-deep rounded-[2px] overflow-hidden cursor-pointer border-2 transition-colors text-left ${
        isDragging
          ? 'opacity-30'
          : isOver
            ? 'border-[#4d9fec] bg-[#1e2a3a]'
            : 'border-transparent hover:border-br-border-hover'
      }`}
      title={`${collection.name} — double-click to open`}
    >
      <div className="w-full aspect-3/2 bg-[#1a1a1a] flex items-center justify-center relative overflow-hidden">
        <Folder className="w-10 h-10 text-[#505050]" fill="currentColor" />
        {isOver && (
          <div className="absolute inset-0 bg-[#4d9fec]/20 flex items-center justify-center">
            <span className="text-[10px] text-[#4d9fec] font-medium">Drop to add</span>
          </div>
        )}
      </div>

      {/* Info bar */}
      <div className="px-1.5 py-1 bg-br-bg-deep">
        {isEditing ? (
          <input
            ref={inputRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSubmitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmitRename();
              if (e.key === 'Escape') {
                setEditName(collection.name);
                setIsEditing(false);
              }
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-[#333] text-[9px] text-br-text px-1 py-0.5 rounded-[2px] outline-none border border-[#555]"
            autoFocus
          />
        ) : (
          <p className="text-[9px] text-br-dim truncate">{collection.name}</p>
        )}
        <p className="text-[8px] text-[#505050]">
          {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
          {childCount > 0 && `, ${childCount} ${childCount === 1 ? 'collection' : 'collections'}`}
        </p>
      </div>

      {/* Hover actions */}
      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onMove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMove();
            }}
            className="p-0.5 rounded-[2px] bg-black/50 text-white/60 hover:text-white cursor-pointer"
            title="Move to collection"
          >
            <FolderInput className="w-2.5 h-2.5" />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          className="p-0.5 rounded-[2px] bg-black/50 text-white/60 hover:text-white cursor-pointer"
          title="Rename"
        >
          <Pencil className="w-2.5 h-2.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-0.5 rounded-[2px] bg-black/50 text-white/60 hover:text-red-400 cursor-pointer"
          title="Delete collection"
        >
          <Trash2 className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
}

export function CollectionDragOverlay({ collection }: { collection: Collection | null }) {
  if (!collection) return null;
  return (
    <div className="bg-br-bg-deep rounded-[2px] overflow-hidden border-2 border-br-accent shadow-lg opacity-90 w-[160px]">
      <div className="w-full aspect-3/2 bg-[#1a1a1a] flex items-center justify-center">
        <Folder className="w-8 h-8 text-[#505050]" fill="currentColor" />
      </div>
      <div className="px-1.5 py-1 bg-br-bg-deep">
        <p className="text-[9px] text-br-dim truncate">{collection.name}</p>
      </div>
    </div>
  );
}

export const CollectionCard = memo(
  CollectionCardInner,
  (prev, next) =>
    prev.collection.id === next.collection.id &&
    prev.collection.name === next.collection.name &&
    prev.photoCount === next.photoCount &&
    prev.childCount === next.childCount &&
    prev.autoEdit === next.autoEdit,
);
