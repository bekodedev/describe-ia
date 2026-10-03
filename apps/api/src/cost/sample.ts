import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { DEMO_USER_ID } from '../config/demo-user.js';
import { loadEnv } from '../config/env.js';
import { createPool } from '../db/pool.js';
import { EXPERIMENT_PRODUCTS } from '../generation/experiment-products.js';
import { generateDescriptions, defaultDeps } from '../generation/service.js';
import { prepareImage } from '../images/prepare.js';
import { readArgs } from './args.js';

// Real generations to measure the cost of (about) one in two with a photo:
//   pnpm --filter api cost:sample --count 40 --photos <folder with jpg/png/webp files>
// Always the public prompt, so the rows are labelled "v2" and comparable. The photos are paired with
// products at random: this measures tokens and money, not the quality of the text.
const args = readArgs();
const count = Number(args.count ?? 40);
const photoShare = Number(args['photo-share'] ?? 0.5);
if (!args.photos)
  throw new Error('Usage: cost:sample --count 40 --photos <folder> [--photo-share 0.5]');

const files = (await readdir(args.photos)).filter((f) =>
  ['.jpg', '.jpeg', '.png', '.webp'].includes(extname(f).toLowerCase()),
);
if (files.length === 0) throw new Error(`No photos in ${args.photos}`);

const pool = createPool(loadEnv().DATABASE_URL);
const deps = { ...defaultDeps(), allowPrivatePrompts: false };
let withPhoto = 0;
let failures = 0;

try {
  for (let i = 0; i < count; i++) {
    const product = EXPERIMENT_PRODUCTS[i % EXPERIMENT_PRODUCTS.length]!;
    const usePhoto = Math.floor((i + 1) * photoShare) > Math.floor(i * photoShare); // evenly spread
    const file = files[i % files.length]!;
    const image = usePhoto
      ? await prepareImage(await readFile(join(args.photos, file)))
      : undefined;
    try {
      await generateDescriptions(pool, { userId: DEMO_USER_ID, ...product, image }, deps);
      if (image) withPhoto++;
      console.log(
        `${i + 1}/${count} ok ${image ? `(photo ${file})` : '(text)'} ${product.title.slice(0, 40)}`,
      );
    } catch (error) {
      failures++;
      console.log(`${i + 1}/${count} FAILED ${(error as Error).message}`);
    }
  }
  console.log(
    `done: ${count - failures} generations, ${withPhoto} with a photo, ${failures} failed`,
  );
} finally {
  await pool.end();
}
