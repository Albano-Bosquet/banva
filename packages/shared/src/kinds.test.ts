import { describe, expect, it } from 'vitest';
import { createBlock, createDocOfKind, deriveTitle, designDocSchema, designKindSchema, htmlToText, KIND_SIZE } from './index';

describe('tipos de diseño', () => {
  it('cada tipo crea un documento válido con su contenido inicial', () => {
    for (const kind of designKindSchema.options) {
      const doc = createDocOfKind(kind);
      const r = designDocSchema.safeParse(doc);
      expect(r.success, `${kind}: ${JSON.stringify(r.error?.issues?.[0])}`).toBe(true);
      if (kind !== 'design') expect([doc.width, doc.height]).toEqual([KIND_SIZE[kind].width, KIND_SIZE[kind].height]);
    }
    expect(createDocOfKind('doc').blocks?.map((b) => b.type)).toEqual(['h1', 'p']);
    expect(createDocOfKind('sheet').sheet).toMatchObject({ rows: 100, cols: 26 });
    expect(createDocOfKind('video').pages[0].duration).toBe(5);
    expect(createDocOfKind('design').kind).toBeUndefined();
  });

  it('los bloques estructurales traen sus datos por defecto', () => {
    expect(createBlock('table').rows).toHaveLength(3);
    expect(createBlock('button')).toMatchObject({ html: '', url: 'https://' });
    expect(createBlock('chart').chart?.values).toHaveLength(3);
    expect(createBlock('columns').cols).toEqual(['', '']);
  });

  it('el título se deriva de bloques, celdas o notas', () => {
    const doc = createDocOfKind('doc');
    doc.blocks![1].html = '<b>Informe</b> trimestral<br>segunda línea';
    expect(deriveTitle(doc)).toBe('Informe trimestral');
    const sheet = createDocOfKind('sheet');
    sheet.sheet!.cells = { B2: '=1+1', C1: 'Ventas', A3: 'tarde' };
    expect(deriveTitle(sheet)).toBe('Ventas');
    const wb = createDocOfKind('whiteboard');
    wb.pages[0].elements.push({ id: 's', type: 'sticky', x: 0, y: 0, width: 10, height: 10, rotation: 0, opacity: 1, locked: false, visible: true, text: 'Idea uno', color: '#fff', fontSize: 18 });
    expect(deriveTitle(wb)).toBe('Idea uno');
  });

  it('htmlToText quita etiquetas y decodifica entidades', () => {
    expect(htmlToText('a&nbsp;<b>b</b> &amp; <i>c</i><br>d')).toBe('a b & c\nd');
  });
});
