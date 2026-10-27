import { expect, test, type Page } from '@playwright/test';

async function home(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Conectado al servidor')).toBeVisible();
}

const doc = (page: Page) =>
  page.evaluate(() => (globalThis as unknown as { __trazoEditor: { getState(): { doc: Record<string, unknown> } } }).__trazoEditor.getState().doc);

test('Doc: escribir, atajo de lista, menú "/" y título automático', async ({ page }) => {
  await home(page);
  await page.getByTestId('create-doc').click();
  await expect(page.getByTestId('doc-editor')).toBeVisible();
  const first = page.locator('[data-rich]').first();
  await first.click();
  await page.keyboard.type('Plan del trimestre');
  await page.keyboard.press('Enter');
  await page.keyboard.type('- ');
  await page.keyboard.type('Lanzar la app');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Medir');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/tab');
  await expect(page.getByTestId('slash-menu')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('doc-table')).toBeVisible();
  const d = await doc(page);
  const blocks = d.blocks as { type: string; html?: string }[];
  expect(blocks.map((b) => b.type)).toEqual(['h1', 'bullet', 'bullet', 'table', 'p'].slice(0, blocks.length));
  expect(blocks[0].html).toBe('Plan del trimestre');
  await expect(page.getByLabel('Título del diseño')).toHaveValue('Plan del trimestre');
  await expect(page.getByTestId('word-count')).toContainText('palabras');
});

test('Hoja de cálculo: escribir rápido, fórmula y referencia circular', async ({ page }) => {
  await home(page);
  await page.getByTestId('create-sheet').click();
  await expect(page.getByTestId('sheet-editor')).toBeVisible();
  // La celda activa recibe el foco al montarse: recién ahí se puede escribir.
  await expect(page.getByTestId('cell-input')).toBeFocused();
  await page.keyboard.type('Producto');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Precio');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.type('Taza');
  await page.keyboard.press('Tab');
  await page.keyboard.type('3500');
  await page.keyboard.press('Enter');
  await page.keyboard.type('1200');
  await page.keyboard.press('Enter');
  await page.keyboard.type('=SUMA(B2:B3)');
  await page.keyboard.press('Enter');
  await page.keyboard.type('=B5');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-cell="A1"]')).toHaveText('Producto');
  await expect(page.locator('[data-cell="B4"]')).toHaveText('4.700');
  await expect(page.locator('[data-cell="B5"]')).toContainText('#CICLO');
  await page.locator('[data-cell="B2"]').click();
  await page.locator('[data-cell="B4"]').click({ modifiers: ['Shift'] });
  await expect(page.getByTestId('sheet-stats')).toContainText('Suma: 9.400');
});

test('Pizarra: nota adhesiva, nota contigua y dibujo', async ({ page }) => {
  await home(page);
  await page.getByTestId('create-whiteboard').click();
  await expect(page.getByTestId('wb-palette')).toBeVisible();
  await page.getByTestId('wb-sticky').click();
  const box = (await page.getByTestId('page-canvas').boundingBox())!;
  await page.mouse.click(box.x + 300, box.y + 250);
  await expect(page.getByTestId('sticky-editor')).toBeFocused();
  await page.keyboard.type('Idea uno');
  await page.keyboard.press('Escape');
  await page.getByTestId('wb-draw').click();
  await page.mouse.move(box.x + 100, box.y + 450);
  await page.mouse.down();
  await page.mouse.move(box.x + 250, box.y + 500, { steps: 8 });
  await page.mouse.up();
  const els = (await doc(page)).pages as { elements: { type: string; text?: string }[] }[];
  expect(els[0].elements.map((e) => e.type)).toEqual(['sticky', 'draw']);
  expect(els[0].elements[0].text).toBe('Idea uno');
  await expect(page.getByLabel('Título del diseño')).toHaveValue('Idea uno');
});

test('Sitio web: publicar y ver el sitio', async ({ page }) => {
  await home(page);
  await page.getByTestId('create-website').click();
  await expect(page.locator('.page-head strong').first()).toHaveText('Sección 1');
  await page.getByTestId('site-publish').click();
  await page.getByTestId('site-publish-confirm').click();
  await expect(page.getByTestId('site-publish')).toContainText('Publicado');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
  const url = await page.getByTestId('site-url').inputValue();
  await page.goto(url);
  await expect(page.getByTestId('site-view')).toBeVisible();
  await expect(page.locator('.site-banner')).toHaveCount(0);
});

test('Crear un diseño: tamaño personalizado en milímetros', async ({ page }) => {
  await home(page);
  await page.getByTestId('create-sizes').click();
  await page.getByTestId('custom-w').fill('210');
  await page.getByTestId('custom-h').fill('297');
  await page.getByTestId('custom-unit').selectOption('mm');
  await page.getByTestId('custom-create').click();
  await expect(page.getByTestId('page-canvas')).toBeVisible();
  const d = await doc(page);
  expect([d.width, d.height]).toEqual([794, 1123]);
});
