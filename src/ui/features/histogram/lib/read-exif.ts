import exifr from 'exifr';

export interface PhotoExif {
  iso?: number;
  aperture?: number;
  shutterSpeed?: string; // formatted, e.g. "1/15"
  focalLength?: number;
  make?: string;
  model?: string;
  captureDate?: Date;
}

export async function readExifFromDataUrl(dataUrl: string): Promise<PhotoExif> {
  return readExifFromBuffer(dataUrl);
}

export async function readExifFromBuffer(buffer: ArrayBuffer | string): Promise<PhotoExif> {
  try {
    const data = await exifr.parse(buffer, {
      pick: ['ISO', 'FNumber', 'ExposureTime', 'FocalLength', 'Make', 'Model', 'DateTimeOriginal', 'CreateDate'],
    });
    if (!data) return {};

    const result: PhotoExif = {};
    if (data.ISO)          result.iso          = data.ISO;
    if (data.FNumber)      result.aperture     = data.FNumber;
    if (data.FocalLength)  result.focalLength  = Math.round(data.FocalLength);
    if (data.Make)         result.make         = String(data.Make).trim();
    if (data.Model)        result.model        = String(data.Model).trim();
    if (data.ExposureTime) {
      const t = data.ExposureTime as number;
      result.shutterSpeed = t >= 1 ? `${t}s` : `1/${Math.round(1 / t)}`;
    }
    const dt = data.DateTimeOriginal ?? data.CreateDate;
    if (dt instanceof Date) result.captureDate = dt;
    return result;
  } catch {
    return {};
  }
}
