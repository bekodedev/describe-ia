import type { CompleteParams, ContentBlock, LlmResponse, Message } from './client.js';

// A model that is not a model: with LLM_FAKE=1 the API answers from here. Same input, same output,
// no network, no key, no cost. For tests, CI and the "plan B" of a live demo.

interface Texts {
  short: (title: string) => string;
  medium: (title: string, category: string, hasPhoto: boolean) => string;
  seo: (title: string, category: string) => string;
}

const TEXTS: Record<string, Texts> = {
  en: {
    short: (t) => `${t}: practical, comfortable and easy to use every day.`,
    medium: (t, c, photo) =>
      `${t} is a practical choice in ${c}. It is made for people who want something useful that fits into their routine without any fuss. Check the product page for the full details before you decide.${photo ? ' The photo shows the product just as it will arrive.' : ''}`,
    seo: (t, c) =>
      `${t} in ${c}: a simple and reliable option for everyday use. Discover ${t} and compare it with similar products before you buy. Its practical design makes daily use easier, and its clear presentation helps you choose with confidence. If you are looking for ${t}, this text is written to rank well in search engines, with the key words in the right places and an easy reading flow. Add ${t} to your shop and give your customers clear information from the first glance.`,
  },
  es: {
    short: (t) => `${t}: práctico, cómodo y fácil de usar cada día.`,
    medium: (t, c, photo) =>
      `${t} es una opción práctica dentro de ${c}. Está pensado para quien busca algo útil que encaje en su rutina sin complicaciones. Revisa la ficha del producto para conocer todos los detalles antes de decidir.${photo ? ' En la foto se ve el producto tal como llegará a tu casa.' : ''}`,
    seo: (t, c) =>
      `${t} en la categoría ${c}: una propuesta sencilla y fiable para el día a día. Descubre ${t} y compáralo con productos similares antes de comprar. Su diseño práctico facilita el uso diario y su presentación clara ayuda a elegir con confianza. Si buscas ${t}, este texto está escrito para posicionar bien en buscadores, con las palabras clave en su sitio y una lectura fácil. Añade ${t} a tu tienda y ofrece a tus clientes información clara desde el primer vistazo.`,
  },
  fr: {
    short: (t) => `${t} : pratique, confortable et facile à utiliser au quotidien.`,
    medium: (t, c, photo) =>
      `${t} est un choix pratique dans la catégorie ${c}. Il est pensé pour ceux qui veulent quelque chose d'utile, qui s'intègre à leur quotidien sans complication. Consultez la fiche produit pour connaître tous les détails avant de décider.${photo ? " La photo montre le produit tel qu'il arrivera chez vous." : ''}`,
    seo: (t, c) =>
      `${t} dans la catégorie ${c} : une proposition simple et fiable pour tous les jours. Découvrez ${t} et comparez-le avec des produits similaires avant d'acheter. Sa conception pratique facilite l'usage quotidien et sa présentation claire aide à choisir en confiance. Si vous cherchez ${t}, ce texte est écrit pour bien se positionner dans les moteurs de recherche, avec les mots-clés au bon endroit et une lecture fluide. Ajoutez ${t} à votre boutique et offrez à vos clients une information claire au premier regard.`,
  },
};

export const FAKE_MODEL = 'fake';

const SHORT_TITLE = 60; // the schema limits a short description to 220 characters

const asBlocks = (message: Message | undefined) =>
  typeof message?.content === 'string'
    ? [{ type: 'text' as const, text: message.content }]
    : (message?.content ?? []);

// The product comes from the rendered prompt ("Product title: ..." / "Category: ..."); the last
// match wins because a prompt may show examples before the real task.
function lastMatch(text: string, label: string): string | undefined {
  return [...text.matchAll(new RegExp(`^${label}:\\s*(.+)$`, 'gm'))].at(-1)?.[1]?.trim();
}

export function createFakeComplete(language: string) {
  const texts = TEXTS[language] ?? TEXTS.en!;

  return async (params: CompleteParams): Promise<LlmResponse> => {
    const blocks = asBlocks(params.messages[0]);
    const prompt = blocks.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n');
    const hasPhoto = blocks.some((b) => b.type === 'image');

    // Structured output is requested for descriptions; anything else (a ping) just gets an answer.
    let text = 'pong';
    if (params.jsonSchema) {
      const title = (lastMatch(prompt, 'Product title') ?? 'your product').slice(0, SHORT_TITLE);
      const category = (lastMatch(prompt, 'Category') ?? 'general').slice(0, 40);
      text = JSON.stringify({
        short: texts.short(title),
        medium: texts.medium(title, category, hasPhoto),
        seo: texts.seo(title, category),
      });
    }

    const content: ContentBlock[] = [{ type: 'text', text }];
    return {
      content,
      model: FAKE_MODEL,
      // Rough sizes (about 4 characters a token, a photo is about 1,000 tokens): enough for the reports.
      usage: {
        inputTokens: Math.ceil(prompt.length / 4) + (hasPhoto ? 1000 : 0),
        outputTokens: Math.ceil(text.length / 4),
      },
      latencyMs: 25,
      raw: { fake: true },
    };
  };
}
