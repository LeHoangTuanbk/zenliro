export const RAW_EXTENSIONS = [
  'cr2',
  'cr3',
  'nef',
  'arw',
  'dng',
  'raf',
  'orf',
  'rw2',
  'pef',
  'srw',
  'x3f',
  '3fr',
  'rwl',
  'mrw',
  'kdc',
  'dcr',
  'raw',
] as const;

export const RAW_MIME_TYPE = 'image/x-raw';

export function isRawExtension(ext: string): boolean {
  return RAW_EXTENSIONS.includes(ext.toLowerCase() as (typeof RAW_EXTENSIONS)[number]);
}

export function isRawMimeType(mimeType: string): boolean {
  return mimeType === RAW_MIME_TYPE;
}
