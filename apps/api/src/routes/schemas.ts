import { CATEGORIES, EDITED_CONTENT_MAX, TITLE_LENGTH } from '@describe-ia/shared';
import { z } from 'zod';
import type { ProductCursor } from '../db/products.js';

export const generationBody = z.object({
  title: z.string().trim().min(TITLE_LENGTH.min).max(TITLE_LENGTH.max),
  category: z.enum(CATEGORIES),
});

export const editBody = z.object({
  editedContent: z.string().trim().min(1).max(EDITED_CONTENT_MAX),
});

export const idParams = z.object({ id: z.uuid() });

// The cursor is opaque to clients: base64url of { createdAt, id } as the database printed them.
const cursorShape = z.object({
  createdAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?[+-]\d{2}(:\d{2})?$/),
  id: z.uuid(),
});

export const encodeCursor = (cursor: ProductCursor): string =>
  Buffer.from(JSON.stringify(cursor)).toString('base64url');

const cursorParam = z.string().transform((raw, ctx) => {
  try {
    return cursorShape.parse(JSON.parse(Buffer.from(raw, 'base64url').toString()));
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Invalid cursor' });
    return z.NEVER;
  }
});

export const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: cursorParam.optional(),
});
