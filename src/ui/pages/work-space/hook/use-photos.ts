import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createRendererLogger } from '@shared/lib/logger';
import { ActiveView } from '../const';

const log = createRendererLogger('photos');
import { useCatalogStore } from '../store/catalog-store';
import { generateThumbnailDataUrlFromArrayBuffer } from '@widgets/image-canvas';
import { isRawMimeType, extractRawThumbnail } from '@shared/lib/raw';
import { photoResourceQueryOptions } from './use-photo-resource';
import { useHistoryStore } from '@/features/develop/history';
import { useMaskStore } from '@/features/develop/mask';
import { useCropStore } from '@/features/develop/crop';
import { useHealStore } from '@/features/develop/heal';

function cleanupPhotoEdits(photoId: string) {
  useHistoryStore.getState().clearPhoto(photoId);
  useMaskStore.getState().removePhoto(photoId);
  useCropStore.getState().removePhoto(photoId);
  useHealStore.getState().removePhoto(photoId);
}

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
  const catalogReorderLibrary = useCatalogStore((s) => s.reorderLibrary);
  const saveToDisk = useCatalogStore((s) => s.saveToDisk);

  const buildThumbnail = useCallback(
    async (buffer: ArrayBuffer, mimeType: string, orientation: number) => {
      try {
        if (isRawMimeType(mimeType)) {
          const result = await extractRawThumbnail(buffer);
          return result?.dataUrl ?? '';
        }
        return await generateThumbnailDataUrlFromArrayBuffer(buffer, mimeType, orientation);
      } catch (err) {
        log.error('Failed to build thumbnail', err);
        return '';
      }
    },
    [],
  );

  // Main process import progress is fast (file reads only), skip it.
  // Renderer handles the full progress overlay (file read + thumbnail generation).

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
      if (id) log.info(`Photo selected: ${id.slice(0, 40)}...`);
    },
    [catalogSetId, saveToDisk],
  );

  const processImported = useCallback(
    async (imported: ImportedPhoto[]) => {
      if (imported.length === 0) return;
      log.info(`Importing ${imported.length} photo(s)...`);

      const total = imported.length;
      setImportProgress({ current: 0, total });

      const catalogEntries: CatalogPhoto[] = imported.map((photo) => ({
        ...photo,
        thumbnailPath: '',
        rating: 0,
        tags: [],
      }));

      const thumbnails = new Map<string, string>();
      for (let i = 0; i < imported.length; i++) {
        const photo = imported[i];
        setImportProgress({ current: i + 1, total });
        try {
          const resource = await window.electron.photo.loadFromPath(photo.filePath);
          if (!resource) continue;
          const bytes = resource.bytes;
          const buf = bytes.buffer;
          const buffer =
            buf instanceof ArrayBuffer
              ? buf.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
              : new Uint8Array(bytes).buffer.slice(0, bytes.byteLength);
          const thumbnailDataUrl = await buildThumbnail(
            buffer,
            resource.mimeType,
            photo.orientation,
          );
          if (!thumbnailDataUrl) continue;
          thumbnails.set(photo.id, thumbnailDataUrl);
          const thumb = await window.electron.photo.saveThumbnail(photo.id, thumbnailDataUrl);
          if (thumb) catalogEntries[i].thumbnailPath = thumb.thumbnailPath;
        } catch (err) {
          log.error('Failed to generate thumbnail', { filePath: photo.filePath, err });
        }
      }

      setImportProgress(null);

      const importedForList = imported.map((photo) => ({
        ...photo,
        dataUrl: '',
        thumbnailDataUrl: thumbnails.get(photo.id) ?? '',
      }));
      setPhotos((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        return [...prev, ...importedForList.filter((p) => !ids.has(p.id))];
      });
      addPhotos(catalogEntries);

      // Auto-add to active collection
      const activeColId = useCatalogStore.getState().activeCollectionId;
      if (activeColId) {
        useCatalogStore.getState().addPhotosToCollection(
          activeColId,
          imported.map((p) => p.id),
        );
      }

      setSelectedId(imported[0].id);
      catalogSetId(imported[0].id);
      log.info(`Import complete: ${imported.length} photo(s) added`);
      void queryClient.prefetchQuery(
        photoResourceQueryOptions({
          id: imported[0].id,
          filePath: imported[0].filePath,
        }),
      );
      saveToDisk();
    },
    [addPhotos, buildThumbnail, catalogSetId, queryClient, saveToDisk],
  );

  const handleImport = useCallback(async () => {
    const imported = await window.electron.importPhotos();
    await processImported(imported);
  }, [processImported]);

  const handleImportFromPaths = useCallback(
    async (paths: string[]) => {
      const imported = await window.electron.importPhotosFromPaths(paths);
      await processImported(imported);
    },
    [processImported],
  );

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
      cleanupPhotoEdits(id);
      log.info(`Photo deleted: ${id.slice(0, 40)}...`);
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
      const total = ids.size;
      if (total > 1) setImportProgress({ current: 0, total });

      let i = 0;
      for (const id of ids) {
        const catalogPhoto = catalogPhotos.find((p) => p.id === id);
        const thumbPath = catalogPhoto?.thumbnailPath ?? '';
        await window.electron.photo.deletePhoto(id, thumbPath);
        queryClient.removeQueries({ queryKey: ['photo-resource', id] });
        cleanupPhotoEdits(id);
        catalogDeletePhoto(id);
        i++;
        if (total > 1) setImportProgress({ current: i, total });
      }

      if (total > 1) setImportProgress(null);
      log.info(`Bulk delete complete: ${total} photo(s) removed`);
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
      // Inside collection: reorder local state only (collection photoIds order)
      saveToDisk();
    },
    [saveToDisk],
  );

  const openDevelop = useCallback(
    (id: string) => {
      setSelectedId(id);
      catalogSetId(id);
      setActiveView(ActiveView.Develop);
      log.info('Switched to Develop view');
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
    handleImportFromPaths,
    handleImageLoaded,
    handleDelete,
    handleBulkDelete,
    handleReorder,
    openDevelop,
  };
}
