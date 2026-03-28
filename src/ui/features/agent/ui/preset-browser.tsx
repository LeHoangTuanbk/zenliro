import { useState, useMemo } from 'react';
import {
  STYLE_PRESETS,
  PRESET_CATEGORIES,
  type StylePreset,
  type PresetCategory,
} from '../const/presets';

type PresetBrowserProps = {
  onApply: (prompt: string) => void;
  onClose: () => void;
};

export function PresetBrowser({ onApply, onClose }: PresetBrowserProps) {
  const [category, setCategory] = useState<PresetCategory>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [strength, setStrength] = useState(75);

  const filtered = useMemo(() => {
    let list = STYLE_PRESETS;
    if (category !== 'all') {
      list = list.filter((p) => p.category === category);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) => p.label.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
      );
    }
    return list;
  }, [category, search]);

  const selected = selectedId ? STYLE_PRESETS.find((p) => p.id === selectedId) : null;

  const handleApply = () => {
    if (!selected) return;
    const strengthNote =
      strength < 100
        ? ` Apply at ${strength}% strength — keep changes subtle and proportional.`
        : '';
    onApply(selected.prompt + strengthNote);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        className="flex flex-col bg-[#1a1a1a] rounded-[8px] border border-[#333] shadow-2xl overflow-hidden"
        style={{ width: '90vw', maxWidth: 1200, height: '85vh', maxHeight: 900 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center gap-4 px-6 py-4 shrink-0">
          <h2 className="text-[16px] font-semibold text-[#e0e0e0]">Style Presets</h2>

          {/* Search */}
          <div className="flex items-center gap-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-[4px] px-3 h-[34px] w-[280px]">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="#666" strokeWidth="1.2" />
              <path d="M9.5 9.5l3 3" stroke="#666" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.nativeEvent.stopImmediatePropagation()}
              placeholder="Search presets..."
              className="bg-transparent text-[12px] text-[#ccc] w-full focus:outline-none placeholder:text-[#555]"
            />
          </div>

          <div className="flex-1" />

          {/* Category tabs */}
          <div className="flex items-center gap-1">
            {PRESET_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`px-3 py-1 rounded-[4px] text-[11px] font-medium transition-colors ${
                  category === cat.id
                    ? 'bg-[#3b82f6] text-white'
                    : 'bg-[#2a2a2a] text-[#999] hover:text-[#ccc] hover:bg-[#333]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="text-[#666] hover:text-[#999] transition-colors ml-2"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="grid grid-cols-5 gap-4">
            {filtered.map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                isSelected={selectedId === preset.id}
                onSelect={() => setSelectedId(preset.id === selectedId ? null : preset.id)}
                onDoubleClick={() => {
                  onApply(preset.prompt);
                  onClose();
                }}
              />
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="text-center text-[12px] text-[#555] mt-12">No presets found</p>
          )}
        </div>

        {/* Bottom bar */}
        <div className="flex items-center gap-4 px-6 py-3 border-t border-[#333] shrink-0">
          <button
            onClick={handleApply}
            disabled={!selected}
            className="px-5 h-[34px] rounded-[4px] text-[12px] font-semibold transition-colors bg-[#3b82f6] text-white hover:bg-[#4b92ff] disabled:bg-[#333] disabled:text-[#666] disabled:cursor-not-allowed"
          >
            Apply Preset
          </button>

          <div className="flex-1" />

          {/* Strength */}
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-[#888]">Strength: {strength}%</span>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={strength}
              onChange={(e) => setStrength(Number(e.target.value))}
              className="w-[120px] h-1 accent-[#3b82f6] bg-[#333] rounded appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PresetCard({
  preset,
  isSelected,
  onSelect,
  onDoubleClick,
}: {
  preset: StylePreset;
  isSelected: boolean;
  onSelect: () => void;
  onDoubleClick: () => void;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <button
      type="button"
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      className={`flex flex-col rounded-[6px] overflow-hidden bg-[#222] text-left transition-all hover:bg-[#282828] ${
        isSelected
          ? 'ring-2 ring-[#3b82f6] ring-offset-1 ring-offset-[#1a1a1a]'
          : 'hover:ring-1 hover:ring-[#444]'
      }`}
    >
      {/* Thumbnail */}
      <div className="aspect-[4/3] w-full bg-[#2a2a2a] overflow-hidden">
        {!imgError ? (
          <img
            src={preset.thumbnail}
            alt={preset.label}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#444] text-[10px]">
            {preset.label}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-3 py-2">
        <p className={`text-[12px] font-medium ${isSelected ? 'text-[#6aa8ff]' : 'text-[#ddd]'}`}>
          {preset.label}
        </p>
        <p className="text-[10px] text-[#888] mt-0.5 line-clamp-2 leading-tight">
          {preset.description}
        </p>
      </div>
    </button>
  );
}
