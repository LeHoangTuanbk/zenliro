import { useEffect, useState } from 'react';
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { isRawMimeType, decodeRawToCanvas } from '@shared/lib/raw';

export type PhotoBinaryData = {
  mimeType: string;
  buffer: ArrayBuffer;
};

type PhotoQueryInput = {
  id: string;
  filePath: string;
};

/** Cache decoded RAW → JPEG blob URLs to avoid re-decoding */
const rawBlobUrlCache = new Map<string, string>();
const MAX_RAW_BLOB_CACHE = 12;

export function photoResourceQueryOptions(photo: PhotoQueryInput) {
  return queryOptions({
    queryKey: ['photo-resource', photo.id],
    queryFn: async (): Promise<PhotoBinaryData> => {
      const result = await window.electron.photo.loadFromPath(photo.filePath);
      if (!result) {
        throw new Error(`Failed to load photo from path: ${photo.filePath}`);
      }

      const bytes = result.bytes instanceof Uint8Array
        ? result.bytes
        : new Uint8Array(result.bytes);
      const buf = bytes.buffer;
      const buffer: ArrayBuffer =
        buf instanceof ArrayBuffer
          ? buf.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
          : new Uint8Array(bytes).buffer.slice(0, bytes.byteLength);
      return {
        mimeType: result.mimeType,
        buffer,
      };
    },
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });
}

export function usePhotoResource(photo: PhotoQueryInput | null) {
  const query = useQuery({
    ...photoResourceQueryOptions(photo ?? { id: '__none__', filePath: '' }),
    enabled: !!photo,
    placeholderData: (previousData) => previousData,
  });
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!query.data) {
      queueMicrotask(() => setImageUrl(null));
      return;
    }

    let revoke: (() => void) | null = null;
    let cancelled = false;
    const photoId = photo?.id ?? '';

    (async () => {
      let objectUrl: string;

      if (isRawMimeType(query.data.mimeType)) {
        // Check cache first
        const cached = rawBlobUrlCache.get(photoId);
        if (cached) {
          objectUrl = cached;
        } else {
          const result = await decodeRawToCanvas(query.data.buffer);
          if (cancelled) return;
          const blob = await new Promise<Blob>((resolve) =>
            result.canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92),
          );
          objectUrl = URL.createObjectURL(blob);
          // Evict oldest if cache is full
          if (rawBlobUrlCache.size >= MAX_RAW_BLOB_CACHE) {
            const oldest = rawBlobUrlCache.keys().next().value;
            if (oldest) {
              URL.revokeObjectURL(rawBlobUrlCache.get(oldest)!);
              rawBlobUrlCache.delete(oldest);
            }
          }
          rawBlobUrlCache.set(photoId, objectUrl);
        }
        // RAW blob URLs are managed by cache, not by cleanup
        revoke = null;
      } else {
        objectUrl = URL.createObjectURL(
          new Blob([query.data.buffer], { type: query.data.mimeType }),
        );
        revoke = () => URL.revokeObjectURL(objectUrl);
      }

      if (cancelled) {
        revoke?.();
        return;
      }
      queueMicrotask(() => setImageUrl(objectUrl));
    })();

    return () => {
      cancelled = true;
      revoke?.();
    };
  }, [query.data, photo?.id]);

  return {
    ...query,
    imageUrl,
    imageBuffer: query.data?.buffer ?? null,
    imageMimeType: query.data?.mimeType ?? null,
  };
}

export function usePrefetchPhotoResource() {
  const queryClient = useQueryClient();

  return (photo: PhotoQueryInput) =>
    queryClient.prefetchQuery(photoResourceQueryOptions(photo));
}
