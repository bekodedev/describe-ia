import type pg from 'pg';
import { loadEnv } from '../config/env.js';
import { insertDescription, type Description } from '../db/descriptions.js';
import { linkLlmCallToProduct } from '../db/llm-calls.js';
import { withTransaction } from '../db/pool.js';
import { createProduct, type Product } from '../db/products.js';
import { complete, type CompleteParams, type LlmResponse } from '../llm/client.js';
import { askForDescriptions, type PromptVersion } from './ask.js';
import { loadPrompt, renderPrompt } from './prompts.js';

const PROMPT_NAME = 'generate-description';

export interface GenerationInput {
  userId: string;
  title: string;
  category: string;
}

// What the service needs from the outside; tests replace `complete`.
export interface GenerationDeps {
  complete: (params: CompleteParams) => Promise<LlmResponse>;
  model: string;
  language: string; // ISO 639-1 code, e.g. "es"
  promptVersion?: PromptVersion; // v2 unless an experiment asks for v1
}

export function defaultDeps(): GenerationDeps {
  const env = loadEnv();
  return {
    complete: (params) => complete(params),
    model: env.LLM_MODEL,
    language: env.OUTPUT_LANGUAGE,
  };
}

// "es" -> "Spanish": the prompt names the language, never a code.
const languageName = (code: string) =>
  new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code;

export async function generateDescriptions(
  pool: pg.Pool,
  input: GenerationInput,
  deps: GenerationDeps = defaultDeps(),
): Promise<{ product: Product; descriptions: Description[]; rawText: string }> {
  const version = deps.promptVersion ?? 'v2';
  const { template, source } = await loadPrompt(PROMPT_NAME, version);
  console.log(`Using ${source} prompt ${PROMPT_NAME}.${version}`);
  const prompt = renderPrompt(template, {
    title: input.title,
    category: input.category,
    language: languageName(deps.language),
  });

  // Every attempt is recorded, valid or not. Throws InvalidOutputError (422) if the model never complies.
  const { variants, callId, rawText } = await askForDescriptions(pool, {
    userId: input.userId,
    model: deps.model,
    version,
    prompt,
    complete: deps.complete,
  });

  return withTransaction(pool, async (tx) => {
    const product = await createProduct(tx, input);
    const descriptions = [
      await insertDescription(tx, product.id, 'short', variants.short),
      await insertDescription(tx, product.id, 'medium', variants.medium),
      await insertDescription(tx, product.id, 'seo', variants.seo),
    ];
    await linkLlmCallToProduct(tx, callId, product.id);
    return { product, descriptions, rawText };
  });
}
