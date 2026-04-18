import { useState, useCallback, useMemo } from 'react';
import { useHealStore } from '../store/heal-store';
import type { HealSpot, ToolOverlayMode } from '../store/types';
import { useShortcut } from '@shared/lib/shortcuts';

const TOOL_OVERLAY_OPTIONS: { value: ToolOverlayMode; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'always', label: 'Always' },
  { value: 'selected', label: 'Selected' },
  { value: 'never', label: 'Never' },
];

type SpotGroup = {
  key: string; // strokeId or the single spot's id
  firstSpot: HealSpot;
  spots: HealSpot[]; // all spots sharing this stroke
  index: number; // 1-based position in the visible list
};

function groupSpots(spots: HealSpot[]): SpotGroup[] {
  const groups = new Map<string, SpotGroup>();
  let idx = 0;
  for (const spot of spots) {
    const key = spot.strokeId ?? spot.id;
    const existing = groups.get(key);
    if (existing) {
      existing.spots.push(spot);
    } else {
      idx += 1;
      groups.set(key, { key, firstSpot: spot, spots: [spot], index: idx });
    }
  }
  return [...groups.values()];
}

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
  const [draft, setDraft] = useState('');

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
          onDoubleClick={() => {
            setDraft(displayVal);
            setEditing(true);
          }}
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
    toolOverlay,
    getSpots,
    removeSpot,
    removeStroke,
    clearAll,
    setActiveMode,
    setBrushSizePx,
    setFeather,
    setOpacity,
    setSelectedSpotId,
    setPreviewOriginal,
    setToolOverlay,
  } = useHealStore();

  const spots = photoId ? getSpots(photoId) : [];
  const hasPhoto = !!photoId;
  const groups = useMemo(() => groupSpots(spots), [spots]);

  const handleTogglePreview = useCallback(
    () => setPreviewOriginal(!previewOriginal),
    [previewOriginal, setPreviewOriginal],
  );

  useShortcut([{ id: 'heal.toggle-preview', handler: handleTogglePreview }]);

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
              title="Remove every spot"
            >
              Reset
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

      {/* Spot list — grouped by stroke */}
      {groups.length > 0 && (
        <div className="px-3 py-2 border-b border-[#3a3a3a]">
          <div className="text-[10px] text-[#505050] uppercase tracking-[0.6px] mb-1.5">
            Spots ({groups.length})
          </div>
          <div className="flex flex-col gap-0.5">
            {groups.map((g) => {
              const selected = g.spots.some((sp) => sp.id === selectedSpotId);
              const mode = g.firstSpot.mode;
              const badge = mode === 'heal' ? 'H' : mode === 'fill' ? 'F' : 'C';
              const badgeCls =
                mode === 'heal'
                  ? 'bg-[#3d6fa5] text-[#9dc8f5]'
                  : mode === 'fill'
                    ? 'bg-[#3a3a1a] text-[#c8c86b]'
                    : 'bg-[#4a3a1a] text-[#c8a86b]';
              const label =
                g.spots.length > 1 ? `Stroke ${g.index} (${g.spots.length})` : `Spot ${g.index}`;
              return (
                <div
                  key={g.key}
                  className={`flex items-center justify-between px-2 py-1.5 rounded-[2px] cursor-pointer select-none ${
                    selected ? 'bg-[#2a3d52]' : 'hover:bg-[#2a2a2a]'
                  }`}
                  onClick={() => setSelectedSpotId(selected ? null : g.firstSpot.id)}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] font-semibold uppercase px-1 rounded-[2px] ${badgeCls}`}
                    >
                      {badge}
                    </span>
                    <span className="text-[10px] text-[#929292]">{label}</span>
                  </div>
                  <button
                    className="text-[#505050] hover:text-[#ff6b6b] text-[14px] leading-none px-1 cursor-pointer transition-colors"
                    title={g.spots.length > 1 ? 'Delete stroke' : 'Delete spot'}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!photoId) return;
                      if (g.spots.length > 1 && g.firstSpot.strokeId) {
                        removeStroke(photoId, g.firstSpot.strokeId);
                      } else {
                        removeSpot(photoId, g.firstSpot.id);
                      }
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tool Overlay — LR Classic bottom dropdown */}
      {hasPhoto && (
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-[10px] text-[#929292]">Tool Overlay</span>
          <select
            value={toolOverlay}
            onChange={(e) => setToolOverlay(e.target.value as ToolOverlayMode)}
            className="bg-[#1a1a1a] border border-[#3a3a3a] text-[10px] text-[#f2f2f2] rounded-[2px] px-1.5 py-0.5 cursor-pointer outline-none hover:border-[#555]"
          >
            {TOOL_OVERLAY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
