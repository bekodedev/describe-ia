import { IMAGE_MAX_BYTES } from '@describe-ia/shared';
import { z } from 'zod';

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    PORT: z.coerce.number().int().positive().default(4000),
    ANTHROPIC_API_KEY: z.string().default(''), // required unless LLM_FAKE is on, see below
    // 1 = no real model: deterministic fake descriptions, no key, no cost (tests, CI, demo plan B).
    LLM_FAKE: z.preprocess((v) => v === '1' || v === 'true', z.boolean()),
    LLM_MODEL: z.string().min(1),
    // Only for models that support it (Sonnet 5.x, Opus...); leave empty for Haiku 4.5.
    LLM_EFFORT: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.enum(['low', 'medium', 'high']).optional(),
    ),
    LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    MAX_IMAGE_BYTES: z.coerce.number().int().positive().default(IMAGE_MAX_BYTES),
    UPLOADS_DIR: z.string().min(1).default('uploads'),
    OUTPUT_LANGUAGE: z
      .string()
      .regex(/^[a-z]{2}$/, 'must be a 2-letter ISO 639-1 code such as "es" or "en"')
      .default('es'),
  })
  .superRefine((env, ctx) => {
    if (!env.LLM_FAKE && !env.ANTHROPIC_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['ANTHROPIC_API_KEY'],
        message: 'is required unless LLM_FAKE=1',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export class EnvError extends Error {}

// Fails with a readable list of problems instead of a raw validation stack trace.
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;

  const problems = result.error.issues.map((issue) => {
    const name = issue.path.join('.');
    const missing = source[name] === undefined || source[name] === '';
    return `  - ${name}: ${missing ? 'is missing (set it in .env, see .env.example)' : issue.message}`;
  });
  throw new EnvError(`Invalid environment configuration:\n${problems.join('\n')}`);
}
