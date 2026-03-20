import { useCallback, useEffect, useRef, useState } from 'react';
import { ActiveView } from '../const';
import { useCatalogStore } from '../store/catalog-store';
import { generateThumbnailDataUrl } from '@/widgets/image-canvas/lib/image-utils';

export type ImportProgress = { current: number; total: number } | null;
const FULL_RES_CACHE_LIMIT = 24;

export function usePhotos() {
  const [photos, setPhotos] = useState<ImportedPhoto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDataUrl, setSelectedDataUrl] = useState<string>('');
  const [activeView, setActiveView] = useState<ActiveView>(ActiveView.Library);
  const [importProgress, setImportProgress] = useState<ImportProgress>(null);
  const fullResCacheRef = useRef<Map<string, string>>(new Map());
  const selectedIdRef = useRef<string | null>(null);

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

  const buildThumbnail = useCallback(async (dataUrl: string, orientation: number) => {
    try {
      return await generateThumbnailDataUrl(dataUrl, orientation);
    } catch (err) {
      console.error('Failed to build thumbnail:', err);
      return '';
    }
  }, []);

  const cacheFullRes = useCallback((id: string, dataUrl: string) => {
    const cache = fullResCacheRef.current;
    cache.delete(id);
    cache.set(id, dataUrl);
    while (cache.size > FULL_RES_CACHE_LIMIT) {
      const oldestKey = cache.keys().next().value;
      if (!oldestKey) break;
      cache.delete(oldestKey);
    }
  }, []);

  // Listen for import progress from main process
  useEffect(() => {
    const unsub = window.electron.onImportProgress(setImportProgress);
    return unsub;
  }, []);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // On catalog load: show photos immediately, stream thumbnails in
  useEffect(() => {
    if (!isLoaded) return;
    if (catalogPhotos.length === 0) {
      fullResCacheRef.current.clear();
      queueMicrotask(() => {
        setPhotos([]);
        setSelectedId(null);
        setSelectedDataUrl('');
      });
      return;
    }

    // Show all photos instantly (no thumbnails yet)
    fullResCacheRef.current.clear();
    queueMicrotask(() => {
      setPhotos(catalogPhotos.map((p) => ({ ...p, dataUrl: '', thumbnailDataUrl: '' })));
      setSelectedDataUrl('');
      if (catalogSelectedId) setSelectedId(catalogSelectedId);
    });

    // Stream thumbnails in batches
    let cancelled = false;
    const BATCH_SIZE = 10;

    const loadThumbnails = async () => {
      for (let i = 0; i < catalogPhotos.length; i += BATCH_SIZE) {
        if (cancelled) return;
        const batch = catalogPhotos.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(async (p) => {
            const shouldRebuild = p.orientation >= 5 && p.orientation <= 8;
            if (shouldRebuild) {
              const full = await window.electron.photo.loadFromPath(p.filePath);
              if (!full) return { id: p.id, thumbnailDataUrl: '' };
              const thumbnailDataUrl = await buildThumbnail(full.dataUrl, p.orientation);
              if (thumbnailDataUrl) {
                await window.electron.photo.saveThumbnail(p.id, thumbnailDataUrl);
              }
              return { id: p.id, thumbnailDataUrl };
            }
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
  }, [buildThumbnail, catalogPhotos, catalogSelectedId, isLoaded]);

  // Lazy load full-res when a photo is selected
  useEffect(() => {
    if (!selectedId) return;

    const cached = fullResCacheRef.current.get(selectedId);
    if (cached) {
      setSelectedDataUrl(cached);
      return;
    }

    const photo = photos.find((p) => p.id === selectedId);
    if (!photo) return;
    let cancelled = false;
    const requestedId = selectedId;

    window.electron.photo.loadFromPath(photo.filePath).then((result) => {
      if (!result || cancelled) return;
      cacheFullRes(requestedId, result.dataUrl);
      if (selectedIdRef.current === requestedId) {
        setSelectedDataUrl(result.dataUrl);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [cacheFullRes, photos, selectedId]);

  const selectedMeta = photos.find((p) => p.id === selectedId) ?? null;
  const selected = selectedMeta
    ? { ...selectedMeta, dataUrl: selectedDataUrl }
    : null;
  const imageAspect = selected?.width && selected?.height ? selected.width / selected.height : 1;

  const handleSetSelectedId = useCallback((id: string | null) => {
    setSelectedDataUrl(id ? (fullResCacheRef.current.get(id) ?? '') : '');
    setSelectedId(id);
    catalogSetId(id);
    saveToDisk();
  }, [catalogSetId, saveToDisk]);

  const handleImport = useCallback(async () => {
    const imported = await window.electron.importPhotos();
    if (imported.length === 0) return;
    const importedWithThumbnails = await Promise.all(
      imported.map(async (photo) => ({
        ...photo,
        thumbnailDataUrl: await buildThumbnail(photo.dataUrl, photo.orientation),
      })),
    );
    const importedForList = importedWithThumbnails.map(({ dataUrl: _dataUrl, ...photo }) => ({
      ...photo,
      dataUrl: '',
    }));
    setPhotos((prev) => {
      const ids = new Set(prev.map((p) => p.id));
      return [...prev, ...importedForList.filter((p) => !ids.has(p.id))];
    });
    // Save to catalog (without dataUrl, but with thumbnail info)
    const catalogEntries: CatalogPhoto[] = importedWithThumbnails.map(({ dataUrl: _d, thumbnailDataUrl: _t, ...rest }) => ({
      ...rest,
      thumbnailPath: '',
      rating: 0,
      tags: [],
    }));
    // Generate thumbnails and update paths
    for (let i = 0; i < catalogEntries.length; i++) {
      const entry = catalogEntries[i];
      const thumbnailDataUrl = importedWithThumbnails[i]?.thumbnailDataUrl;
      if (!thumbnailDataUrl) continue;
      const thumb = await window.electron.photo.saveThumbnail(entry.id, thumbnailDataUrl);
      if (thumb) entry.thumbnailPath = thumb.thumbnailPath;
    }
    addPhotos(catalogEntries);
    cacheFullRes(importedWithThumbnails[0].id, importedWithThumbnails[0].dataUrl);
    setSelectedDataUrl(importedWithThumbnails[0].dataUrl);
    setSelectedId(importedWithThumbnails[0].id);
    catalogSetId(importedWithThumbnails[0].id);
    saveToDisk();
  }, [addPhotos, buildThumbnail, cacheFullRes, catalogSetId, saveToDisk]);

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
    fullResCacheRef.current.delete(id);
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
      setSelectedDataUrl('');
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
      fullResCacheRef.current.delete(id);
      catalogDeletePhoto(id);
    }
    setPhotos((prev) => prev.filter((p) => !ids.has(p.id)));
    if (selectedId && ids.has(selectedId)) {
      setSelectedId(null);
      setSelectedDataUrl('');
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
    setSelectedDataUrl(fullResCacheRef.current.get(id) ?? '');
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
