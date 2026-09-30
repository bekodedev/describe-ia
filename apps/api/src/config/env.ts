import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(4000),
  ANTHROPIC_API_KEY: z.string().min(1),
  LLM_MODEL: z.string().min(1),
  OUTPUT_LANGUAGE: z
    .string()
    .regex(/^[a-z]{2}$/, 'must be a 2-letter ISO 639-1 code such as "es" or "en"')
    .default('es'),
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
