import { describe, expect, it } from 'vitest';
import { buildPrompt } from '../generation/service.js';
import { parseDescriptions } from '../generation/schema.js';
import { textOf, type CompleteParams } from './client.js';
import { createFakeComplete, FAKE_MODEL } from './fake.js';

// The fake answers what the real prompt asks for: build the request exactly like the service does.
async function request(title: string, category: string, language: string, photo = false) {
  const { prompt } = await buildPrompt(
    { title, category },
    { language, allowPrivatePrompts: false },
  );
  const text = { type: 'text' as const, text: prompt };
  const image = {
    type: 'image' as const,
    source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: 'QUJD' },
  };
  return {
    messages: [{ role: 'user' as const, content: photo ? [image, text] : [text] }],
    maxTokens: 1500,
    jsonSchema: { type: 'object' },
  } satisfies CompleteParams;
}

describe('createFakeComplete', () => {
  it.each([
    ['es', 'práctico'],
    ['en', 'practical'],
    ['fr', 'pratique'],
  ])('writes valid descriptions in %s that mention the product', async (language, word) => {
    const fake = createFakeComplete(language);
    const response = await fake(
      await request('Stainless steel water bottle 750 ml', 'Sports', language),
    );

    const variants = parseDescriptions(textOf(response)); // the same validation the real answers pass
    expect(variants.short).toContain('Stainless steel water bottle 750 ml');
    expect(`${variants.short} ${variants.medium} ${variants.seo}`).toContain(word);
    expect(response.model).toBe(FAKE_MODEL);
  });

  it('stays inside the length limits for the longest title and for quotes', async () => {
    const fake = createFakeComplete('es');
    for (const title of ['x'.repeat(200), 'Mug "Best" 350 ml', 'abc']) {
      const response = await fake(await request(title, 'Home & Kitchen', 'es'));
      expect(() => parseDescriptions(textOf(response))).not.toThrow();
    }
  });

  it('is deterministic: the same request gives the same answer', async () => {
    const fake = createFakeComplete('es');
    const params = await request('Linen trousers', 'Fashion', 'es');
    expect(await fake(params)).toEqual(await fake(params));
  });

  it('uses English for a language it has no text for', async () => {
    const fake = createFakeComplete('de');
    const response = await fake(await request('Backpack', 'Sports', 'de'));
    expect(parseDescriptions(textOf(response)).medium).toContain('practical choice');
  });

  it('mentions the photo, and bills about 1,000 more input tokens, when there is one', async () => {
    const fake = createFakeComplete('en');
    const without = await fake(await request('Backpack', 'Sports', 'en'));
    const withPhoto = await fake(await request('Backpack', 'Sports', 'en', true));

    expect(parseDescriptions(textOf(withPhoto)).medium).toContain('photo');
    expect(parseDescriptions(textOf(without)).medium).not.toContain('photo');
    expect(withPhoto.usage.inputTokens - without.usage.inputTokens).toBe(1000);
  });

  it('takes the product from the last "Product title:" when a prompt shows examples first', async () => {
    const fake = createFakeComplete('en');
    const prompt =
      'Product title: An example\nCategory: Toys\nAnswer: {}\n\nProduct title: The real one\nCategory: Pets\nAnswer:';
    const response = await fake({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 100,
      jsonSchema: { type: 'object' },
    });
    const variants = parseDescriptions(textOf(response));
    expect(variants.short).toContain('The real one');
    expect(variants.medium).toContain('Pets');
  });

  it('answers a plain request (no schema) with a short text, like the ping does', async () => {
    const fake = createFakeComplete('en');
    const response = await fake({
      messages: [{ role: 'user', content: 'say pong' }],
      maxTokens: 20,
    });
    expect(textOf(response)).toBe('pong');
  });
});
