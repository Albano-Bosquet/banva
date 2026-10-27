import { beforeEach, describe, expect, it } from 'vitest';
import { createDoc, createShape } from '@trazo/shared';
import { DEFAULT_TITLE, useEditor } from '../store/editorStore';
import { TEMPLATES } from './catalog';

const build = (id: string) => TEMPLATES.find((t) => t.id === id)!.build();

describe('aplicar plantillas en el editor', () => {
  beforeEach(() => useEditor.getState().load('t', createDoc(1080, 1350, DEFAULT_TITLE)));

  it('reemplaza la página vacía, toma el título y se deshace en un paso', () => {
    const st = useEditor.getState();
    st.applyTemplate(build('ig-tips'));
    const s = useEditor.getState();
    expect(s.doc.pages).toHaveLength(1);
    expect(s.doc.title).toBe('5 hábitos para trabajar mejor');
    expect(s.doc.pages[0].elements.length).toBeGreaterThan(5);
    s.undo();
    expect(useEditor.getState().doc.pages[0].elements).toHaveLength(0);
  });

  it('con contenido, agrega las páginas después y escala las de otro tamaño', () => {
    const st = useEditor.getState();
    st.addElement(createShape(st.doc, 'rect'));
    const tpl = build('presentacion'); // 1920 × 1080 dentro de 1080 × 1350
    st.applyTemplate(tpl);
    const s = useEditor.getState();
    expect(s.doc.pages.map((p) => p.title)).toEqual(['', 'Portada', 'Objetivos']);
    expect(s.activePageId).toBe(s.doc.pages[1].id);
    const k = 1080 / 1920;
    const [srcBand, srcTitle] = tpl.pages[0].elements;
    const [band, title] = s.doc.pages[1].elements;
    // Escala uniforme y centrada verticalmente.
    expect(band.width).toBeCloseTo(srcBand.width * k);
    expect(band.height).toBeCloseTo(srcBand.height * k);
    expect(band.y).toBeCloseTo((1350 - 1080 * k) / 2);
    expect(title.type === 'text' && srcTitle.type === 'text' && title.fontSize / srcTitle.fontSize).toBeCloseTo(k);
  });

  it('los elementos insertados tienen ids nuevos en cada aplicación', () => {
    const st = useEditor.getState();
    st.addElement(createShape(st.doc, 'rect'));
    st.applyTemplate(build('cita'));
    st.applyTemplate(build('cita'));
    const ids = useEditor.getState().doc.pages.flatMap((p) => p.elements.map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
