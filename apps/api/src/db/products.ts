import type { Db } from './pool.js';

export interface Product {
  id: string;
  user_id: string;
  title: string;
  category: string;
  image_path: string | null;
  created_at: Date;
}

export interface NewProduct {
  userId: string;
  title: string;
  category: string;
  imagePath?: string | null;
}

export async function createProduct(db: Db, input: NewProduct): Promise<Product> {
  const { rows } = await db.query<Product>(
    `INSERT INTO products (user_id, title, category, image_path)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [input.userId, input.title, input.category, input.imagePath ?? null],
  );
  return rows[0]!;
}

export async function findProduct(db: Db, id: string, userId: string): Promise<Product | null> {
  const { rows } = await db.query<Product>(
    'SELECT * FROM products WHERE id = $1 AND user_id = $2',
    [id, userId],
  );
  return rows[0] ?? null;
}

// `createdAt` is Postgres' own text for the timestamp: converting it to a JS Date would drop
// the microseconds and make the keyset comparison skip or repeat rows.
export interface ProductCursor {
  createdAt: string;
  id: string;
}

// Newest first. Keyset pagination: stable even if products are created while the user pages.
export async function listProducts(
  db: Db,
  userId: string,
  limit: number,
  cursor?: ProductCursor,
): Promise<{ products: Product[]; next: ProductCursor | null }> {
  const { rows } = await db.query<Product & { created_at_text: string }>(
    `SELECT *, created_at::text AS created_at_text FROM products
     WHERE user_id = $1
       AND ($2::timestamptz IS NULL OR (created_at, id) < ($2::timestamptz, $3::uuid))
     ORDER BY created_at DESC, id DESC
     LIMIT $4`,
    [userId, cursor?.createdAt ?? null, cursor?.id ?? null, limit + 1],
  );
  const products = rows.slice(0, limit);
  const last = products.at(-1);
  const next =
    rows.length > limit && last ? { createdAt: last.created_at_text, id: last.id } : null;
  return { products, next };
}
