import type pg from 'pg';
import { loadEnv } from '../config/env.js';
import { insertDescription, type Description } from '../db/descriptions.js';
import { linkLlmCallToProduct } from '../db/llm-calls.js';
import { withTransaction } from '../db/pool.js';
import { createProduct, type Product } from '../db/products.js';
import { complete, textOf, type CompleteParams, type LlmResponse } from '../llm/client.js';
import { recordLlmCall } from '../llm/record.js';
import { parseVariants } from './parse.js';
import { loadPrompt, renderPrompt } from './prompts.js';

const PROMPT_NAME = 'generate-description';
const PROMPT_VERSION = 'v1';
const MAX_TOKENS = 1500;

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
}

function defaultDeps(): GenerationDeps {
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
  const { template, source } = await loadPrompt(PROMPT_NAME, PROMPT_VERSION);
  console.log(`Using ${source} prompt ${PROMPT_NAME}.${PROMPT_VERSION}`);
  const prompt = renderPrompt(template, {
    title: input.title,
    category: input.category,
    language: languageName(deps.language),
  });

  // Recorded even if the answer cannot be parsed (status invalid_output).
  const {
    response,
    value: variants,
    callId,
  } = await recordLlmCall(
    pool,
    { userId: input.userId, promptVersion: PROMPT_VERSION, model: deps.model },
    () => deps.complete({ messages: [{ role: 'user', content: prompt }], maxTokens: MAX_TOKENS }),
    (r) => parseVariants(textOf(r)),
  );

  return withTransaction(pool, async (tx) => {
    const product = await createProduct(tx, input);
    const descriptions = [
      await insertDescription(tx, product.id, 'short', variants.short),
      await insertDescription(tx, product.id, 'medium', variants.medium),
      await insertDescription(tx, product.id, 'seo', variants.seo),
    ];
    await linkLlmCallToProduct(tx, callId, product.id);
    return { product, descriptions, rawText: textOf(response) };
  });
}
