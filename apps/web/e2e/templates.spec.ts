import { expect, test } from '@playwright/test';

test('Inicio: filtrar por categoría, buscar y crear desde una plantilla', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Conectado al servidor')).toBeVisible();
  const cards = page.getByTestId('templates').locator('.template-card');
  const total = await cards.count();
  expect(total).toBeGreaterThan(40);

  await page.getByTestId('tcat-resume').click();
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText('Currículum · 794 × 1123');

  await page.getByTestId('template-search').fill('factura');
  await expect(cards).toHaveCount(1);
  await page.getByTestId('template-factura-simple').click();
  await expect(page.getByLabel('Título del diseño')).toHaveValue('Factura 0001-00000123');
  await expect(page.getByTestId('page-canvas')).toBeVisible();
});

test('Editor: el panel Plantillas aplica una plantilla en la página vacía', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('preset-1080x1920').click();
  await page.getByTestId('rail-templates').click();
  // El panel abre en "Este formato": solo historias de 1080 × 1920.
  const cards = page.getByTestId('panel-templates').locator('.template-card');
  await expect(cards.first()).toContainText('1080 × 1920');
  await page.getByTestId('template-story-coleccion').click();
  await expect(page.getByLabel('Título del diseño')).toHaveValue('Nueva colección');
  await expect(page.getByTestId('page-canvas')).toHaveCount(1);
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
});
