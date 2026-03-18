import { BrButton } from '@/shared/ui/base';

type LibraryViewProps = {
  photos: ImportedPhoto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onImport: () => void;
  onOpenDevelop: (id: string) => void;
};

export function LibraryView({
  photos,
  selectedId,
  onSelect,
  onImport,
  onOpenDevelop,
}: LibraryViewProps) {
  return (
    <div className="flex flex-col w-full h-full bg-br-bg">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-br-bg border-b border-black flex-shrink-0">
        <BrButton variant="primary" size="md" onClick={onImport}>+ Import</BrButton>
        <span className="text-[10px] text-br-dim">
          {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
        </span>
      </div>

      {/* Grid */}
      {photos.length === 0 ? (
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
          <p className="text-[13px]">No photos yet</p>
          <BrButton variant="primary" size="md" className="px-5 py-2 text-[12px]" onClick={onImport}>
            Import Photos
          </BrButton>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
            {photos.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p.id)}
                onDoubleClick={() => onOpenDevelop(p.id)}
                className={`group relative bg-br-bg-deep rounded-[2px] overflow-hidden cursor-pointer border-2 transition-colors text-left ${
                  p.id === selectedId
                    ? 'border-br-accent'
                    : 'border-transparent hover:border-br-border-hover'
                }`}
                title={`${p.fileName} — double-click to edit`}
              >
                <img
                  src={p.dataUrl}
                  alt={p.fileName}
                  className="w-full aspect-3/2 object-cover block"
                />
                <div className="px-1.5 py-1 bg-br-bg-deep">
                  <p className="text-[9px] text-br-dim truncate">{p.fileName}</p>
                </div>
                {/* Edit hint overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-[10px] text-white">Double-click to edit</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
