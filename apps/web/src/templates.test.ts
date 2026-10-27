import { describe, expect, it } from 'vitest';
import { designDocSchema } from '@trazo/shared';
import { TEMPLATES } from './templates';

describe('plantillas', () => {
  it.each(TEMPLATES.map((t) => [t.name, t] as const))('%s genera un documento válido con ids únicos', (_, t) => {
    const doc = t.build();
    expect(designDocSchema.safeParse(doc).success).toBe(true);
    const ids = doc.pages.flatMap((p) => p.elements.map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
    // Cada llamada crea ids nuevos para no colisionar entre diseños.
    expect(t.build().pages[0].id).not.toBe(doc.pages[0].id);
  });
});

describe('catálogo', () => {
  it('cada categoría tiene al menos una plantilla con su tamaño', async () => {
    const { CATEGORIES, templatesIn } = await import('./templates/catalog');
    for (const cat of CATEGORIES) {
      const list = templatesIn(cat.id);
      expect(list.length, cat.id).toBeGreaterThan(0);
      const sized = list.filter((t) => !['oferta', 'cita'].includes(t.id));
      for (const t of sized) expect([t.build().width, t.build().height], t.id).toEqual([cat.width, cat.height]);
    }
  });

  it('busca sin distinguir tildes y por categoría', async () => {
    const { searchTemplates } = await import('./templates/catalog');
    expect(searchTemplates('curriculum').map((t) => t.id)).toEqual(['cv-lateral', 'cv-clasico']);
    expect(searchTemplates('factura').map((t) => t.id)).toContain('factura-simple');
    expect(searchTemplates('xyz-nada')).toEqual([]);
  });

  it('la factura calcula el total con fórmulas', async () => {
    const { TEMPLATES } = await import('./templates/catalog');
    const { displayCells } = await import('@trazo/shared');
    const invoice = TEMPLATES.find((t) => t.id === 'factura-simple')!.build();
    const tableEl = invoice.pages[0].elements.find((e) => e.type === 'table');
    if (tableEl?.type !== 'table') throw new Error('sin tabla');
    // 450000 + 12 × 18000 + 120000 = 786000; con IVA: 951060.
    expect(displayCells(tableEl.cells).at(-1)![3]).toBe('951.060');
  });
});
