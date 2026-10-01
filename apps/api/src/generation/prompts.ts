import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultDir = fileURLToPath(new URL('../../prompts/', import.meta.url));

export type PromptSource = 'private' | 'public';

// A private prompt (git-ignored) wins over the public one, so the repo works without it.
export async function loadPrompt(
  name: string,
  version: string,
  dir = defaultDir,
): Promise<{ template: string; source: PromptSource }> {
  const file = `${name}.${version}.md`;
  const candidates: [PromptSource, string][] = [
    ['private', join(dir, 'private', file)],
    ['public', join(dir, file)],
  ];

  for (const [source, path] of candidates) {
    try {
      return { template: await readFile(path, 'utf8'), source };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  throw new Error(`Prompt not found: ${file}`);
}

export function renderPrompt(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = variables[key];
    if (value === undefined) throw new Error(`Unknown prompt variable: {{${key}}}`);
    return value;
  });
}
