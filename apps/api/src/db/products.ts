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

export async function listProducts(db: Db, userId: string, limit = 50): Promise<Product[]> {
  const { rows } = await db.query<Product>(
    'SELECT * FROM products WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, limit],
  );
  return rows;
}
