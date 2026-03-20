import { useState, useCallback } from 'react';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';

export function useDragReorder(
  photos: ImportedPhoto[],
  onReorder: (from: number, to: number) => void,
) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const fromIndex = photos.findIndex((p) => p.id === active.id);
    const toIndex = photos.findIndex((p) => p.id === over.id);
    if (fromIndex === -1 || toIndex === -1) return;

    onReorder(fromIndex, toIndex);
  }, [photos, onReorder]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const activePhoto = activeId ? photos.find((p) => p.id === activeId) ?? null : null;

  return { activeId, activePhoto, handleDragStart, handleDragEnd, handleDragCancel };
}
