import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

const valid = {
  DATABASE_URL: 'postgres://localhost/test',
  ANTHROPIC_API_KEY: 'key',
  LLM_MODEL: 'model',
};

describe('loadEnv', () => {
  it('applies defaults', () => {
    const env = loadEnv(valid);
    expect(env.OUTPUT_LANGUAGE).toBe('es');
    expect(env.PORT).toBe(4000);
    expect(env.LLM_TIMEOUT_MS).toBe(30_000);
    expect(env.LLM_EFFORT).toBeUndefined();
  });

  it('names the missing variable', () => {
    expect(() => loadEnv({ ...valid, ANTHROPIC_API_KEY: '' })).toThrow(
      /ANTHROPIC_API_KEY: is missing/,
    );
  });

  it('rejects a language that is not a 2-letter code', () => {
    expect(() => loadEnv({ ...valid, OUTPUT_LANGUAGE: 'english' })).toThrow(/OUTPUT_LANGUAGE/);
  });

  it('reads LLM_EFFORT, treats an empty value as not set and rejects unknown levels', () => {
    expect(loadEnv({ ...valid, LLM_EFFORT: 'low' }).LLM_EFFORT).toBe('low');
    expect(loadEnv({ ...valid, LLM_EFFORT: '' }).LLM_EFFORT).toBeUndefined();
    expect(() => loadEnv({ ...valid, LLM_EFFORT: 'extreme' })).toThrow(/LLM_EFFORT/);
  });
});
