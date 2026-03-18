import { useMemo } from 'react';
import { useCropStore } from '@/features/develop/crop/store/crop-store';
import { ActiveTool } from '@features/develop/const';

export function useCropInteraction(
  activeTool: ActiveTool,
  selectedId: string | null,
  imageAspect: number,
) {
  const cropStore = useCropStore();
  const cropState = selectedId ? cropStore.getCrop(selectedId) : null;

  const cropInteractionProps = useMemo(() => {
    if (activeTool !== ActiveTool.Crop || !selectedId || !cropState) return undefined;
    const pid = selectedId;
    return {
      cropState,
      imageAspect,
      onChange: (patch: Partial<typeof cropState>) => cropStore.setCrop(pid, patch),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, selectedId, cropState, imageAspect]);

  return { cropInteractionProps, cropState };
}
