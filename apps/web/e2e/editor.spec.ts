import { expect, test, type Page } from '@playwright/test';

async function newDesign(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Conectado al servidor')).toBeVisible();
  await page.getByTestId('preset-1080x1080').click();
  await expect(page.getByTestId('page-canvas')).toBeVisible();
}

const layerNames = (page: Page) => page.getByTestId('layer-row').locator('.name').allTextContents();

async function openLayers(page: Page) {
  if (!(await page.getByTestId('layers').isVisible())) {
    if (!(await page.getByTestId('panel-position').isVisible())) await page.getByTestId('rail-position').click();
    await page.getByTestId('tab-layers').click();
  }
}

/** Centro en pantalla de un punto del diseño (coordenadas de diseño → píxeles de pantalla). */
async function screenPoint(page: Page, x: number, y: number, pageIndex = 0) {
  const box = (await page.getByTestId('page-canvas').nth(pageIndex).boundingBox())!;
  const zoom = parseInt((await page.getByTestId('zoom').textContent())!, 10) / 100;
  return { x: box.x + x * zoom, y: box.y + y * zoom };
}

test('crear diseño, escribir texto y persistir al recargar', async ({ page }) => {
  await newDesign(page);
  await page.getByTestId('rail-text').click();
  await page.getByTestId('add-textbox').click();
  const editor = page.getByTestId('text-editor');
  await expect(editor).toBeFocused();
  await page.keyboard.type('Hola mundo');
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Título del diseño')).toHaveValue('Hola mundo');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
  await page.reload();
  await openLayers(page);
  expect(await layerNames(page)).toEqual(['Hola mundo']);
});

test('formas, atajos y deshacer/rehacer', async ({ page }) => {
  await newDesign(page);
  await page.locator('body').click({ position: { x: 5, y: 300 } });
  await page.keyboard.press('r');
  await page.keyboard.press('c');
  await openLayers(page);
  expect(await layerNames(page)).toEqual(['Círculo', 'Rectángulo']);
  await page.keyboard.press('Control+z');
  expect(await layerNames(page)).toEqual(['Rectángulo']);
  await page.keyboard.press('Control+y');
  expect(await layerNames(page)).toEqual(['Círculo', 'Rectángulo']);
  await page.keyboard.press('Delete');
  expect(await layerNames(page)).toEqual(['Rectángulo']);
  await page.getByTestId('layer-row').first().click();
  await page.keyboard.press('Control+d');
  expect(await layerNames(page)).toEqual(['Rectángulo', 'Rectángulo']);
});

test('arrastrar mueve el elemento y las guías lo ajustan al centro', async ({ page }) => {
  await newDesign(page);
  await page.keyboard.press('r'); // 324×324 centrado en (378, 378)
  await page.getByTestId('rail-position').click();
  await expect(page.getByTestId('num-x')).toHaveValue('378');

  const from = await screenPoint(page, 540, 540);
  const to = await screenPoint(page, 740, 640);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
  const x = Number(await page.getByTestId('num-x').inputValue());
  expect(x).toBeGreaterThan(560);

  // Soltar a 2 px del centro horizontal: el ajuste magnético lo deja centrado.
  const a = await screenPoint(page, x + 162, 540);
  const b = await screenPoint(page, 542, 540);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByTestId('num-x')).toHaveValue('378');
});

test('panel Posición: alinear y campos numéricos', async ({ page }) => {
  await newDesign(page);
  await page.keyboard.press('r');
  await page.getByTestId('rail-position').click();
  await page.getByTestId('align-left').click();
  await expect(page.getByTestId('num-x')).toHaveValue('0');
  await page.getByTestId('num-rotation').fill('45');
  await expect(page.getByTestId('num-rotation')).toHaveValue('45');
  await page.getByTestId('num-width').fill('100');
  await openLayers(page);
  await page.getByTestId('layer-row').first().getByTitle('Bloquear').click();
  await page.keyboard.press('Delete');
  expect(await layerNames(page)).toEqual(['Rectángulo']);
});

test('páginas: agregar, contar y eliminar', async ({ page }) => {
  await newDesign(page);
  await page.getByTestId('add-page').click();
  await expect(page.getByTestId('page-canvas')).toHaveCount(2);
  await expect(page.getByTestId('page-counter')).toHaveText('Página 2 de 2');
  await page.getByTitle('Duplicar página').first().click();
  await expect(page.getByTestId('page-canvas')).toHaveCount(3);
  await page.getByTitle('Eliminar página').first().click();
  await expect(page.getByTestId('page-canvas')).toHaveCount(2);
});

test('exportar PNG y PDF descarga archivos', async ({ page }) => {
  await newDesign(page);
  await page.keyboard.press('r');
  for (const format of ['png', 'pdf'] as const) {
    await page.getByTestId('export-open').click();
    await page.getByTestId(`format-${format}`).click();
    const download = page.waitForEvent('download');
    await page.getByTestId('export-run').click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(new RegExp(`\\.${format}$`));
  }
});

test('colaboración en tiempo real entre dos pestañas', async ({ page, context }) => {
  await newDesign(page);
  const other = await context.newPage();
  await other.goto(page.url());
  await expect(other.getByTestId('page-canvas')).toBeVisible();
  await expect(page.locator('.peers span')).toHaveCount(2);

  await page.keyboard.press('r');
  await openLayers(other);
  await expect(other.getByTestId('layer-row')).toHaveCount(1);
  await expect(other.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
});

test('crear un diseño desde una plantilla', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('template-presentacion').click();
  await expect(page.getByTestId('page-canvas')).toHaveCount(2);
  await expect(page.getByLabel('Título del diseño')).toHaveValue('Presentación del proyecto');
  await openLayers(page);
  expect(await layerNames(page)).toEqual(['Equipo de producto · 2026', 'Presentación del proyecto', 'Rectángulo']);
});

test('editar texto y hacer clic fuera conserva el cambio', async ({ page }) => {
  await newDesign(page);
  await page.getByTestId('rail-text').click();
  await page.getByText('Agregar un título').click();
  const box = (await page.getByTestId('page-canvas').boundingBox())!;
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  const editor = page.getByTestId('text-editor');
  await expect(editor).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await page.mouse.click(box.x + 20, box.y + 20);
  await expect(editor).toHaveCount(0);
  await openLayers(page);
  expect(await layerNames(page)).toEqual(['Agregá un títu']);
});
