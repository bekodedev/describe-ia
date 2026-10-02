import { z } from 'zod';
import { InvalidOutputError } from './errors.js';
import type { Variants } from './parse.js';

// Limits in characters, wide enough for what prompt v2 asks for (short: 1 sentence, medium: 40-70
// words, seo: 100-150 words) but tight enough to catch an answer that is empty or runs away.
export const DescriptionsSchema = z.object({
  short: z.string().trim().min(20).max(220),
  medium: z.string().trim().min(80).max(700),
  seo: z.string().trim().min(200).max(1600),
});

// Sent to the API so the model is constrained to this shape. The API does not support
// minLength/maxLength, which is why the real limits are only enforced above, by zod.
export const descriptionsJsonSchema: Record<string, unknown> = z.toJSONSchema(
  z.object({ short: z.string(), medium: z.string(), seo: z.string() }),
);
delete descriptionsJsonSchema.$schema;

// Never trust the model, even when the API guarantees the shape: always validate.
export function parseDescriptions(text: string): Variants {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new InvalidOutputError('The answer is not valid JSON', text);
  }

  const result = DescriptionsSchema.safeParse(data);
  if (result.success) return result.data;

  const problems = result.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`);
  throw new InvalidOutputError(`The JSON does not match the schema (${problems.join('; ')})`, text);
}
