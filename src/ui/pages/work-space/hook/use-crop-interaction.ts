import { useMemo } from 'react';
import { useCropStore } from '@/features/develop/crop/store/crop-store';
import { DEFAULT_CROP_STATE, type CropState } from '@/features/develop/crop/store/types';
import { ActiveTool } from '@features/develop/const';

export function useCropInteraction(
  activeTool: ActiveTool,
  selectedId: string | null,
  imageAspect: number,
) {
  const storedCrop = useCropStore((s) => (selectedId ? s.cropByPhoto[selectedId] : undefined));
  const cropState = useMemo(
    () => (selectedId ? (storedCrop ?? DEFAULT_CROP_STATE) : null),
    [selectedId, storedCrop],
  );

  const cropInteractionProps = useMemo(() => {
    if (activeTool !== ActiveTool.Crop || !selectedId || !cropState) return undefined;
    const pid = selectedId;
    return {
      cropState,
      imageAspect,
      onChange: (patch: Partial<CropState>) =>
        useCropStore.getState().setCrop(pid, patch, imageAspect),
    };
  }, [activeTool, selectedId, cropState, imageAspect]);

  return { cropInteractionProps, cropState };
}
