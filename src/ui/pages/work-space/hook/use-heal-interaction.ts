import { useMemo } from 'react';
import { useHealStore } from '@/features/develop/heal/store/heal-store';
import type { HealSpot } from '@/features/develop/heal/store/types';
import { ActiveTool } from '@features/develop/const';

const EMPTY_SPOTS: HealSpot[] = [];

export function useHealInteraction(activeTool: ActiveTool, selectedId: string | null) {
  const healStore = useHealStore();
  const healSpots = useHealStore((s) => (selectedId && s.spotsByPhoto[selectedId]) || EMPTY_SPOTS);
  const previewOriginal = useHealStore((s) => s.previewOriginal);
  const { selectedSpotId, brushSizePx, activeMode, feather, opacity } = healStore;

  const healInteractionProps = useMemo(() => {
    if (activeTool !== ActiveTool.Heal || !selectedId) return undefined;
    const pid = selectedId;
    return {
      spots: healSpots,
      selectedSpotId,
      brushSizePx,
      activeMode,
      feather,
      opacity,
      onSpotAdded: (s: HealSpot) => healStore.addSpot(pid, s),
      onMoveSpotDst: (id: string, nx: number, ny: number) =>
        healStore.updateSpot(pid, id, { dst: { x: nx, y: ny } }),
      onMoveSpotSrc: (id: string, nx: number, ny: number) =>
        healStore.updateSpot(pid, id, { src: { x: nx, y: ny } }),
      onSelectSpot: healStore.setSelectedSpotId,
      onDeleteSpot: (id: string) => healStore.removeSpot(pid, id),
      onBrushSizeChange: healStore.setBrushSizePx,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTool,
    selectedId,
    healSpots,
    selectedSpotId,
    brushSizePx,
    activeMode,
    feather,
    opacity,
  ]);

  return { healInteractionProps, healSpots, previewOriginal };
}
