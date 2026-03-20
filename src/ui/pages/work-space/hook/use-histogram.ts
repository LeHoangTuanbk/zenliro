import { useEffect, useMemo, useState, type RefObject } from 'react';
import { useAdjustmentsStore } from '@/features/develop/edit/store/adjustments-store';
import {
  histogramFromDataUrl,
  computeHistogram,
  type HistogramData,
} from '@features/histogram/lib/compute-histogram';
import { readExifFromDataUrl, type PhotoExif } from '@features/histogram/lib/read-exif';
import type { ImageCanvasHandle } from '@widgets/image-canvas/ui/image-canvas';

export function useHistogram(
  selectedDataUrl: string | null | undefined,
  canvasRef: RefObject<ImageCanvasHandle | null>,
) {
  const [asyncHistogram, setAsyncHistogram] = useState<HistogramData | null>(null);
  const [exifData, setExifData] = useState<PhotoExif | null>(null);
  const adjustments = useAdjustmentsStore((s) => s.adjustments);

  useEffect(() => {
    if (!selectedDataUrl) {
      setAsyncHistogram(null);
      setExifData(null);
      return;
    }
    let cancelled = false;
    histogramFromDataUrl(selectedDataUrl).then((d) => {
      if (!cancelled) setAsyncHistogram(d);
    });
    readExifFromDataUrl(selectedDataUrl).then((e) => {
      if (!cancelled) setExifData(e);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedDataUrl]);

  const histogramData = useMemo(() => {
    const pixels = canvasRef.current?.getRenderedPixels();
    if (!pixels) return asyncHistogram;
    return computeHistogram(pixels.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjustments, asyncHistogram]);

  return { histogramData, exifData };
}
