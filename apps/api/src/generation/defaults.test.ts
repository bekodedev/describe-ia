import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FAKE_MODEL } from '../llm/fake.js';
import { buildPrompt, defaultDeps } from './service.js';

const product = { title: 'Steel bottle', category: 'Sports' };

async function promptsDir() {
  const dir = await mkdtemp(join(tmpdir(), 'prompts-'));
  await mkdir(join(dir, 'private'));
  await writeFile(
    join(dir, 'generate-description.v2.md'),
    'public: {{title}} / {{category}} / {{language}}',
  );
  await writeFile(join(dir, 'private', 'generate-description.v2.md'), 'private: {{title}}');
  return dir;
}

describe('buildPrompt', () => {
  const language = 'es';

  it('fills in the product and names the language, not its code', async () => {
    const dir = await promptsDir();
    const { prompt } = await buildPrompt(product, {
      language,
      promptsDir: dir,
      allowPrivatePrompts: false,
    });
    expect(prompt).toBe('public: Steel bottle / Sports / Spanish');
  });

  it('labels the call "v2" for the public prompt and "v2-private" for the private one', async () => {
    const dir = await promptsDir();

    const isPublic = await buildPrompt(product, {
      language,
      promptsDir: dir,
      allowPrivatePrompts: false,
    });
    expect(isPublic.label).toBe('v2');

    const isPrivate = await buildPrompt(product, { language, promptsDir: dir });
    expect(isPrivate.label).toBe('v2-private');
    expect(isPrivate.prompt).toBe('private: Steel bottle');
  });

  it('lets an experiment choose the label', async () => {
    const dir = await promptsDir();
    const { label } = await buildPrompt(product, {
      language,
      promptsDir: dir,
      promptLabel: 'v2-compare',
    });
    expect(label).toBe('v2-compare');
  });

  it('fails clearly when the prompt version does not exist', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'prompts-'));
    await expect(buildPrompt(product, { language, promptsDir: dir })).rejects.toThrow(
      /generate-description\.v2\.md/,
    );
  });
});

describe('defaultDeps', () => {
  afterEach(() => vi.unstubAllEnvs());

  const stub = (extra: Record<string, string>) => {
    for (const [name, value] of Object.entries({
      DATABASE_URL: 'postgres://x',
      LLM_MODEL: 'claude-haiku-4-5-20251001',
      ANTHROPIC_API_KEY: 'key',
      OUTPUT_LANGUAGE: 'en',
      UPLOADS_DIR: 'uploads-test',
      LLM_FAKE: '',
      ...extra,
    })) {
      vi.stubEnv(name, value);
    }
  };

  it('uses the configured model and language', () => {
    stub({});
    const deps = defaultDeps();
    expect(deps).toMatchObject({ model: 'claude-haiku-4-5-20251001', language: 'en' });
    expect(deps.imageStore.dir).toMatch(/uploads-test$/);
  });

  it('with LLM_FAKE=1 answers locally: no key needed, model "fake", no network', async () => {
    stub({ LLM_FAKE: '1', ANTHROPIC_API_KEY: '' });
    const deps = defaultDeps();
    expect(deps.model).toBe(FAKE_MODEL);

    const { prompt } = await buildPrompt(product, { language: 'en', allowPrivatePrompts: false });
    const response = await deps.complete({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1500,
      jsonSchema: { type: 'object' },
    });
    expect(response.model).toBe(FAKE_MODEL);
  });
});
