import { useCallback, useState } from 'react';
import { ActiveView } from '../const';

export function usePhotos() {
  const [photos, setPhotos] = useState<ImportedPhoto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>(ActiveView.Library);

  const selected = photos.find((p) => p.id === selectedId) ?? null;
  const imageAspect = selected?.width && selected?.height ? selected.width / selected.height : 1;

  const handleImport = useCallback(async () => {
    const imported = await window.electron.importPhotos();
    if (imported.length === 0) return;
    setPhotos((prev) => {
      const ids = new Set(prev.map((p) => p.id));
      return [...prev, ...imported.filter((p) => !ids.has(p.id))];
    });
    setSelectedId(imported[0].id);
  }, []);

  const handleImageLoaded = useCallback(
    (w: number, h: number) => {
      setPhotos((prev) =>
        prev.map((p) => (p.id === selectedId ? { ...p, width: w, height: h } : p)),
      );
    },
    [selectedId],
  );

  const openDevelop = useCallback((id: string) => {
    setSelectedId(id);
    setActiveView(ActiveView.Develop);
  }, []);

  return {
    photos,
    selectedId,
    selected,
    imageAspect,
    activeView,
    setSelectedId,
    setActiveView,
    handleImport,
    handleImageLoaded,
    openDevelop,
  };
}
