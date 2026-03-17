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
      <span className="text-[10px] text-[#929292] w-8 text-right tabular-nums">
        {display ?? Math.round(value)}
      </span>
    </div>
  );
}

export function HealPanel({ photoId }: HealPanelProps) {
  const {
    activeMode,
    brushRadius,
    feather,
    opacity,
    selectedSpotId,
    getSpots,
    removeSpot,
    clearAll,
    setActiveMode,
    setBrushRadius,
    setFeather,
    setOpacity,
    setSelectedSpotId,
  } = useHealStore();

  const spots = photoId ? getSpots(photoId) : [];
  const hasPhoto = !!photoId;

  const brushSizePct = Math.round(brushRadius * 400); // rough display value 0–100

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#3a3a3a]">
        <span className="text-[11px] font-semibold text-[#f2f2f2] uppercase tracking-[0.8px]">
          Spot Removal
        </span>
        {hasPhoto && spots.length > 0 && (
          <button
            className="border border-[#3a3a3a] text-[#929292] rounded-[2px] px-2 py-0.5 text-[10px] bg-transparent cursor-pointer hover:text-[#f2f2f2] hover:border-[#555] transition-colors"
            onClick={() => clearAll(photoId!)}
          >
            Clear All
          </button>
        )}
      </div>

      {/* Mode toggle */}
      <div className="px-3 py-3 border-b border-[#3a3a3a]">
        <div className="flex gap-1">
          {(['heal', 'clone'] as const).map((m) => (
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
          value={brushRadius}
          min={0.01}
          max={0.25}
          step={0.005}
          onChange={setBrushRadius}
          display={`${brushSizePct}`}
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
                        : 'bg-[#4a3a1a] text-[#c8a86b]'
                    }`}
                  >
                    {spot.mode === 'heal' ? 'H' : 'C'}
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
