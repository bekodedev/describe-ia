import type {
  DescriptionDto,
  ErrorResponse,
  GenerationResponse,
  ProductDto,
  ProductListResponse,
} from '@describe-ia/shared';
import { expect, test, type Page, type Route } from '@playwright/test';

// A tiny valid PNG, enough for the browser to draw a preview.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
);

const ID = '3f0c6b9e-8f3e-4a52-9d0e-2f6a1b7c9d10';
const now = '2026-10-03T09:00:00.000Z';

const product = (overrides: Partial<ProductDto> = {}): ProductDto => ({
  id: ID,
  title: 'Stainless steel water bottle 750 ml',
  category: 'Sports',
  imageUrl: null,
  createdAt: now,
  ...overrides,
});

const description = (variant: DescriptionDto['variant'], content: string): DescriptionDto => ({
  id: `${ID}-${variant}`,
  productId: ID,
  variant,
  content,
  editedContent: null,
  createdAt: now,
  updatedAt: now,
});

const short = 'A 750 ml stainless steel bottle that goes wherever your training does.';
const medium = 'Carry your water in a 750 ml stainless steel bottle made for training days.';
const seo = 'Stainless steel water bottle, 750 ml, for sports, the gym, hiking and the office.';

const generation = (overrides: Partial<ProductDto> = {}): GenerationResponse => ({
  product: product(overrides),
  descriptions: [
    description('short', short),
    description('medium', medium),
    description('seo', seo),
  ],
});

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const apiError = (code: string, message: string): ErrorResponse => ({
  error: { code, message, requestId: 'req-123' },
});

// Next.js adds its own role=alert element (the route announcer); ours are the other ones.
const alertOf = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

// Any /api call a test did not mock fails loudly. Handlers registered later win.
async function mockApi(page: Page) {
  await page.route('**/api/**', (route) => route.abort());
}

test.beforeEach(async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await mockApi(page);
});

async function fillForm(page: Page, title = 'Stainless steel water bottle 750 ml') {
  await page.goto('/');
  await page.getByLabel('Product title').fill(title);
  await page.getByLabel('Category').selectOption('Sports');
}

test('fill in, generate, see the 3 cards and copy', async ({ page }) => {
  let posted = '';
  await page.route('**/api/generations', async (route) => {
    posted = route.request().postData() ?? '';
    await new Promise((resolve) => setTimeout(resolve, 400)); // long enough to see the loading state
    await json(route, generation(), 201);
  });
  await page.route(`**/api/products/${ID}`, (route) => json(route, generation()));

  await fillForm(page);
  await page.getByRole('button', { name: 'Generate descriptions' }).click();

  await expect(page.getByRole('button', { name: 'Generating 3 descriptions…' })).toBeDisabled();
  await expect(page).toHaveURL(`/products/${ID}`);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Stainless steel water bottle 750 ml',
  );
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Short', 'Medium', 'SEO']);
  await expect(page.getByText(short)).toBeVisible();
  await expect(page.getByText(`${short.length} characters`)).toBeVisible();

  const card = page.getByRole('article').filter({ hasText: 'Short' });
  await card.getByRole('button', { name: /^Copy/ }).click();
  await expect(card.getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(short);

  expect(posted).toContain('name="title"');
  expect(posted).toContain('Stainless steel water bottle 750 ml');
  expect(posted).toContain('name="category"');
  expect(posted).not.toContain('name="image"'); // no photo, no image part
});

test('an empty form shows inline errors and does not call the API', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/generations', (route) => {
    calls++;
    return json(route, generation(), 201);
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Generate descriptions' }).click();

  await expect(page.getByText('Enter a product title.')).toBeVisible();
  await expect(page.getByText('Choose a category.')).toBeVisible();
  await expect(page.getByLabel('Product title')).toBeFocused();
  expect(calls).toBe(0);
});

test('with a photo: preview, upload and the photo on the result page', async ({ page }) => {
  let posted = '';
  await page.route('**/api/generations', (route) => {
    posted = route.request().postData() ?? '';
    return json(route, generation({ imageUrl: `/api/products/${ID}/image` }), 201);
  });
  await page.route(`**/api/products/${ID}`, (route) =>
    json(route, generation({ imageUrl: `/api/products/${ID}/image` })),
  );
  await page.route(`**/api/products/${ID}/image`, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PNG }),
  );

  await fillForm(page);
  await page
    .getByLabel(/Choose a photo/)
    .setInputFiles({ name: 'bottle.png', mimeType: 'image/png', buffer: PNG });

  await expect(page.getByAltText('Preview of bottle.png')).toBeVisible();
  await page.getByRole('button', { name: 'Generate descriptions' }).click();

  await expect(page).toHaveURL(`/products/${ID}`);
  await expect(page.getByAltText('Photo of Stainless steel water bottle 750 ml')).toBeVisible();
  expect(posted).toContain('name="image"; filename="bottle.png"');
});

