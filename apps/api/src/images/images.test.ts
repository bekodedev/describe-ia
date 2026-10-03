import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { HttpError } from '../http-errors.js';
import { detectImageType } from './detect.js';
import { prepareImage } from './prepare.js';
import { createImageStore } from './storage.js';

const blank = (width: number, height: number, channels: 3 | 4 = 3) =>
  sharp({ create: { width, height, channels, background: { r: 10, g: 120, b: 200, alpha: 0.5 } } });
const sizeOf = async (base64: string) => sharp(Buffer.from(base64, 'base64')).metadata();

describe('detectImageType (magic bytes)', () => {
  it('recognises JPEG, PNG and WebP by their content', async () => {
    expect(detectImageType(await blank(8, 8).jpeg().toBuffer())).toBe('image/jpeg');
    expect(detectImageType(await blank(8, 8).png().toBuffer())).toBe('image/png');
    expect(detectImageType(await blank(8, 8).webp().toBuffer())).toBe('image/webp');
  });

  it('refuses everything else, whatever the file is called', async () => {
    expect(detectImageType(Buffer.from('plain text'))).toBeNull();
    expect(detectImageType(Buffer.from('GIF89a'))).toBeNull();
    expect(detectImageType(await blank(8, 8).tiff().toBuffer())).toBeNull();
    expect(detectImageType(Buffer.from('%PDF-1.7'))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
    expect(detectImageType(Buffer.from('RIFF....WAVE'))).toBeNull(); // RIFF, but not WebP
  });
});

describe('prepareImage', () => {
  it('shrinks a large photo to 1024 px on the longest side and sends a JPEG', async () => {
    const original = await blank(3000, 2000).png().toBuffer();
    const image = await prepareImage(original);

    expect(image.original).toBe(original);
    expect(image.originalType).toBe('image/png');
    expect(await sizeOf(image.base64)).toMatchObject({ format: 'jpeg', width: 1024, height: 683 });
  });

  it('does not enlarge a small photo', async () => {
    const image = await prepareImage(await blank(300, 200).jpeg().toBuffer());
    expect(await sizeOf(image.base64)).toMatchObject({ width: 300, height: 200 });
  });

  it('applies the EXIF orientation before dropping the metadata', async () => {
    const sideways = await blank(200, 100).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const meta = await sizeOf((await prepareImage(sideways)).base64);
    expect(meta).toMatchObject({ width: 100, height: 200 });
  });

  it('flattens transparency (JPEG has none)', async () => {
    const image = await prepareImage(await blank(50, 50, 4).png().toBuffer());
    expect((await sizeOf(image.base64)).hasAlpha).toBe(false);
  });

  it('answers 400 for text with an image name and for a corrupt image', async () => {
    for (const bad of [Buffer.from('hello'), Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01])]) {
      const error = await prepareImage(bad).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HttpError);
      expect(error).toMatchObject({ status: 400, code: 'invalid_image' });
    }
  });
});

describe('createImageStore', () => {
  it('saves under a generated name with the right extension and never uses a client name', async () => {
    const store = createImageStore(await mkdtemp(join(tmpdir(), 'store-')));
    const png = await blank(8, 8).png().toBuffer();

    const name = await store.save(png, 'image/png');

    expect(name).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(await readFile(join(store.dir, name))).toEqual(png);
    await store.remove(name);
    await expect(readFile(join(store.dir, name))).rejects.toThrow();
    await store.remove(name); // removing twice is fine
  });
});
