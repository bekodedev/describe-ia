import type pg from 'pg';
import { loadEnv } from '../config/env.js';
import type { PreparedImage } from '../images/prepare.js';
import { createImageStore, type ImageStore } from '../images/storage.js';
import { insertDescription, type Description } from '../db/descriptions.js';
import { linkLlmCallToProduct } from '../db/llm-calls.js';
import { withTransaction } from '../db/pool.js';
import { createProduct, type Product } from '../db/products.js';
import { complete, type CompleteParams, type LlmResponse } from '../llm/client.js';
import { createFakeComplete, FAKE_MODEL } from '../llm/fake.js';
import { askForDescriptions, type PromptVersion } from './ask.js';
import { loadPrompt, renderPrompt } from './prompts.js';

const PROMPT_NAME = 'generate-description';

export interface GenerationInput {
  userId: string;
  title: string;
  category: string;
  image?: PreparedImage;
}

// What the service needs from the outside; tests replace `complete`.
export interface GenerationDeps {
  complete: (params: CompleteParams) => Promise<LlmResponse>;
  model: string;
  language: string; // ISO 639-1 code, e.g. "es"
  imageStore: ImageStore;
  promptVersion?: PromptVersion; // v2 unless an experiment asks for v1
  allowPrivatePrompts?: boolean; // default true; false = only the prompts in the repository
  promptLabel?: string; // overrides what llm_calls.prompt_version stores
  promptsDir?: string; // where the prompt files are; tests point it at a temporary folder
}

export function defaultDeps(): GenerationDeps {
  const env = loadEnv();
  return {
    complete: env.LLM_FAKE ? createFakeComplete(env.OUTPUT_LANGUAGE) : (params) => complete(params),
    model: env.LLM_FAKE ? FAKE_MODEL : env.LLM_MODEL,
    language: env.OUTPUT_LANGUAGE,
    imageStore: createImageStore(env.UPLOADS_DIR),
  };
}

// "es" -> "Spanish": the prompt names the language, never a code.
const languageName = (code: string) =>
  new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code;

// Loads the prompt and fills in the product. The label says which prompt was really used: a private
// prompt is stored as "v2-private", so costs measured with it never mix with the public ones.
export async function buildPrompt(
  input: Pick<GenerationInput, 'title' | 'category'>,
  deps: Pick<
    GenerationDeps,
    'language' | 'promptVersion' | 'allowPrivatePrompts' | 'promptLabel' | 'promptsDir'
  >,
) {
  const version = deps.promptVersion ?? 'v2';
  const { template, source } = await loadPrompt(
    PROMPT_NAME,
    version,
    deps.promptsDir,
    deps.allowPrivatePrompts ?? true,
  );
  console.log(`Using ${source} prompt ${PROMPT_NAME}.${version}`);
  const prompt = renderPrompt(template, {
    title: input.title,
    category: input.category,
    language: languageName(deps.language),
  });
  const label = deps.promptLabel ?? (source === 'private' ? `${version}-private` : version);
  return { prompt, version, label };
}

export async function generateDescriptions(
  pool: pg.Pool,
  input: GenerationInput,
  deps: GenerationDeps = defaultDeps(),
): Promise<{ product: Product; descriptions: Description[]; rawText: string }> {
  const { prompt, version, label } = await buildPrompt(input, deps);

  // Every attempt is recorded, valid or not. Throws InvalidOutputError (422) if the model never complies.
  const { variants, callId, rawText } = await askForDescriptions(pool, {
    userId: input.userId,
    model: deps.model,
    version,
    promptLabel: label,
    prompt,
    imageBase64: input.image?.base64,
    complete: deps.complete,
  });

  // The photo is stored only now, once the model has answered: a failed generation leaves no file.
  const { image } = input;
  const imagePath = image && (await deps.imageStore.save(image.original, image.originalType));
  try {
    return await withTransaction(pool, async (tx) => {
      const product = await createProduct(tx, {
        userId: input.userId,
        title: input.title,
        category: input.category,
        imagePath,
      });
      const descriptions = [
        await insertDescription(tx, product.id, 'short', variants.short),
        await insertDescription(tx, product.id, 'medium', variants.medium),
        await insertDescription(tx, product.id, 'seo', variants.seo),
      ];
      await linkLlmCallToProduct(tx, callId, product.id);
      return { product, descriptions, rawText };
    });
  } catch (error) {
    if (imagePath) await deps.imageStore.remove(imagePath);
    throw error;
  }
}
