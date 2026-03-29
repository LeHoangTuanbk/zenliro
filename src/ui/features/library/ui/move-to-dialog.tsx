import { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, Home } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/base';
import { BrButton } from '@/shared/ui/base';

type MoveToDialogProps = {
  open: boolean;
  photoCount: number;
  collections: Collection[];
  currentCollectionId: string | null;
  onMove: (targetId: string | null) => void;
  onCancel: () => void;
};

export function MoveToDialog({
  open,
  photoCount,
  collections,
  currentCollectionId,
  onMove,
  onCancel,
}: MoveToDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleConfirm = () => {
    onMove(selectedId);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onCancel()}>
      <DialogContent className="bg-br-input border border-br-elevated text-br-text sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-[13px]">
            Move {photoCount} {photoCount === 1 ? 'photo' : 'photos'} to...
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[300px] overflow-y-auto py-1">
          {/* Root option */}
          <button
            onClick={() => setSelectedId(null)}
            className={`flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-left rounded-[2px] transition-colors cursor-pointer ${
              selectedId === null ? 'bg-[#3b82f6]/20 text-white' : 'text-[#ccc] hover:bg-[#333]'
            }`}
          >
            <Home className="w-3.5 h-3.5 text-[#888]" />
            Library Root
          </button>

          {/* Collection tree */}
          {collections
            .filter((c) => c.parentId === null)
            .map((col) => (
              <CollectionTreeNode
                key={col.id}
                collection={col}
                collections={collections}
                selectedId={selectedId}
                currentCollectionId={currentCollectionId}
                depth={0}
                onSelect={setSelectedId}
              />
            ))}
        </div>

        <DialogFooter>
          <BrButton variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </BrButton>
          <BrButton
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            disabled={selectedId === currentCollectionId}
          >
            Move Here
          </BrButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CollectionTreeNode({
  collection,
  collections,
  selectedId,
  currentCollectionId,
  depth,
  onSelect,
}: {
  collection: Collection;
  collections: Collection[];
  selectedId: string | null;
  currentCollectionId: string | null;
  depth: number;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = collections.filter((c) => c.parentId === collection.id);
  const hasChildren = children.length > 0;
  const isCurrent = collection.id === currentCollectionId;
  const isSelected = selectedId === collection.id;

  return (
    <div>
      <button
        onClick={() => onSelect(collection.id)}
        className={`flex items-center gap-1.5 w-full text-left py-1.5 rounded-[2px] transition-colors cursor-pointer ${
          isSelected
            ? 'bg-[#3b82f6]/20 text-white'
            : isCurrent
              ? 'text-[#666]'
              : 'text-[#ccc] hover:bg-[#333]'
        }`}
        style={{ paddingLeft: 12 + depth * 16 }}
        disabled={isCurrent}
        title={isCurrent ? 'Current location' : collection.name}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            className="p-0 cursor-pointer"
          >
            {expanded ? (
              <ChevronDown className="w-3 h-3 text-[#888]" />
            ) : (
              <ChevronRight className="w-3 h-3 text-[#888]" />
            )}
          </button>
        ) : (
          <span className="w-3" />
        )}
        <Folder className="w-3.5 h-3.5 text-[#888]" fill="currentColor" />
        <span className="text-[11px] truncate">{collection.name}</span>
        {isCurrent && <span className="text-[9px] text-[#555] ml-auto mr-2">(current)</span>}
      </button>

      {expanded &&
        children.map((child) => (
          <CollectionTreeNode
            key={child.id}
            collection={child}
            collections={collections}
            selectedId={selectedId}
            currentCollectionId={currentCollectionId}
            depth={depth + 1}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}
