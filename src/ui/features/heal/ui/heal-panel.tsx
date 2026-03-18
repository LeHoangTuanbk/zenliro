import { useState, useEffect } from 'react';
import { useHealStore } from '../model/heal-store';

interface HealPanelProps {
  photoId: string | null;
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  display?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState('');

  const displayVal = display ?? String(Math.round(value));

  const commitDraft = () => {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) onChange(Math.max(min, Math.min(max, parsed)));
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-2 py-[3px]">
      <span className="text-[10px] text-[#929292] w-[60px] flex-shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-[3px] cursor-pointer"
        style={{ accentColor: '#4d9fec' }}
      />
      {editing ? (
        <input
          type="number"
          className="w-8 text-right text-[10px] bg-[#111] text-[#f2f2f2] border border-[#4d9fec] rounded-[2px] outline-none tabular-nums px-0.5"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitDraft();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <span
          className="text-[10px] text-[#929292] w-8 text-right tabular-nums cursor-text hover:text-[#f2f2f2] transition-colors"
          title="Click to enter value"
          onDoubleClick={() => { setDraft(displayVal); setEditing(true); }}
        >
          {displayVal}
        </span>
      )}
    </div>
  );
}

export function HealPanel({ photoId }: HealPanelProps) {
  const {
    activeMode,
    brushSizePx,
    feather,
    opacity,
    selectedSpotId,
    previewOriginal,
    getSpots,
    removeSpot,
    clearAll,
    setActiveMode,
    setBrushSizePx,
    setFeather,
    setOpacity,
    setSelectedSpotId,
    setPreviewOriginal,
  } = useHealStore();

  const spots = photoId ? getSpots(photoId) : [];
  const hasPhoto = !!photoId;

  // \ key toggles before/after preview (Lightroom shortcut)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === '\\') setPreviewOriginal(!previewOriginal);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewOriginal, setPreviewOriginal]);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#3a3a3a]">
        <span className="text-[11px] font-semibold text-[#f2f2f2] uppercase tracking-[0.8px]">
          Spot Removal
        </span>
        <div className="flex items-center gap-1.5">
          {hasPhoto && spots.length > 0 && (
            <button
              title="Hold to preview without circles (\\)"
              className={`border rounded-[2px] px-2 py-0.5 text-[10px] cursor-pointer transition-colors ${
                previewOriginal
                  ? 'bg-[#3d6fa5] text-white border-[#4d9fec]'
                  : 'border-[#3a3a3a] text-[#929292] bg-transparent hover:text-[#f2f2f2] hover:border-[#555]'
              }`}
              onClick={() => setPreviewOriginal(!previewOriginal)}
            >
              Preview
            </button>
          )}
          {hasPhoto && spots.length > 0 && (
            <button
              className="border border-[#3a3a3a] text-[#929292] rounded-[2px] px-2 py-0.5 text-[10px] bg-transparent cursor-pointer hover:text-[#f2f2f2] hover:border-[#555] transition-colors"
              onClick={() => clearAll(photoId!)}
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Mode toggle */}
      <div className="px-3 py-3 border-b border-[#3a3a3a]">
        <div className="flex gap-1">
          {(['heal', 'clone', 'fill'] as const).map((m) => (
            <button
              key={m}
              className={`flex-1 py-1.5 text-[11px] font-medium rounded-[2px] border cursor-pointer transition-colors capitalize ${
                activeMode === m
                  ? 'bg-[#3d6fa5] text-white border-[#4d9fec]'
                  : 'bg-transparent text-[#929292] border-[#3a3a3a] hover:text-[#f2f2f2] hover:border-[#555]'
              }`}
              onClick={() => setActiveMode(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Brush */}
      <div className="px-3 py-2 border-b border-[#3a3a3a]">
        <div className="text-[10px] text-[#505050] uppercase tracking-[0.6px] mb-1.5">Brush</div>
        <Slider
          label="Size"
          value={brushSizePx}
          min={5}
          max={200}
          step={1}
          onChange={setBrushSizePx}
        />
        <Slider label="Feather" value={feather} min={0} max={100} onChange={setFeather} />
        <Slider label="Opacity" value={opacity} min={0} max={100} onChange={setOpacity} />
      </div>

      {/* Tips */}
      {!hasPhoto && (
        <p className="px-3 py-4 text-center text-[10px] text-[#505050]">
          Import a photo to use Spot Removal
        </p>
      )}
      {hasPhoto && spots.length === 0 && (
        <div className="px-3 py-4 text-center text-[10px] text-[#505050] leading-relaxed">
          Click on the image to remove a spot.
          <br />
          Scroll to resize the brush.
        </div>
      )}

      {/* Spot list */}
      {spots.length > 0 && (
        <div className="px-3 py-2">
          <div className="text-[10px] text-[#505050] uppercase tracking-[0.6px] mb-1.5">
            Spots ({spots.length})
          </div>
          <div className="flex flex-col gap-0.5 max-h-[180px] overflow-y-auto">
            {spots.map((spot, i) => (
              <div
                key={spot.id}
                className={`flex items-center justify-between px-2 py-1.5 rounded-[2px] cursor-pointer select-none ${
                  spot.id === selectedSpotId ? 'bg-[#2a3d52]' : 'hover:bg-[#2a2a2a]'
                }`}
                onClick={() =>
                  setSelectedSpotId(spot.id === selectedSpotId ? null : spot.id)
                }
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[9px] font-semibold uppercase px-1 rounded-[2px] ${
                      spot.mode === 'heal'
                        ? 'bg-[#3d6fa5] text-[#9dc8f5]'
                        : spot.mode === 'fill'
                        ? 'bg-[#3a3a1a] text-[#c8c86b]'
                        : 'bg-[#4a3a1a] text-[#c8a86b]'
                    }`}
                  >
                    {spot.mode === 'heal' ? 'H' : spot.mode === 'fill' ? 'F' : 'C'}
                  </span>
                  <span className="text-[10px] text-[#929292]">Spot {i + 1}</span>
                </div>
                <button
                  className="text-[#505050] hover:text-[#ff6b6b] text-[14px] leading-none px-1 cursor-pointer transition-colors"
                  title="Delete spot"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (photoId) removeSpot(photoId, spot.id);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
