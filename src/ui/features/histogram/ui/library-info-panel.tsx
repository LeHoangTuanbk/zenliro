import { Histogram } from './histogram';
import type { HistogramData } from '../lib/compute-histogram';
import type { PhotoExif } from '../lib/read-exif';

interface LibraryInfoPanelProps {
  photo: ImportedPhoto | null;
  histogramData: HistogramData | null;
  exif: PhotoExif | null;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-baseline py-[3px] border-b border-[#1e1e1e]">
      <span className="w-[90px] flex-shrink-0 text-right text-[9px] text-[#555] pr-2">{label}</span>
      <span className="flex-1 text-[9px] text-[#8a8a8a] truncate">{value || '—'}</span>
    </div>
  );
}

export function LibraryInfoPanel({ photo, histogramData, exif }: LibraryInfoPanelProps) {
  const folder = photo?.filePath
    ? photo.filePath.split(/[\\/]/).slice(0, -1).pop() ?? '—'
    : undefined;

  const dimensions =
    photo?.width && photo.height ? `${photo.width} × ${photo.height}` : undefined;

  const cameraModel =
    exif?.make && exif?.model
      ? `${exif.make} ${exif.model}`.replace(exif.make, '').trim() || exif.model
      : exif?.model;

  return (
    <div className="w-full flex flex-col">
      {/* Histogram */}
      <Histogram data={histogramData} exif={exif} />

      {/* Metadata section header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1e1e1e] border-b border-black">
        <span className="text-[10px] text-[#929292] font-medium tracking-wide">Metadata</span>
      </div>

      {/* Metadata rows */}
      <div className="px-1 py-1 bg-[#222]">
        <Row label="File Name"  value={photo?.fileName} />
        <Row label="Folder"     value={folder} />
        <Row label="File Size"  value={photo ? formatFileSize(photo.fileSize) : undefined} />
        <Row label="Dimensions" value={dimensions} />
        {cameraModel && <Row label="Camera" value={cameraModel} />}
        {exif?.captureDate && <Row label="Capture Date" value={formatDate(exif.captureDate)} />}
        {exif?.iso && (
          <Row label="Settings" value={[
            exif.iso        ? `ISO ${exif.iso}`           : '',
            exif.focalLength ? `${exif.focalLength} mm`  : '',
            exif.aperture   ? `f/${exif.aperture.toFixed(1)}` : '',
            exif.shutterSpeed ?? '',
          ].filter(Boolean).join('  ')} />
        )}
      </div>
    </div>
  );
}