test('a photo that is not an image is refused before upload, and can be removed', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByLabel(/Choose a photo/)
    .setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') });
  await expect(page.getByText('Use a JPEG, PNG or WebP image.')).toBeVisible();

  await page
    .getByLabel(/Choose a photo/)
    .setInputFiles({ name: 'ok.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByAltText('Preview of ok.png')).toBeVisible();
  await page.getByRole('button', { name: /Remove photo/ }).click();
  await expect(page.getByAltText('Preview of ok.png')).toHaveCount(0);
});

test('editing saves the text, marks it as edited and keeps the original one click away', async ({
  page,
}) => {
  const edited = 'My own version of the medium description.';
  await page.route(`**/api/products/${ID}`, (route) => json(route, generation()));
  await page.route(`**/api/descriptions/${ID}-medium`, async (route) => {
    expect(route.request().method()).toBe('PATCH');
    expect(route.request().postDataJSON()).toEqual({ editedContent: edited });
    await json(route, { description: { ...description('medium', medium), editedContent: edited } });
  });

  await page.goto(`/products/${ID}`);
  const card = page.getByRole('article').filter({ hasText: 'Medium' });
  await card.getByRole('button', { name: /^Edit/ }).click();
  await card.getByRole('textbox').fill(edited);
  await card.getByRole('button', { name: 'Save' }).click();

  await expect(card.getByText(edited)).toBeVisible();
  await expect(card.getByText('Edited', { exact: true })).toBeVisible();
  await expect(card.getByText(medium)).toHaveCount(0);

  await card.getByRole('button', { name: 'View original' }).click();
  await expect(card.getByText(medium)).toBeVisible();
  await card.getByRole('button', { name: 'Hide original' }).click();
  await expect(card.getByText(medium)).toHaveCount(0);
});

const failures = [
  [
    '429',
    429,
    apiError('rate_limited', 'Too many requests'),
    /Too many requests, wait a few seconds/,
  ],
  ['503', 503, apiError('llm_rate_limited', 'busy'), /Too many requests, wait a few seconds/],
  [
    '422',
    422,
    apiError('invalid_model_output', 'bad'),
    /model returned an invalid format, please retry/,
  ],
  ['504', 504, apiError('llm_timeout', 'slow'), /took too long/],
  ['400', 400, apiError('invalid_image', 'The image is larger than 5 MB'), /larger than 5 MB/],
  [
    '500',
    500,
    apiError('internal_error', 'Something went wrong'),
    /Something went wrong\. Please try again\. \(reference req-123\)/,
  ],
] as const;

for (const [name, status, body, message] of failures) {
  test(`a ${name} from the API is explained in plain language and the form stays usable`, async ({
    page,
  }) => {
    await page.route('**/api/generations', (route) => json(route, body, status));

    await fillForm(page);
    await page.getByRole('button', { name: 'Generate descriptions' }).click();

    await expect(alertOf(page)).toContainText(message);
    await expect(page.getByRole('button', { name: 'Generate descriptions' })).toBeEnabled();
    await expect(page.getByLabel('Product title')).toHaveValue(
      'Stainless steel water bottle 750 ml',
    );
  });
}

test('an unreachable server is explained too', async ({ page }) => {
  await fillForm(page); // every /api call is aborted by the default handler
  await page.getByRole('button', { name: 'Generate descriptions' }).click();
  await expect(alertOf(page)).toContainText('Cannot reach the server');
});

test('history lists the products, newest first, and loads more', async ({ page }) => {
  const first: ProductListResponse = {
    products: [
      product({ id: 'a1', title: 'Newest product' }),
      product({ id: 'a2', title: 'Second product', imageUrl: '/api/products/a2/image' }),
    ],
    nextCursor: 'cursor-2',
  };
  const second: ProductListResponse = {
    products: [product({ id: 'a3', title: 'Oldest product' })],
    nextCursor: null,
  };

  await page.route('**/api/products?**', (route) => {
    const cursor = new URL(route.request().url()).searchParams.get('cursor');
    return json(route, cursor === 'cursor-2' ? second : first);
  });
  await page.route('**/api/products/a2/image', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PNG }),
  );

  await page.goto('/products');
  await expect(page.getByRole('link', { name: /Newest product/ })).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(2);

  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(page.getByRole('listitem')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Load more' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Oldest product/ })).toHaveAttribute(
    'href',
    '/products/a3',
  );
});

test('an empty history invites to create the first description', async ({ page }) => {
  await page.route('**/api/products?**', (route) =>
    json(route, { products: [], nextCursor: null }),
  );
  await page.goto('/products');
  await expect(page.getByText('Nothing here yet')).toBeVisible();
  await page.getByRole('link', { name: 'Describe a product' }).click();
  await expect(page).toHaveURL('/');
});

test('a missing product explains itself', async ({ page }) => {
  await page.route('**/api/products/**', (route) =>
    json(route, apiError('not_found', 'Product not found'), 404),
  );
  await page.goto('/products/00000000-0000-4000-8000-0000000000ff');
  await expect(alertOf(page)).toContainText('could not find that');
});
