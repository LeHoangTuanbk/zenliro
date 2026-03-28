import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// heic-convert is CJS, no type definitions
const heicConvert = require('heic-convert') as (
  options: { buffer: Buffer; format: 'JPEG' | 'PNG'; quality: number }
) => Promise<Buffer>;

const HEIC_EXTENSIONS = new Set(['heic', 'heif']);

export function isHeic(ext: string): boolean {
  return HEIC_EXTENSIONS.has(ext.toLowerCase());
}

export async function convertHeicToJpeg(buffer: Buffer): Promise<Buffer> {
  const output = await heicConvert({
    buffer,
    format: 'JPEG',
    quality: 0.95,
  });
  return Buffer.from(output);
}
