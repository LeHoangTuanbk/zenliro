import { useCropStore } from '../store/crop-store';
import { ASPECT_RATIOS, type AspectRatioPreset } from '../store/types';

interface CropPanelProps {
  photoId: string | null;
  imageAspect: number;
  onDone?: () => void;
}

const IconCCW = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);
const IconCW = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);
const IconFlipH = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3" />
    <path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
    <line x1="12" y1="20" x2="12" y2="4" />
  </svg>
);
const IconFlipV = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3" />
    <path d="M21 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3" />
    <line x1="4" y1="12" x2="20" y2="12" />
  </svg>
);

function IconBtn({
  onClick,
  title,
  active,
  children,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex items-center justify-center w-8 h-8 rounded-[2px] border cursor-pointer transition-colors ${
        active
          ? 'bg-br-accent-dark text-white border-br-accent'
          : 'bg-transparent text-br-muted border-br-elevated hover:text-br-text hover:border-br-mark'
      }`}
    >
      {children}
    </button>
  );
}

export function CropPanel({ photoId, imageAspect, onDone }: CropPanelProps) {
  const store = useCropStore();
  const cropState = photoId ? store.getCrop(photoId) : null;
  const hasPhoto = !!photoId && !!cropState;

  const set = (patch: Parameters<typeof store.setCrop>[1]) => {
    if (photoId) store.setCrop(photoId, patch);
  };

  const isDefault = cropState
    ? cropState.rect.x === 0 &&
      cropState.rect.y === 0 &&
      cropState.rect.w === 1 &&
      cropState.rect.h === 1 &&
      cropState.rotation === 0 &&
      cropState.rotationSteps === 0 &&
      !cropState.flipH &&
      !cropState.flipV
    : true;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-br-elevated">
        <span className="text-[11px] font-semibold text-br-text uppercase tracking-[0.8px]">
          Crop & Rotate
        </span>
        <div className="flex items-center gap-1.5">
          {hasPhoto && !isDefault && (
            <button
              className="border border-br-elevated text-br-muted rounded-[2px] px-2 py-0.5 text-[10px] bg-transparent cursor-pointer hover:text-br-text hover:border-br-mark transition-colors"
              onClick={() => store.resetCrop(photoId!)}
            >
              Reset
            </button>
          )}
          {hasPhoto && onDone && (
            <button
              className="bg-br-accent-dark text-white border border-br-accent rounded-[2px] px-2.5 py-0.5 text-[10px] cursor-pointer hover:bg-br-accent transition-colors"
              onClick={onDone}
            >
              Done
            </button>
          )}
        </div>
      </div>

      {!hasPhoto && (
        <p className="px-3 py-4 text-center text-[10px] text-br-dim">
          Import a photo to use Crop & Rotate
        </p>
      )}

      {hasPhoto && cropState && (
        <>
          {/* Aspect Ratio */}
          <div className="px-3 py-3 border-b border-br-elevated">
            <div className="text-[10px] text-br-dim uppercase tracking-[0.6px] mb-2">
              Aspect Ratio
            </div>
            <div className="flex items-center gap-2">
              <select
                value={cropState.aspectPreset}
                onChange={(e) =>
                  store.setAspectPreset(photoId!, e.target.value as AspectRatioPreset, imageAspect)
                }
                className="flex-1 bg-br-input text-br-text border border-br-elevated rounded-[2px] text-[10px] px-2 py-1 cursor-pointer outline-none hover:border-br-mark focus:border-br-accent transition-colors"
              >
                {ASPECT_RATIOS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <button
                title={cropState.lockAspect ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                onClick={() => set({ lockAspect: !cropState.lockAspect })}
                className={`flex items-center justify-center w-7 h-7 rounded-[2px] border cursor-pointer transition-colors flex-shrink-0 ${
                  cropState.lockAspect
                    ? 'bg-br-accent-dark text-white border-br-accent'
                    : 'bg-transparent text-br-muted border-br-elevated hover:text-br-text hover:border-br-mark'
                }`}
              >
                <svg width="11" height="13" viewBox="0 0 11 13" fill="currentColor">
                  {cropState.lockAspect ? (
                    <path d="M9 5V3.5a3.5 3.5 0 1 0-7 0V5H1a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H9zm-2 0H4V3.5a1.5 1.5 0 1 1 3 0V5z" />
                  ) : (
                    <path d="M9 5V3.5a3.5 3.5 0 0 0-7 0V5h-.5A1.5 1.5 0 0 0 0 6.5v5A1.5 1.5 0 0 0 1.5 13h8A1.5 1.5 0 0 0 11 11.5v-5A1.5 1.5 0 0 0 9.5 5H9zm-6 0V3.5a2.5 2.5 0 0 1 5 0V5H3z" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Straighten */}
          <div className="px-3 py-3 border-b border-br-elevated">
            <div className="text-[10px] text-br-dim uppercase tracking-[0.6px] mb-2">
              Straighten
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-br-muted w-[48px] flex-shrink-0">Angle</span>
              <input
                type="range"
                min={-45}
                max={45}
                step={0.1}
                value={cropState.rotation}
                onChange={(e) => set({ rotation: parseFloat(e.target.value) })}
                className="flex-1 h-[3px] cursor-pointer"
                style={{ accentColor: 'var(--color-br-accent)' }}
              />
              <span
                className="text-[10px] text-br-muted w-10 text-right tabular-nums"
                title="Double-click to reset"
                onDoubleClick={() => set({ rotation: 0 })}
              >
                {cropState.rotation > 0 ? '+' : ''}
                {cropState.rotation.toFixed(1)}°
              </span>
            </div>
          </div>

          {/* Rotate & Flip */}
          <div className="px-3 py-3">
            <div className="text-[10px] text-br-dim uppercase tracking-[0.6px] mb-2">
              Rotate & Flip
            </div>
            <div className="flex items-center gap-1.5">
              <IconBtn title="Rotate 90° CCW" onClick={() => set({ rotationSteps: cropState.rotationSteps - 1 })}>
                <IconCCW />
              </IconBtn>
              <IconBtn title="Rotate 90° CW" onClick={() => set({ rotationSteps: cropState.rotationSteps + 1 })}>
                <IconCW />
              </IconBtn>
              <IconBtn title="Flip Horizontal" active={cropState.flipH} onClick={() => set({ flipH: !cropState.flipH })}>
                <IconFlipH />
              </IconBtn>
              <IconBtn title="Flip Vertical" active={cropState.flipV} onClick={() => set({ flipV: !cropState.flipV })}>
                <IconFlipV />
              </IconBtn>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
