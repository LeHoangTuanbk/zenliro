import { useCallback, useState } from 'react';
import { useMaskStore } from '../store/mask-store';
import { MaskType } from '../store/types';
import type { Mask } from '../store/types';
import { MaskAdjPanel } from './mask-adj-panel';
import { useShortcut } from '@shared/lib/shortcuts';
import { ShortcutHint } from '@shared/ui/shortcut-hint';

const EMPTY_MASKS: Mask[] = [];

type Props = {
  photoId: string | null;
};

export function MaskPanel({ photoId }: Props) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const masks = useMaskStore((s) =>
    photoId ? (s.masksByPhoto[photoId] ?? EMPTY_MASKS) : EMPTY_MASKS,
  );
  const selectedMaskId = useMaskStore((s) => s.selectedMaskId);
  const brushErase = useMaskStore((s) => s.brushErase);
  const showMaskOverlay = useMaskStore((s) => s.showMaskOverlay);
  const addMask = useMaskStore((s) => s.addMask);
  const removeMask = useMaskStore((s) => s.removeMask);
  const selectMask = useMaskStore((s) => s.selectMask);
  const toggleMask = useMaskStore((s) => s.toggleMask);
  const setBrushErase = useMaskStore((s) => s.setBrushErase);
  const setShowMaskOverlay = useMaskStore((s) => s.setShowMaskOverlay);
  const setPendingMaskType = useMaskStore((s) => s.setPendingMaskType);

  const toggleOverlay = useCallback(
    () => setShowMaskOverlay(!showMaskOverlay),
    [showMaskOverlay, setShowMaskOverlay],
  );
  useShortcut([{ id: 'mask.toggle-overlay', handler: toggleOverlay }]);

  if (!photoId) return null;

  const handleAdd = (type: (typeof MaskType)[keyof typeof MaskType]) => {
    setShowAddMenu(false);
    if (type === MaskType.Linear || type === MaskType.Radial) {
      // Lightroom Classic flow: enter placement mode; the mask is created on
      // the user's first drag over the canvas. See MaskPlacementOverlay.
      setPendingMaskType(type);
      return;
    }
    addMask(photoId, type);
  };

  return (
    <div className="flex flex-col text-[11px]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-br-elevated">
        <span className="text-br-text font-medium">Masks</span>
        <div className="flex items-center gap-2 relative">
          <button
            onClick={toggleOverlay}
            title={showMaskOverlay ? 'Hide mask overlay' : 'Show mask overlay'}
            className={`flex items-center text-[10px] transition-colors ${
              showMaskOverlay ? 'text-br-accent' : 'text-br-muted hover:text-br-text'
            }`}
          >
            <span>{showMaskOverlay ? 'Hide Overlay' : 'Show Overlay'}</span>
            <ShortcutHint shortcutId="mask.toggle-overlay" />
          </button>
          <button
            onClick={() => setShowAddMenu((v) => !v)}
            className="text-br-accent text-[10px] hover:text-br-text transition-colors"
          >
            + Add
          </button>
          {showAddMenu && (
            <div className="absolute right-0 top-full mt-1 bg-[#2a2a2a] border border-[#444] rounded-[3px] z-50 min-w-[130px] shadow-xl">
              {[
                { type: MaskType.Brush, label: 'Brush' },
                { type: MaskType.Linear, label: 'Linear Gradient' },
                { type: MaskType.Radial, label: 'Radial Gradient' },
              ].map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => handleAdd(type)}
                  className="w-full text-left px-3 py-1.5 text-[10px] text-br-muted hover:text-br-text hover:bg-white/5 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mask list */}
      {masks.length === 0 ? (
        <p className="text-br-dim text-[10px] px-3 py-3">No masks. Click Add to create one.</p>
      ) : (
        <div className="flex flex-col">
          {masks.map((mask) => (
            <div
              key={mask.id}
              role="button"
              tabIndex={0}
              onClick={() => selectMask(mask.id === selectedMaskId ? null : mask.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  selectMask(mask.id === selectedMaskId ? null : mask.id);
                }
              }}
              className={`flex items-center gap-2 px-3 py-1.5 text-left cursor-pointer select-none transition-colors border-b border-br-elevated ${
                mask.id === selectedMaskId ? 'bg-[#2a3d50]' : 'hover:bg-white/5'
              }`}
            >
              {/* Enable toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMask(photoId, mask.id);
                }}
                className={`w-3 h-3 rounded-sm border shrink-0 flex items-center justify-center ${
                  mask.enabled ? 'bg-br-accent border-br-accent' : 'border-[#555]'
                }`}
              >
                {mask.enabled && (
                  <svg
                    width="8"
                    height="6"
                    viewBox="0 0 8 6"
                    fill="none"
                    stroke="white"
                    strokeWidth="1.5"
                  >
                    <polyline points="1,3 3,5 7,1" />
                  </svg>
                )}
              </button>

              <span
                className={`flex-1 text-[10px] truncate ${mask.enabled ? 'text-br-text' : 'text-br-dim'}`}
              >
                {mask.name}
              </span>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeMask(photoId, mask.id);
                }}
                className="text-br-dim hover:text-red-400 transition-colors shrink-0"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Brush erase toggle */}
      {selectedMaskId && masks.find((m) => m.id === selectedMaskId)?.mask.type === 'brush' && (
        <div className="flex gap-1 px-3 py-2 border-b border-br-elevated">
          {(['paint', 'erase'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setBrushErase(mode === 'erase')}
              className={`flex-1 py-1 text-[10px] rounded-[2px] transition-colors ${
                (mode === 'erase') === brushErase
                  ? 'bg-br-accent/20 text-br-accent'
                  : 'bg-br-input text-br-muted hover:text-br-text'
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Per-mask adjustments */}
      {selectedMaskId && <MaskAdjPanel photoId={photoId} maskId={selectedMaskId} />}
    </div>
  );
}
