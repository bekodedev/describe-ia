import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPrompt, renderPrompt } from './prompts.js';

async function promptsDir(files: Record<string, string>) {
  const dir = await mkdtemp(join(tmpdir(), 'prompts-'));
  for (const [path, content] of Object.entries(files)) {
    await mkdir(join(dir, path, '..'), { recursive: true });
    await writeFile(join(dir, path), content);
  }
  return dir;
}

describe('loadPrompt', () => {
  it('uses the private prompt when it exists', async () => {
    const dir = await promptsDir({ 'p.v1.md': 'public', 'private/p.v1.md': 'private' });
    expect(await loadPrompt('p', 'v1', dir)).toEqual({ template: 'private', source: 'private' });
  });

  it('falls back to the public prompt, even if private/ does not exist', async () => {
    const dir = await promptsDir({ 'p.v1.md': 'public' });
    expect(await loadPrompt('p', 'v1', dir)).toEqual({ template: 'public', source: 'public' });
  });

  it('fails clearly when neither exists', async () => {
    await expect(loadPrompt('p', 'v9', await promptsDir({}))).rejects.toThrow(/p\.v9\.md/);
  });

  it('loads the real v1 prompt shipped with the repo', async () => {
    const { template } = await loadPrompt('generate-description', 'v1');
    expect(template).toContain('{{title}}');
    expect(template).toContain('{{language}}');
  });
});

describe('renderPrompt', () => {
  it('replaces every placeholder, including $ in values', () => {
    expect(renderPrompt('{{a}} / {{b}} / {{a}}', { a: '$&', b: 'x' })).toBe('$& / x / $&');
  });

  it('rejects an unknown placeholder', () => {
    expect(() => renderPrompt('Hello {{nope}}', {})).toThrow(
      /Unknown prompt variable: \{\{nope\}\}/,
    );
  });
});
