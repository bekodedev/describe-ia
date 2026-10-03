import { resolve } from 'node:path';
import type { UsageResponse } from '@describe-ia/shared';
import { expect, test, type Page } from '@playwright/test';

// The demo photo that ships with the API: the same one docs/demo.md tells you to use.
const PHOTO = resolve(process.cwd(), '../api/demo/photos/backpack.jpg'); // Playwright runs from apps/web

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

async function fillForm(page: Page, title: string) {
  await page.goto('/');
  await page.getByLabel('Product title').fill(title);
  await page.getByLabel('Category').selectOption('Sports');
}

const usage = async (page: Page) =>
  (await (await page.request.get('/api/usage')).json()) as UsageResponse;

test('generate with a photo, copy, edit, reload, find it in the history', async ({ page }) => {
  const title = `E2E hiking backpack ${Date.now()}`;
  const before = await usage(page);

  await fillForm(page, title);
  await page.getByLabel(/Choose a photo/).setInputFiles(PHOTO);
  await expect(page.getByAltText('Preview of backpack.jpg')).toBeVisible();
  await page.getByRole('button', { name: 'Generate descriptions' }).click();

  // The three cards, written by the fake model for this product, and the photo served by the API
  await expect(page).toHaveURL(/\/products\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Short', 'Medium', 'SEO']);
  const shortCard = page.getByRole('article').filter({ hasText: 'Short' });
  await expect(shortCard).toContainText(title);
  const photo = page.getByAltText(`Photo of ${title}`);
  await expect(photo).toBeVisible();
  expect(await photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  // Copy puts exactly the text of the card in the clipboard
  const shortText = await shortCard.locator('p').first().innerText();
  await shortCard.getByRole('button', { name: /^Copy/ }).click();
  await expect(shortCard.getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(shortText);

  // An edit is saved by the real API and survives a reload; the original is one click away
  const medium = page.getByRole('article').filter({ hasText: 'Medium' });
  const original = await medium.locator('p').first().innerText();
  await medium.getByRole('button', { name: /^Edit/ }).click();
  await medium.getByRole('textbox').fill('Edited by hand in the end-to-end test.');
  await medium.getByRole('button', { name: 'Save' }).click();
  await expect(medium.getByText('Edited', { exact: true })).toBeVisible();
  await page.reload();
  const reloaded = page.getByRole('article').filter({ hasText: 'Medium' });
  await expect(reloaded.getByText('Edited by hand in the end-to-end test.')).toBeVisible();
  await reloaded.getByRole('button', { name: 'View original' }).click();
  await expect(reloaded.getByText(original)).toBeVisible();

  // The history lists it first, with its thumbnail
  await page.getByRole('link', { name: '← History' }).click();
  const first = page.getByRole('listitem').first();
  await expect(first).toContainText(title);
  // The thumbnail has an empty alt on purpose (the title next to it says what it is)
  const thumbnail = first.locator('img');
  await expect(thumbnail).toHaveCount(1);
  await expect
    .poll(() => thumbnail.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);

  // The call was recorded; the fake model costs nothing
  const after = await usage(page);
  expect(after.calls).toBe(before.calls + 1);
  expect(after.costUsd).toBe(before.costUsd);
});

test('generate without a photo', async ({ page }) => {
  const title = `E2E plain product ${Date.now()}`;
  await fillForm(page, title);
  await page.getByRole('button', { name: 'Generate descriptions' }).click();

  await expect(page).toHaveURL(/\/products\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('article')).toHaveCount(3);
  await expect(page.getByAltText(/^Photo of/)).toHaveCount(0);
});

test('the real API rejects a text file that is named like a photo, and the page says so', async ({
  page,
}) => {
  await fillForm(page, 'E2E fake photo');
  await page.getByLabel(/Choose a photo/).setInputFiles({
    name: 'photo.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('this is not a picture'),
  });
  await page.getByRole('button', { name: 'Generate descriptions' }).click();

  await expect(page.locator('[role=alert]:not(#__next-route-announcer__)')).toContainText(
    'must be a JPEG, PNG or WebP image',
  );
  await expect(page).toHaveURL('/');
});

test('the demo seed fills the history with its five products', async ({ page }) => {
  test.skip(
    !process.env.STACK_SEEDED,
    'run through `pnpm test:e2e`, which seeds the demo products',
  );

  await page.goto('/products');
  await expect(page.getByRole('link', { name: /Urban hiking backpack/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Small zip travel pouch/ })).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Wireless noise-cancelling headphones X200/ }),
  ).toBeVisible();

  await page.getByRole('link', { name: /Urban hiking backpack/ }).click();
  await expect(page.getByAltText('Photo of Urban hiking backpack')).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(3);
});
