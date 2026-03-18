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
    <div className="flex flex-col w-full h-full bg-[#1a1a1a]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border-b border-black flex-shrink-0">
        <button
          onClick={onImport}
          className="px-3 py-1.5 text-[11px] text-white bg-[#3d6fa5] rounded-[3px] cursor-pointer hover:bg-[#4d9fec] transition-colors"
        >
          + Import
        </button>
        <span className="text-[10px] text-[#505050]">
          {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
        </span>
      </div>

      {/* Grid */}
      {photos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-[#505050] select-none">
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
          <button
            onClick={onImport}
            className="px-5 py-2 text-[12px] text-white bg-[#3d6fa5] rounded-[3px] cursor-pointer hover:bg-[#4d9fec] transition-colors"
          >
            Import Photos
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
            {photos.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p.id)}
                onDoubleClick={() => onOpenDevelop(p.id)}
                className={`group relative bg-[#111] rounded-[2px] overflow-hidden cursor-pointer border-2 transition-colors text-left ${
                  p.id === selectedId
                    ? 'border-[#4d9fec]'
                    : 'border-transparent hover:border-[#444]'
                }`}
                title={`${p.fileName} — double-click to edit`}
              >
                <img
                  src={p.dataUrl}
                  alt={p.fileName}
                  className="w-full aspect-[3/2] object-cover block"
                />
                <div className="px-1.5 py-1 bg-[#111]">
                  <p className="text-[9px] text-[#505050] truncate">{p.fileName}</p>
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
