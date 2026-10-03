import type { ImageType } from '@describe-ia/shared';
import sharp from 'sharp';
import { HttpError } from '../http-errors.js';
import { detectImageType } from './detect.js';

const MAX_SIDE = 1024;
const JPEG_QUALITY = 80;

export interface PreparedImage {
  original: Buffer; // stored as uploaded
  originalType: ImageType;
  base64: string; // what the model gets: a JPEG, longest side at most 1024 px
}

// Image tokens grow with the pixels, so the model gets a smaller copy: same description quality
// for product photos, a fraction of the cost. The original is kept untouched for the shop.
export async function prepareImage(original: Buffer): Promise<PreparedImage> {
  const originalType = detectImageType(original);
  if (!originalType) {
    throw new HttpError(400, 'invalid_image', 'The file must be a JPEG, PNG or WebP image');
  }

  try {
    const resized = await sharp(original, { limitInputPixels: 50_000_000 })
      .rotate() // apply the EXIF orientation: the output has no metadata
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' }) // JPEG has no transparency
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
    return { original, originalType, base64: resized.toString('base64') };
  } catch {
    // Right signature, but the content is corrupt or absurdly large.
    throw new HttpError(400, 'invalid_image', 'The image could not be read');
  }
}
