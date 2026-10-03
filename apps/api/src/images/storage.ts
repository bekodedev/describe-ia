import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { ImageType } from '@describe-ia/shared';

const EXTENSIONS: Record<ImageType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// Photos live on a local disk (a Docker volume). Files get a generated name, never the client's;
// the name is what products.image_path stores. Replace with object storage if the API scales out.
export function createImageStore(directory: string) {
  const dir = resolve(directory);

  return {
    dir,

    async save(image: Buffer, type: ImageType): Promise<string> {
      await mkdir(dir, { recursive: true });
      const name = `${randomUUID()}.${EXTENSIONS[type]}`;
      await writeFile(join(dir, name), image);
      return name;
    },

    remove: (name: string) => rm(join(dir, name), { force: true }),
  };
}

export type ImageStore = ReturnType<typeof createImageStore>;
