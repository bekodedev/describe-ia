import { describe, expect, it } from 'vitest';
import { InvalidOutputError } from './errors.js';
import { descriptionsJsonSchema, parseDescriptions } from './schema.js';

const valid = {
  short: 'A stainless steel bottle for every day.',
  medium: 'This stainless steel bottle holds 750 ml and is made for sport and daily use. '.repeat(
    2,
  ),
  seo: 'Stainless steel water bottle, 750 ml, for sports, the gym, hiking and the office. '.repeat(
    3,
  ),
};

describe('parseDescriptions', () => {
  it('accepts valid JSON', () => {
    expect(parseDescriptions(JSON.stringify(valid)).short).toBe(valid.short);
  });

  it('trims the texts and strips unknown fields', () => {
    const result = parseDescriptions(
      JSON.stringify({ ...valid, short: `  ${valid.short} `, extra: 1 }),
    );
    expect(result).toEqual({ ...valid, medium: valid.medium.trim(), seo: valid.seo.trim() });
  });

  it('rejects text that is not JSON, keeping the raw answer', () => {
    const error = catchError(() => parseDescriptions('SHORT: hi'));
    expect(error.message).toMatch(/not valid JSON/);
    expect(error.text).toBe('SHORT: hi');
    expect(error.status).toBe(422);
  });

  it('names the missing field', () => {
    const withoutSeo = { short: valid.short, medium: valid.medium };
    expect(catchError(() => parseDescriptions(JSON.stringify(withoutSeo))).message).toMatch(/seo/);
  });

  it('rejects a variant outside the length limits', () => {
    const tooLong = { ...valid, short: 'x'.repeat(221) };
    expect(catchError(() => parseDescriptions(JSON.stringify(tooLong))).message).toMatch(/short/);
    const tooShort = { ...valid, medium: 'tiny' };
    expect(catchError(() => parseDescriptions(JSON.stringify(tooShort))).message).toMatch(/medium/);
  });
});

describe('descriptionsJsonSchema', () => {
  it('has the three required keys and no keywords the API does not support', () => {
    expect(descriptionsJsonSchema).toMatchObject({
      type: 'object',
      required: ['short', 'medium', 'seo'],
      additionalProperties: false,
    });
    expect(JSON.stringify(descriptionsJsonSchema)).not.toMatch(/minLength|maxLength|\$schema/);
  });
});

function catchError(fn: () => unknown): InvalidOutputError {
  try {
    fn();
  } catch (error) {
    return error as InvalidOutputError;
  }
  throw new Error('expected the function to throw');
}
