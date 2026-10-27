import { expect, test, type Page } from '@playwright/test';

/** PNG de 1×1 para las subidas. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function newDesign(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Conectado al servidor')).toBeVisible();
  await page.getByTestId('preset-1080x1080').click();
  await expect(page.getByTestId('elements-panel')).toBeVisible();
}

/** Lectura del documento desde el store (expuesto en modo desarrollo). */
const elements = (page: Page) =>
  page.evaluate(() => {
    const st = (globalThis as unknown as { __trazoEditor: { getState(): { doc: { pages: { elements: Record<string, unknown>[] }[] } } } }).__trazoEditor.getState();
    return st.doc.pages[0].elements;
  });

async function openCategory(page: Page, key: string) {
  if (await page.getByTestId('elements-back').isVisible()) await page.getByTestId('elements-back').click();
  await page.getByTestId(`cat-${key}`).click();
}

/** Centro en pantalla de un punto del diseño. */
async function screenPoint(page: Page, x: number, y: number) {
  const box = (await page.getByTestId('page-canvas').first().boundingBox())!;
  const zoom = parseInt((await page.getByTestId('zoom').textContent())!, 10) / 100;
  return { x: box.x + x * zoom, y: box.y + y * zoom };
}

test('el panel Elementos muestra las 14 categorías y busca formas e ilustraciones', async ({ page }) => {
  await newDesign(page);
  await expect(page.locator('.category')).toHaveCount(14);
  await page.getByTestId('elements-search').fill('corazon');
  await expect(page.getByTestId('shape-heart')).toBeVisible();
  await expect(page.getByTestId('graphic-icon-heart')).toBeVisible();
  await page.getByTestId('shape-heart').click();
  await page.getByTestId('elements-search').fill('');
  await openCategory(page, 'shapes');
  await page.getByTestId('shape-line-end').click();
  const els = await elements(page);
  expect(els.map((e) => [e.shape, e.arrow ?? null])).toEqual([
    ['heart', null],
    ['line', 'end'],
  ]);
});

test('ilustraciones: cambiar un color y animar', async ({ page }) => {
  await newDesign(page);
  await openCategory(page, 'graphics');
  await page.getByTestId('graphic-sun').click();
  await page.getByTestId('graphic-color-0').fill('#e84a8a');
  await page.getByTestId('animation').selectOption('pulse');
  const [sun] = await elements(page);
  expect(sun).toMatchObject({ type: 'graphic', colors: ['#e84a8a', '#ff8a3d'], animation: 'pulse' });
});

test('gráficos: editar datos desde el panel', async ({ page }) => {
  await newDesign(page);
  await openCategory(page, 'charts');
  await page.getByTestId('chart-bar').click();
  await page.getByTestId('edit-chart').click();
  await page.getByTestId('chart-value-0-2').fill('42');
  await page.getByTestId('chart-add-row').click();
  await page.getByTestId('chart-type').selectOption('line');
  const [chart] = await elements(page);
  expect(chart).toMatchObject({ chartType: 'line', labels: ['Ene', 'Feb', 'Mar', 'Abr', 'Dato 5'] });
  expect((chart.series as { values: number[] }[])[0].values).toEqual([12, 19, 42, 24, 0]);
});

test('hojas de cálculo: doble clic en una celda y fórmula que recalcula', async ({ page }) => {
  await newDesign(page);
  await openCategory(page, 'sheets');
  await page.getByTestId('sheet-budget').click();
  const [sheet] = await elements(page);
  const { x, y, width, height } = sheet as { x: number; y: number; width: number; height: number };
  // Fila 3 ("Extras"), columna B (la columna A ocupa 2/3 del ancho).
  const rowH = height / 7;
  const p = await screenPoint(page, x + width * 0.85, y + rowH * 2.5);
  await page.mouse.dblclick(p.x, p.y);
  await expect(page.getByTestId('cell-editor')).toBeFocused();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('=B2*0.1');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  const [after] = await elements(page);
  expect((after.cells as string[][])[2][1]).toBe('=B2*0.1');
  // El saldo se recalcula con la fórmula nueva: 850000 + 85000 − 320000 − 210000 − 60000.
  const texts = await page.evaluate(() =>
    (globalThis as unknown as { Konva: { stages: { find(s: string): { text(): string }[] }[] } }).Konva.stages.flatMap((s) => s.find('Text').map((t) => t.text())),
  );
  expect(texts).toContain('345.000');
  expect(texts).toContain('85.000');
  await page.mouse.click(p.x, p.y);
  await page.getByTestId('table-add-row').click();
  expect(((await elements(page))[0].cells as string[][]).length).toBe(8);
});

test('marcos: una imagen subida rellena el marco seleccionado', async ({ page }) => {
  await newDesign(page);
  await openCategory(page, 'frames');
  await page.getByTestId('frame-ellipse').click();
  await page.getByTestId('rail-uploads').click();
  await page.getByTestId('upload-input').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: PNG });
  await expect.poll(async () => (await elements(page))[0].src).toMatch(/^\/uploads\/.+\.png$/);
  expect(await elements(page)).toHaveLength(1);
  await expect(page.getByTestId('frame-zoom')).toBeVisible();
});

test('cuadrículas, mockups y 3D se insertan con sus valores', async ({ page }) => {
  await newDesign(page);
  await openCategory(page, 'grids');
  await page.getByTestId('grid-2x2').click();
  await openCategory(page, 'mockups');
  await page.getByTestId('mockup-phone').click();
  await openCategory(page, 'solids');
  await page.getByTestId('solid-torus').click();
  await page.getByTestId('solid-yaw').fill('90');
  const els = await elements(page);
  expect(els.map((e) => e.type)).toEqual(['grid', 'frame', 'solid']);
  expect(els[0]).toMatchObject({ x: 0, y: 0, width: 1080, height: 1080 });
  expect(els[1]).toMatchObject({ decoration: 'phone' });
  expect(els[2]).toMatchObject({ solid: 'torus', yaw: 90 });
});

test('formularios: se completan en Presentar y las respuestas se ven en el editor', async ({ page }) => {
  await newDesign(page);
  await openCategory(page, 'forms');
  await page.getByTestId('form-newsletter').click();
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
  await page.getByTestId('present').click();
  const form = page.getByTestId('form-html');
  await expect(form).toBeVisible();
  await form.locator('input[type="email"]').fill('ana@prueba.test');
  await form.getByRole('button', { name: 'Suscribirme' }).click();
  await expect(form).toContainText('Gracias');
  await page.keyboard.press('Escape');
  await page.getByTestId('page-canvas').click({ position: { x: 300, y: 300 } });
  await page.getByTestId('edit-form').click();
  await page.getByTestId('form-responses').click();
  await expect(page.getByTestId('responses-list')).toContainText('ana@prueba.test');
});
