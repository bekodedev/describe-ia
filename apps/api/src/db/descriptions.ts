import type { Db } from './pool.js';

export type DescriptionVariant = 'short' | 'medium' | 'seo';

export interface Description {
  id: string;
  product_id: string;
  variant: DescriptionVariant;
  content: string;
  edited_content: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function insertDescription(
  db: Db,
  productId: string,
  variant: DescriptionVariant,
  content: string,
): Promise<Description> {
  const { rows } = await db.query<Description>(
    `INSERT INTO descriptions (product_id, variant, content)
     VALUES ($1, $2, $3) RETURNING *`,
    [productId, variant, content],
  );
  return rows[0]!;
}

export async function listDescriptions(db: Db, productId: string): Promise<Description[]> {
  const { rows } = await db.query<Description>(
    `SELECT * FROM descriptions WHERE product_id = $1
     ORDER BY array_position(enum_range(NULL::description_variant), variant)`,
    [productId],
  );
  return rows;
}

// The original content is never overwritten; edits go to edited_content.
export async function updateEditedContent(
  db: Db,
  id: string,
  editedContent: string,
): Promise<Description | null> {
  const { rows } = await db.query<Description>(
    `UPDATE descriptions SET edited_content = $2, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, editedContent],
  );
  return rows[0] ?? null;
}
