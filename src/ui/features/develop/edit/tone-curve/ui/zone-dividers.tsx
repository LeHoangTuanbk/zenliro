import { useRef, useCallback } from 'react';

const ZONE_LABELS = ['Shadows', 'Darks', 'Lights', 'Highlights'] as const;

type ZoneDividersProps = {
  splits: [number, number, number]; // 3 split positions in 0-1
  onChange: (splits: [number, number, number]) => void;
};

const HANDLE_SIZE = 8;
const MIN_GAP = 0.05;

export function ZoneDividers({ splits, onChange }: ZoneDividersProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<number | null>(null);

  const handleMouseDown = useCallback(
    (idx: number) => (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = idx;

      const onMove = (ev: MouseEvent) => {
        const track = trackRef.current;
        if (!track || draggingRef.current === null) return;
        const rect = track.getBoundingClientRect();
        const raw = (ev.clientX - rect.left) / rect.width;
        const i = draggingRef.current;

        const minVal = i === 0 ? MIN_GAP : splits[i - 1] + MIN_GAP;
        const maxVal = i === 2 ? 1 - MIN_GAP : splits[i + 1] - MIN_GAP;
        const clamped = Math.max(minVal, Math.min(maxVal, raw));

        const next: [number, number, number] = [...splits];
        next[i] = clamped;
        onChange(next);
      };

      const onUp = () => {
        draggingRef.current = null;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [splits, onChange],
  );

  return (
    <div className="relative h-5 mx-0" ref={trackRef}>
      {/* Track line */}
      <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-px bg-br-mark" />

      {/* Zone labels (shown on hover via title) */}
      {splits.map((pos, i) => (
        <div
          key={i}
          className="absolute top-1/2 -translate-y-1/2 cursor-ew-resize z-10"
          style={{ left: `calc(${pos * 100}% - ${HANDLE_SIZE / 2}px)` }}
          onMouseDown={handleMouseDown(i)}
          title={`${ZONE_LABELS[i]} / ${ZONE_LABELS[i + 1]}`}
        >
          {/* Diamond handle */}
          <div
            className="bg-br-muted hover:bg-br-text transition-colors"
            style={{
              width: HANDLE_SIZE,
              height: HANDLE_SIZE,
              transform: 'rotate(45deg)',
              borderRadius: 1,
            }}
          />
        </div>
      ))}
    </div>
  );
}
