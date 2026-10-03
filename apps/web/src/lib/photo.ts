import { IMAGE_MAX_BYTES, IMAGE_TYPES } from '@describe-ia/shared';

// Same limits as the API (it checks again: the bytes, not only the declared type). Checking here
// just saves a round trip.
export function checkPhoto(file: File): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'Use a JPEG, PNG or WebP image.';
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return `The photo is larger than ${IMAGE_MAX_BYTES / 1024 / 1024} MB.`;
  }
  return null;
}
