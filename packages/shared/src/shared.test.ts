import { describe, expect, it } from 'vitest';
import { createDoc, createImage, createShape, createText, deriveTitle, designDocSchema, newId } from './index';

describe('factory', () => {
  it('crea documentos válidos según el esquema', () => {
    const doc = createDoc(1080, 1080);
    doc.pages[0].elements.push(createText(doc), createShape(doc, 'rect'), createImage(doc, 'data:x', 400, 200));
    expect(designDocSchema.safeParse(doc).success).toBe(true);
  });

  it('centra el rectángulo con 30 % del lado (324 en 1080)', () => {
    const r = createShape({ width: 1080, height: 1080 }, 'rect');
    expect(r).toMatchObject({ x: 378, y: 378, width: 324, height: 324 });
  });

  it('ajusta imágenes grandes al 50 % de la página conservando proporción', () => {
    const img = createImage({ width: 1000, height: 1000 }, 'x', 4000, 2000);
    expect(img.width).toBe(500);
    expect(img.height).toBe(250);
  });

  it('deriva el título del primer texto', () => {
    const doc = createDoc(100, 100);
    expect(deriveTitle(doc)).toBeNull();
    doc.pages[0].elements.push(createText(doc, 'body', { text: 'Hola editor\nsegunda' }));
    expect(deriveTitle(doc)).toBe('Hola editor');
  });

  it('genera ids únicos', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId()));
    expect(ids.size).toBe(1000);
  });
});
