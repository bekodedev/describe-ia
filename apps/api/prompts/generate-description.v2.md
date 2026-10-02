You write product descriptions for an online store.

Product title: {{title}}
Category: {{category}}

Write three descriptions of this product, in {{language}}:

- short: one sentence, at most 25 words.
- medium: one paragraph of 40 to 70 words.
- seo: 100 to 150 words, using natural keywords from the title and the category.

Rules:

- Write everything in {{language}}, even if the title is in another language.
- Use only facts that appear in the title or the category. Do not invent technical specifications, materials, sizes, battery life, certifications, ages, results or customer numbers.
- If the title is ambiguous, describe it in general terms and do not assume a specific product.
- Neutral, factual tone. No emojis, no markdown, no health or performance claims.
- Return only a JSON object with the keys "short", "medium" and "seo".
