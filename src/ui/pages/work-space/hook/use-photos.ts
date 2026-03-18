import { useCallback, useEffect, useState } from 'react';
import { ActiveView } from '../const';
import { useCatalogStore } from '../store/catalog-store';

export function usePhotos() {
  const [photos, setPhotos] = useState<ImportedPhoto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>(ActiveView.Library);

  const { isLoaded, photos: catalogPhotos, selectedId: catalogSelectedId, addPhotos, setSelectedId: catalogSetId, saveToDisk } = useCatalogStore();

  // On catalog load: restore photos (load dataUrls from disk) and selectedId
  useEffect(() => {
    if (!isLoaded || catalogPhotos.length === 0) return;

    const loadAll = async () => {
      const restored: ImportedPhoto[] = [];
      for (const p of catalogPhotos) {
        const result = await window.electron.photo.loadFromPath(p.filePath);
        if (result) {
          restored.push({ ...p, dataUrl: result.dataUrl });
        }
      }
      setPhotos(restored);
      if (catalogSelectedId) setSelectedId(catalogSelectedId);
    };

    loadAll();
  // Run once after catalog loads
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  const selected = photos.find((p) => p.id === selectedId) ?? null;
  const imageAspect = selected?.width && selected?.height ? selected.width / selected.height : 1;

  const handleSetSelectedId = useCallback((id: string | null) => {
    setSelectedId(id);
    catalogSetId(id);
    saveToDisk();
  }, [catalogSetId, saveToDisk]);

  const handleImport = useCallback(async () => {
    const imported = await window.electron.importPhotos();
    if (imported.length === 0) return;
    setPhotos((prev) => {
      const ids = new Set(prev.map((p) => p.id));
      return [...prev, ...imported.filter((p) => !ids.has(p.id))];
    });
    // Save to catalog (without dataUrl)
    addPhotos(imported.map(({ dataUrl: _d, ...rest }) => rest));
    setSelectedId(imported[0].id);
    catalogSetId(imported[0].id);
    saveToDisk();
  }, [addPhotos, catalogSetId, saveToDisk]);

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
    catalogSetId(id);
    setActiveView(ActiveView.Develop);
  }, [catalogSetId]);

  return {
    photos,
    selectedId,
    selected,
    imageAspect,
    activeView,
    setSelectedId: handleSetSelectedId,
    setActiveView,
    handleImport,
    handleImageLoaded,
    openDevelop,
  };
}
