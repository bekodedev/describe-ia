import type { ImageType } from '@describe-ia/shared';

const startsWith = (data: Buffer, bytes: number[], offset = 0) =>
  bytes.every((byte, i) => data[offset + i] === byte);

// The declared mimetype comes from the client and can say anything: the first bytes of the file
// are what it really is. Returns null for anything that is not a JPEG, PNG or WebP.
export function detectImageType(data: Buffer): ImageType | null {
  if (startsWith(data, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  // WebP: "RIFF" + 4 size bytes + "WEBP"
  if (startsWith(data, [0x52, 0x49, 0x46, 0x46]) && startsWith(data, [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'image/webp';
  }
  return null;
}
