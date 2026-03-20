import { useEffect, useState } from 'react';
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';

export type PhotoBinaryData = {
  mimeType: string;
  buffer: ArrayBuffer;
};

type PhotoQueryInput = {
  id: string;
  filePath: string;
};

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

    const objectUrl = URL.createObjectURL(
      new Blob([query.data.buffer], { type: query.data.mimeType }),
    );
    queueMicrotask(() => setImageUrl(objectUrl));

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [query.data]);

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
