import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { insertDescription } from '../db/descriptions.js';
import { withTransaction } from '../db/pool.js';
import { createProduct } from '../db/products.js';
import type { ImageStore } from '../images/storage.js';
import { DEMO_PRODUCTS } from './products.js';

export const DEMO_PHOTOS_DIR = fileURLToPath(new URL('../../demo/photos/', import.meta.url));

export interface SeedOptions {
  userId: string;
  language: string; // Spanish texts for "es", English for anything else
  store: ImageStore;
  photosDir?: string;
}

// Inserts the demo products with their descriptions and photos, no model involved. Safe to run twice:
// a product whose title already exists for the user is skipped. The first product is the newest.
export async function seedDemoProducts(pool: pg.Pool, options: SeedOptions) {
  const { userId, language, store, photosDir = DEMO_PHOTOS_DIR } = options;
  let created = 0;
  let skipped = 0;

  for (const [index, demo] of DEMO_PRODUCTS.entries()) {
    const exists = await pool.query('SELECT 1 FROM products WHERE user_id = $1 AND title = $2', [
      userId,
      demo.title,
    ]);
    if (exists.rowCount) {
      skipped++;
      continue;
    }

    const texts = language === 'es' ? demo.es : demo.en;
    const imagePath = demo.photo
      ? await store.save(await readFile(`${photosDir}/${demo.photo}`), 'image/jpeg')
      : undefined;

    await withTransaction(pool, async (tx) => {
      const product = await createProduct(tx, {
        userId,
        title: demo.title,
        category: demo.category,
        imagePath,
      });
      for (const variant of ['short', 'medium', 'seo'] as const) {
        await insertDescription(tx, product.id, variant, texts[variant]);
      }
      // A history of the last few hours, newest first, instead of five rows from the same second.
      await tx.query(
        `UPDATE products SET created_at = now() - make_interval(hours => $2) WHERE id = $1`,
        [product.id, index + 1],
      );
      await tx.query(
        `UPDATE descriptions SET created_at = p.created_at, updated_at = p.created_at
         FROM products p WHERE descriptions.product_id = p.id AND p.id = $1`,
        [product.id],
      );
    });
    created++;
  }
  return { created, skipped };
}
