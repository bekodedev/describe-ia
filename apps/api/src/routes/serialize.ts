import type { DescriptionDto, ProductDto } from '@describe-ia/shared';
import type { Description } from '../db/descriptions.js';
import type { Product } from '../db/products.js';

// The API speaks camelCase and ISO dates; the database rows (snake_case, Date) stay internal.
export const toProductDto = (p: Product): ProductDto => ({
  id: p.id,
  title: p.title,
  category: p.category,
  imageUrl: p.image_path ? `/api/products/${p.id}/image` : null,
  createdAt: p.created_at.toISOString(),
});

export const toDescriptionDto = (d: Description): DescriptionDto => ({
  id: d.id,
  productId: d.product_id,
  variant: d.variant,
  content: d.content,
  editedContent: d.edited_content,
  createdAt: d.created_at.toISOString(),
  updatedAt: d.updated_at.toISOString(),
});
