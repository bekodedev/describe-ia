import type { Db } from '../db/pool.js';
import { textOf, type CompleteParams, type LlmResponse, type Message } from '../llm/client.js';
import { recordLlmCall } from '../llm/record.js';
import { InvalidOutputError } from './errors.js';
import { parseVariants, type Variants } from './parse.js';
import { descriptionsJsonSchema, parseDescriptions } from './schema.js';

export type PromptVersion = 'v1' | 'v2';

const MAX_TOKENS = 1500;

// v1 is kept only to compare against v2: free text, naive parser, no retry.
const VERSIONS: Record<
  PromptVersion,
  { attempts: number; parse: (text: string) => Variants; jsonSchema?: Record<string, unknown> }
> = {
  v1: { attempts: 1, parse: parseVariants },
  v2: { attempts: 2, parse: parseDescriptions, jsonSchema: descriptionsJsonSchema },
};

export interface AskParams {
  userId: string;
  model: string;
  version: PromptVersion;
  prompt: string;
  complete: (params: CompleteParams) => Promise<LlmResponse>;
}

// Asks the model and validates the answer. Each attempt is stored in llm_calls; if an answer is
// invalid it is retried once, telling the model what was wrong. Still invalid -> InvalidOutputError (422).
export async function askForDescriptions(db: Db, params: AskParams) {
  const { attempts, parse, jsonSchema } = VERSIONS[params.version];
  const context = { userId: params.userId, model: params.model, promptVersion: params.version };
  let messages: Message[] = [{ role: 'user', content: params.prompt }];

  for (let attempt = 1; ; attempt++) {
    try {
      const { response, value, callId } = await recordLlmCall(
        db,
        context,
        () => params.complete({ messages, maxTokens: MAX_TOKENS, jsonSchema }),
        (r) => parse(textOf(r)),
      );
      return { variants: value, callId, rawText: textOf(response) };
    } catch (error) {
      if (!(error instanceof InvalidOutputError) || attempt === attempts) throw error;
      messages = [
        ...messages,
        { role: 'assistant', content: error.text || '(empty answer)' },
        {
          role: 'user',
          content: `That answer was not valid: ${error.message}. Answer again with only the JSON object, fixing that.`,
        },
      ];
    }
  }
}
