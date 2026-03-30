import { useCallback, useRef } from 'react';
import { Search, X, Trash2, FolderPlus, Sparkles } from 'lucide-react';
import { useShortcut } from '@shared/lib/shortcuts';
import { ShortcutHint } from '@shared/ui/shortcut-hint';
import { StarRating } from './star-rating';
import type { LibraryFilter } from '../const/filter';

type LibraryToolbarProps = {
  filter: LibraryFilter;
  photoCount: number;
  filteredCount: number;
  selectedCount: number;
  allTags: string[];
  onFilterChange: (filter: LibraryFilter) => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
  onCollectionCreate: () => void;
  onBulkAiEdit?: () => void;
};

export function LibraryToolbar({
  filter,
  photoCount,
  filteredCount,
  selectedCount,
  allTags,
  onFilterChange,
  onBulkDelete,
  onClearSelection,
  onCollectionCreate,
  onBulkAiEdit,
}: LibraryToolbarProps) {
  const hasActiveFilter = filter.search || filter.minRating > 0 || filter.tags.length > 0;
  const searchRef = useRef<HTMLInputElement>(null);

  const handleFocusSearch = useCallback(() => {
    searchRef.current?.focus();
    searchRef.current?.select();
  }, []);

  useShortcut([{ id: 'library.search', handler: handleFocusSearch }]);

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-br-bg border-b border-black shrink-0">
      {/* Left side — fixed buttons */}
      {onBulkAiEdit && (
        <button
          onClick={onBulkAiEdit}
          className="flex items-center gap-1 px-2 py-1 text-[10px] text-[#c4a0ff] bg-[#c4a0ff]/10 border border-[#c4a0ff]/20 rounded-[2px] cursor-pointer hover:bg-[#c4a0ff]/20 transition-colors"
          title="AI Bulk Edit photos"
        >
          <Sparkles className="w-3 h-3" />
          AI Bulk Edit
          <ShortcutHint shortcutId="library.bulk-edit" className="text-[#c4a0ff]/50" />
        </button>
      )}

      <button
        onClick={onCollectionCreate}
        className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium text-[#ccc] hover:text-white bg-[#2a2a2a] border border-[#444] rounded-[3px] cursor-pointer hover:bg-[#333] hover:border-[#555] transition-colors"
        title="New Collection"
      >
        <FolderPlus className="w-4 h-4" />
        New Collection{' '}
        <ShortcutHint shortcutId="library.new-collection" className="text-[#ccc]/50" />
      </button>

      {/* Search */}
      <div className="relative flex items-center">
        <Search className="absolute left-2 w-3 h-3 text-br-dim pointer-events-none" />
        <input
          ref={searchRef}
          type="text"
          placeholder="Search... ⌘S"
          value={filter.search}
          onChange={(e) => onFilterChange({ ...filter, search: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onFilterChange({ ...filter, search: '' });
              searchRef.current?.blur();
            }
          }}
          className="pl-6 pr-2 py-1 w-[140px] text-[10px] bg-br-input border border-br-elevated rounded-[2px] text-br-text outline-none focus:border-br-mark placeholder:text-br-muted"
        />
      </div>

      {/* Star filter */}
      <StarRating
        value={filter.minRating}
        onChange={(val) => onFilterChange({ ...filter, minRating: val })}
        size="sm"
      />

      {/* Tag dropdown */}
      {allTags.length > 0 && (
        <select
          className="text-[10px] bg-[#2a2a2a] border border-[#3a3a3a] rounded-[2px] text-[#f2f2f2] px-1 py-0.5 outline-none cursor-pointer"
          value=""
          onChange={(e) => {
            const tag = e.target.value;
            if (tag && !filter.tags.includes(tag)) {
              onFilterChange({ ...filter, tags: [...filter.tags, tag] });
            }
          }}
        >
          <option value="">Tags...</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      )}

      {/* Active tag pills */}
      {filter.tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] bg-[#3a3a3a] text-[#f2f2f2] rounded-[2px]"
        >
          {tag}
          <button
            onClick={() =>
              onFilterChange({ ...filter, tags: filter.tags.filter((t) => t !== tag) })
            }
            className="hover:text-red-400 cursor-pointer"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}

      {/* Clear filters */}
      {hasActiveFilter && (
        <button
          onClick={() => onFilterChange({ search: '', minRating: 0, tags: [], dateRange: null })}
          className="text-[9px] text-br-dim hover:text-br-text cursor-pointer"
        >
          Clear
        </button>
      )}

      {/* Right side — selection actions + photo count */}
      <div className="ml-auto flex items-center gap-2">
        {selectedCount > 0 && (
          <>
            <span className="text-[10px] text-[#4d9fec]">{selectedCount} selected</span>
            <button
              onClick={onBulkDelete}
              className="flex items-center gap-1 px-2 py-1 text-[10px] text-red-400 bg-red-400/10 border border-red-400/20 rounded-[2px] cursor-pointer hover:bg-red-400/20 transition-colors"
              title="Delete selected photos"
            >
              <Trash2 className="w-3 h-3" />
              Delete
              <ShortcutHint shortcutId="library.delete" className="text-red-400/50" />
            </button>
            <button
              onClick={onClearSelection}
              className="text-[9px] text-[#5b9bd5] hover:text-[#7bb8ef] cursor-pointer"
            >
              Deselect
              <ShortcutHint shortcutId="library.deselect" className="text-[#5b9bd5]/50" />
            </button>
            <div className="h-4 w-px bg-[#444]" />
          </>
        )}
        <span className="text-[10px] text-br-dim">
          {selectedCount === 0 && photoCount > 1 && (
            <span className="mr-2 text-[9px] text-[#555]">Hold ⌘ to multi-select</span>
          )}
          {hasActiveFilter ? `${filteredCount} / ` : ''}
          {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
        </span>
      </div>
    </div>
  );
}
