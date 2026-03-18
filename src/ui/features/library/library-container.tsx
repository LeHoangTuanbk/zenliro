import { LibraryView } from './ui/library-view';
import { LibraryInfoPanel } from '@features/histogram/ui/library-info-panel';
import type { HistogramData } from '@features/histogram/lib/compute-histogram';
import type { PhotoExif } from '@features/histogram/lib/read-exif';

type LibraryContainerProps = {
  photos: ImportedPhoto[];
  selectedId: string | null;
  selected: ImportedPhoto | null;
  histogramData: HistogramData | null;
  exifData: PhotoExif | null;
  onSelect: (id: string) => void;
  onImport: () => void;
  onOpenDevelop: (id: string) => void;
};

export function LibraryContainer({
  photos,
  selectedId,
  selected,
  histogramData,
  exifData,
  onSelect,
  onImport,
  onOpenDevelop,
}: LibraryContainerProps) {
  return (
    <div className="flex flex-1 overflow-hidden">
      <LibraryView
        photos={photos}
        selectedId={selectedId}
        onSelect={onSelect}
        onImport={onImport}
        onOpenDevelop={onOpenDevelop}
      />
      {selected && (
        <aside className="w-[260px] bg-[#222] border-l border-black flex flex-col flex-shrink-0 overflow-y-auto">
          <LibraryInfoPanel photo={selected} histogramData={histogramData} exif={exifData} />
        </aside>
      )}
    </div>
  );
}
