import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ActiveView } from '../const';
import { useCatalogStore } from '../store/catalog-store';
import { generateThumbnailDataUrlFromArrayBuffer } from '@/widgets/image-canvas/lib/image-utils';
import { photoResourceQueryOptions } from './use-photo-resource';

export type ImportProgress = { current: number; total: number } | null;
const PREFETCH_RADIUS = 2;

export function usePhotos() {
  const [photos, setPhotos] = useState<ImportedPhoto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>(ActiveView.Library);
  const [importProgress, setImportProgress] = useState<ImportProgress>(null);
  const queryClient = useQueryClient();
  const initialLoadDone = useRef(false);

  const isLoaded = useCatalogStore((s) => s.isLoaded);
  const catalogPhotos = useCatalogStore((s) => s.photos);
  const catalogSelectedId = useCatalogStore((s) => s.selectedId);
  const addPhotos = useCatalogStore((s) => s.addPhotos);
  const catalogSetId = useCatalogStore((s) => s.setSelectedId);
  const catalogDeletePhoto = useCatalogStore((s) => s.deletePhoto);
  const catalogReorderPhotos = useCatalogStore((s) => s.reorderPhotos);
  const saveToDisk = useCatalogStore((s) => s.saveToDisk);

  const buildThumbnail = useCallback(
    async (buffer: ArrayBuffer, mimeType: string, orientation: number) => {
      try {
        return await generateThumbnailDataUrlFromArrayBuffer(buffer, mimeType, orientation);
      } catch (err) {
        console.error('Failed to build thumbnail:', err);
        return '';
      }
    },
    [],
  );

  // Listen for import progress from main process
  useEffect(() => {
    const unsub = window.electron.onImportProgress(setImportProgress);
    return unsub;
  }, []);

  // On catalog initial load: show photos immediately, stream thumbnails in
  useEffect(() => {
    if (!isLoaded || initialLoadDone.current) return;
    initialLoadDone.current = true;

    if (catalogPhotos.length === 0) {
      setPhotos([]);
      setSelectedId(null);
      return;
    }

    // Show all photos instantly (no thumbnails yet)
    setPhotos(catalogPhotos.map((p) => ({ ...p, dataUrl: '', thumbnailDataUrl: '' })));
    if (catalogSelectedId) setSelectedId(catalogSelectedId);

    // Stream thumbnails in batches
    let cancelled = false;
    const BATCH_SIZE = 10;
    const photosSnapshot = [...catalogPhotos];

    const loadThumbnails = async () => {
      for (let i = 0; i < photosSnapshot.length; i += BATCH_SIZE) {
        if (cancelled) return;
        const batch = photosSnapshot.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(async (p) => {
            const shouldRebuild = p.orientation >= 5 && p.orientation <= 8;
            if (shouldRebuild) {
              const full = await queryClient.fetchQuery(
                photoResourceQueryOptions({
                  id: p.id,
                  filePath: p.filePath,
                }),
              );
              if (!full) return { id: p.id, thumbnailDataUrl: '' };
              const thumbnailDataUrl = await buildThumbnail(
                full.buffer,
                full.mimeType,
                p.orientation,
              );
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
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  useEffect(() => {
    if (activeView !== ActiveView.Develop || !selectedId || photos.length === 0) return;
    const selectedIndex = photos.findIndex((p) => p.id === selectedId);
    if (selectedIndex < 0) return;

    for (let offset = -PREFETCH_RADIUS; offset <= PREFETCH_RADIUS; offset++) {
      if (offset === 0) continue;
      const photo = photos[selectedIndex + offset];
      if (!photo) continue;
      void queryClient.prefetchQuery(
        photoResourceQueryOptions({
          id: photo.id,
          filePath: photo.filePath,
        }),
      );
    }
  }, [activeView, photos, queryClient, selectedId]);

  const selectedMeta = photos.find((p) => p.id === selectedId) ?? null;
  const selected = selectedMeta;
  const imageAspect = selected?.width && selected?.height ? selected.width / selected.height : 1;

  const handleSetSelectedId = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      catalogSetId(id);
      saveToDisk();
    },
    [catalogSetId, saveToDisk],
  );

  const handleImport = useCallback(async () => {
    const imported = await window.electron.importPhotos();
    if (imported.length === 0) return;
    const importedWithThumbnails = await Promise.all(
      imported.map(async (photo) => {
        const resource = await window.electron.photo.loadFromPath(photo.filePath);
        const thumbnailDataUrl = resource
          ? await buildThumbnail(
              (() => {
                const bytes = resource.bytes;
                const buf = bytes.buffer;
                return buf instanceof ArrayBuffer
                  ? buf.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
                  : new Uint8Array(bytes).buffer.slice(0, bytes.byteLength);
              })(),
              resource.mimeType,
              photo.orientation,
            )
          : '';
        return {
          ...photo,
          thumbnailDataUrl,
        };
      }),
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
    const catalogEntries: CatalogPhoto[] = importedWithThumbnails.map(
      ({ dataUrl: _d, thumbnailDataUrl: _t, ...rest }) => ({
        ...rest,
        thumbnailPath: '',
        rating: 0,
        tags: [],
      }),
    );
    // Generate thumbnails and update paths
    for (let i = 0; i < catalogEntries.length; i++) {
      const entry = catalogEntries[i];
      const thumbnailDataUrl = importedWithThumbnails[i]?.thumbnailDataUrl;
      if (!thumbnailDataUrl) continue;
      const thumb = await window.electron.photo.saveThumbnail(entry.id, thumbnailDataUrl);
      if (thumb) entry.thumbnailPath = thumb.thumbnailPath;
    }
    addPhotos(catalogEntries);
    setSelectedId(importedWithThumbnails[0].id);
    catalogSetId(importedWithThumbnails[0].id);
    void queryClient.prefetchQuery(
      photoResourceQueryOptions({
        id: importedWithThumbnails[0].id,
        filePath: importedWithThumbnails[0].filePath,
      }),
    );
    saveToDisk();
  }, [addPhotos, buildThumbnail, catalogSetId, queryClient, saveToDisk]);

  const handleImageLoaded = useCallback(
    (w: number, h: number) => {
      setPhotos((prev) =>
        prev.map((p) => (p.id === selectedId ? { ...p, width: w, height: h } : p)),
      );
    },
    [selectedId],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const catalogPhoto = catalogPhotos.find((p) => p.id === id);
      const thumbPath = catalogPhoto?.thumbnailPath ?? '';
      await window.electron.photo.deletePhoto(id, thumbPath);
      queryClient.removeQueries({ queryKey: ['photo-resource', id] });
      setPhotos((prev) => prev.filter((p) => p.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        catalogSetId(null);
      }
      catalogDeletePhoto(id);
      saveToDisk();
    },
    [catalogPhotos, selectedId, catalogSetId, catalogDeletePhoto, queryClient, saveToDisk],
  );

  const handleBulkDelete = useCallback(
    async (ids: Set<string>) => {
      for (const id of ids) {
        const catalogPhoto = catalogPhotos.find((p) => p.id === id);
        const thumbPath = catalogPhoto?.thumbnailPath ?? '';
        await window.electron.photo.deletePhoto(id, thumbPath);
        queryClient.removeQueries({ queryKey: ['photo-resource', id] });
        catalogDeletePhoto(id);
      }
      setPhotos((prev) => prev.filter((p) => !ids.has(p.id)));
      if (selectedId && ids.has(selectedId)) {
        setSelectedId(null);
        catalogSetId(null);
      }
      saveToDisk();
    },
    [catalogPhotos, selectedId, catalogSetId, catalogDeletePhoto, queryClient, saveToDisk],
  );

  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      setPhotos((prev) => {
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      });
      catalogReorderPhotos(fromIndex, toIndex);
      saveToDisk();
    },
    [catalogReorderPhotos, saveToDisk],
  );

  const openDevelop = useCallback(
    (id: string) => {
      setSelectedId(id);
      catalogSetId(id);
      setActiveView(ActiveView.Develop);
    },
    [catalogSetId],
  );

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
