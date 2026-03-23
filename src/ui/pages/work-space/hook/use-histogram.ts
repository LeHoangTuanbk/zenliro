import { useEffect, useRef, useState, type RefObject } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAdjustmentsStore } from '@/features/develop/edit/store/adjustments-store';
import {
  histogramFromDataUrl,
  histogramFromArrayBuffer,
  computeHistogram,
  type HistogramData,
} from '@features/histogram/lib/compute-histogram';
import { readExifFromBuffer, type PhotoExif } from '@features/histogram/lib/read-exif';
import type { ImageCanvasHandle } from '@widgets/image-canvas/ui/image-canvas';
import type { ActiveView } from '../const';

const HISTOGRAM_DEBOUNCE_MS = 80;

export function useHistogram(
  activeView: ActiveView,
  selectedId: string | null,
  thumbnailDataUrl: string | null,
  imageBuffer: ArrayBuffer | null,
  imageMimeType: string | null,
  canvasRef: RefObject<ImageCanvasHandle | null>,
) {
  const adjustments = useAdjustmentsStore((s) => s.adjustments);
  const useThumbnailHistogram = activeView === 'library' && !!thumbnailDataUrl;
  const [liveHistogram, setLiveHistogram] = useState<HistogramData | null>(null);

  const histogramQuery = useQuery({
    queryKey: ['photo-histogram', selectedId, useThumbnailHistogram ? 'thumbnail' : 'full'],
    queryFn: () => (
      useThumbnailHistogram
        ? histogramFromDataUrl(thumbnailDataUrl!)
        : histogramFromArrayBuffer(imageBuffer!, imageMimeType ?? 'image/jpeg')
    ),
    enabled: !!selectedId && (useThumbnailHistogram || !!imageBuffer),
    placeholderData: (previousData) => previousData,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });

  const exifQuery = useQuery({
    queryKey: ['photo-exif', selectedId],
    queryFn: () => readExifFromBuffer(imageBuffer!),
    enabled: activeView === 'develop' && !!selectedId && !!imageBuffer,
    placeholderData: (previousData) => previousData,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });

  // Debounced live histogram from canvas pixels (reacts to adjustment changes + image load)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (activeView !== 'develop') return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const pixels = canvasRef.current?.getRenderedPixels();
      if (pixels) {
        setLiveHistogram(computeHistogram(pixels.data, pixels.width, pixels.height));
      }
    }, HISTOGRAM_DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjustments, selectedId, activeView, imageBuffer]);

  // Clear live histogram when switching photos
  const prevPhotoRef = useRef(selectedId);
  if (selectedId !== prevPhotoRef.current) {
    prevPhotoRef.current = selectedId;
    setLiveHistogram(null);
  }

  // In develop view: prefer live canvas histogram, fallback to query
  // In library view: always use query (thumbnail-based)
  const histogramData = activeView === 'develop'
    ? (liveHistogram ?? histogramQuery.data ?? null)
    : (histogramQuery.data ?? null);

  return {
    histogramData: histogramData as HistogramData | null,
    exifData: (exifQuery.data ?? null) as PhotoExif | null,
  };
}
