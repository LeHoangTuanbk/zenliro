import { useCallback, useEffect, useState } from 'react';
import { ActiveView } from '../const';
import { useCatalogStore } from '../store/catalog-store';

export type ImportProgress = { current: number; total: number } | null;

export function usePhotos() {
  const [photos, setPhotos] = useState<ImportedPhoto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>(ActiveView.Library);
  const [importProgress, setImportProgress] = useState<ImportProgress>(null);

  const {
    isLoaded,
    photos: catalogPhotos,
    selectedId: catalogSelectedId,
    addPhotos,
    setSelectedId: catalogSetId,
    deletePhoto: catalogDeletePhoto,
    reorderPhotos: catalogReorderPhotos,
    saveToDisk,
  } = useCatalogStore();

  // Listen for import progress from main process
  useEffect(() => {
    const unsub = window.electron.onImportProgress(setImportProgress);
    return unsub;
  }, []);

  // On catalog load: show photos immediately, stream thumbnails in
  useEffect(() => {
    if (!isLoaded || catalogPhotos.length === 0) return;

    // Show all photos instantly (no thumbnails yet)
    setPhotos(catalogPhotos.map((p) => ({ ...p, dataUrl: '', thumbnailDataUrl: '' })));
    if (catalogSelectedId) setSelectedId(catalogSelectedId);

    // Stream thumbnails in batches
    let cancelled = false;
    const BATCH_SIZE = 10;

    const loadThumbnails = async () => {
      for (let i = 0; i < catalogPhotos.length; i += BATCH_SIZE) {
        if (cancelled) return;
        const batch = catalogPhotos.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(async (p) => {
            if (!p.thumbnailPath) return { id: p.id, thumbnailDataUrl: '' };
            const thumb = await window.electron.photo.loadThumbnail(p.thumbnailPath);
            return { id: p.id, thumbnailDataUrl: thumb?.thumbnailDataUrl ?? '' };
          }),
        );
        if (cancelled) return;
        const thumbMap = new Map(results.map((r) => [r.id, r.thumbnailDataUrl]));
        setPhotos((prev) =>
          prev.map((p) => {
            const thumb = thumbMap.get(p.id);
            return thumb != null ? { ...p, thumbnailDataUrl: thumb } : p;
          }),
        );
      }
    };

    loadThumbnails();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  // Lazy load full-res when a photo is selected
  useEffect(() => {
    if (!selectedId) return;
    const photo = photos.find((p) => p.id === selectedId);
    if (!photo || photo.dataUrl) return;

    window.electron.photo.loadFromPath(photo.filePath).then((result) => {
      if (!result) return;
      setPhotos((prev) =>
        prev.map((p) => (p.id === selectedId ? { ...p, dataUrl: result.dataUrl } : p)),
      );
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

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
    // Save to catalog (without dataUrl, but with thumbnail info)
    const catalogEntries: CatalogPhoto[] = imported.map(({ dataUrl: _d, thumbnailDataUrl: _t, ...rest }) => ({
      ...rest,
      thumbnailPath: '',
      rating: 0,
      tags: [],
    }));
    // Generate thumbnails and update paths
    for (const entry of catalogEntries) {
      const thumb = await window.electron.photo.generateThumbnail(entry.filePath, entry.id);
      if (thumb) entry.thumbnailPath = thumb.thumbnailPath;
    }
    addPhotos(catalogEntries);
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

  const handleDelete = useCallback(async (id: string) => {
    const catalogPhoto = catalogPhotos.find((p) => p.id === id);
    const thumbPath = catalogPhoto?.thumbnailPath ?? '';
    await window.electron.photo.deletePhoto(id, thumbPath);
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
      catalogSetId(null);
    }
    catalogDeletePhoto(id);
    saveToDisk();
  }, [catalogPhotos, selectedId, catalogSetId, catalogDeletePhoto, saveToDisk]);

  const handleBulkDelete = useCallback(async (ids: Set<string>) => {
    for (const id of ids) {
      const catalogPhoto = catalogPhotos.find((p) => p.id === id);
      const thumbPath = catalogPhoto?.thumbnailPath ?? '';
      await window.electron.photo.deletePhoto(id, thumbPath);
      catalogDeletePhoto(id);
    }
    setPhotos((prev) => prev.filter((p) => !ids.has(p.id)));
    if (selectedId && ids.has(selectedId)) {
      setSelectedId(null);
      catalogSetId(null);
    }
    saveToDisk();
  }, [catalogPhotos, selectedId, catalogSetId, catalogDeletePhoto, saveToDisk]);

  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    setPhotos((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    catalogReorderPhotos(fromIndex, toIndex);
    saveToDisk();
  }, [catalogReorderPhotos, saveToDisk]);

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
    importProgress,
    setSelectedId: handleSetSelectedId,
    setActiveView,
    handleImport,
    handleImageLoaded,
    handleDelete,
    handleBulkDelete,
    handleReorder,
    openDevelop,
  };
}
