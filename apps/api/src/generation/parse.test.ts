import { describe, expect, it } from 'vitest';
import { InvalidOutputError } from './errors.js';
import { parseVariants } from './parse.js';

describe('parseVariants (v1, naive)', () => {
  it('cuts the text between the three headings', () => {
    expect(parseVariants('SHORT: one\n\nMEDIUM: two\n\nSEO: three\n')).toEqual({
      short: 'one',
      medium: 'two',
      seo: 'three',
    });
  });

  it('ignores an introduction before the first heading', () => {
    expect(parseVariants('Sure! Here you go:\nSHORT: a\nMEDIUM: b\nSEO: c').short).toBe('a');
  });

  it('fails when the headings are translated or out of order', () => {
    expect(() => parseVariants('CORTA: a\nMEDIA: b\nSEO: c')).toThrow(InvalidOutputError);
    expect(() => parseVariants('SEO: c\nSHORT: a\nMEDIUM: b')).toThrow(InvalidOutputError);
  });

  it('keeps the raw text on the error, to be able to show it', () => {
    const error = (() => {
      try {
        parseVariants('nothing useful');
      } catch (e) {
        return e as InvalidOutputError;
      }
    })();
    expect(error?.text).toBe('nothing useful');
  });
});
