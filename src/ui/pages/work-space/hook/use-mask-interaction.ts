import { useMaskStore } from '@/features/develop/mask';
import type { MaskInteractionProps } from '@widgets/image-canvas/store/types';
import { ActiveTool } from '@features/develop/const';

export function useMaskInteraction(
  photoId: string | null,
  activeTool: string,
): MaskInteractionProps | undefined {
  const selectedMaskId = useMaskStore((s) => s.selectedMaskId);
  const selectedMask = useMaskStore((s) =>
    photoId ? (s.masksByPhoto[photoId] ?? []).find((m) => m.id === selectedMaskId) : null,
  );
  const brushSizePx = useMaskStore((s) => s.brushSizePx);
  const brushFeather = useMaskStore((s) => s.brushFeather);
  const brushOpacity = useMaskStore((s) => s.brushOpacity);
  const brushErase = useMaskStore((s) => s.brushErase);
  const addStroke = useMaskStore((s) => s.addStroke);
  const setBrushSizePx = useMaskStore((s) => s.setBrushSizePx);
  const setLinearData = useMaskStore((s) => s.setLinearData);
  const setRadialData = useMaskStore((s) => s.setRadialData);

  if (activeTool !== ActiveTool.Mask || !photoId || !selectedMaskId || !selectedMask) {
    return undefined;
  }

  if (selectedMask.mask.type === 'brush') {
    return {
      maskType: 'brush',
      photoId,
      selectedMaskId,
      brushSizePx,
      brushFeather,
      brushOpacity,
      brushErase,
      strokes: selectedMask.mask.strokes,
      onStrokeAdded: (stroke) => addStroke(photoId, selectedMaskId, stroke),
      onBrushSizeChange: setBrushSizePx,
    };
  }

  if (selectedMask.mask.type === 'linear') {
    return {
      maskType: 'linear',
      photoId,
      selectedMaskId,
      linearData: selectedMask.mask.data,
      onUpdate: (data) => setLinearData(photoId, selectedMaskId, data),
    };
  }

  // radial
  return {
    maskType: 'radial',
    photoId,
    selectedMaskId,
    radialData: selectedMask.mask.data,
    onUpdate: (data) => setRadialData(photoId, selectedMaskId, data),
  };
}
