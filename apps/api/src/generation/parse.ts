export interface Variants {
  short: string;
  medium: string;
  seo: string;
}

export class InvalidOutputError extends Error {
  constructor(
    message: string,
    readonly text: string,
  ) {
    super(message);
  }
}

// v1 is deliberately naive: it looks for the three headings and cuts the text between them.
// Anything the model adds around them (markdown, intro, translated headings) is NOT handled; T05 fixes that.
export function parseVariants(text: string): Variants {
  const short = text.indexOf('SHORT:');
  const medium = text.indexOf('MEDIUM:');
  const seo = text.indexOf('SEO:');

  if (short < 0 || medium < short || seo < medium) {
    throw new InvalidOutputError(
      'Could not find the SHORT:, MEDIUM: and SEO: headings in order',
      text,
    );
  }
  return {
    short: text.slice(short + 'SHORT:'.length, medium).trim(),
    medium: text.slice(medium + 'MEDIUM:'.length, seo).trim(),
    seo: text.slice(seo + 'SEO:'.length).trim(),
  };
}
