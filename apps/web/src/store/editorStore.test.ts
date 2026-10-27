import { beforeEach, describe, expect, it } from 'vitest';
import { createDoc, createShape, createText, type Patch } from '@trazo/shared';
import { DEFAULT_TITLE, getActivePage, onDocChange, useEditor } from './editorStore';

const s = () => useEditor.getState();

beforeEach(() => {
  s().load('d1', createDoc(1000, 1000, DEFAULT_TITLE));
});

describe('elementos', () => {
  it('inserta y selecciona el elemento nuevo', () => {
    const r = createShape(s().doc, 'rect');
    s().addElement(r);
    expect(getActivePage().elements).toHaveLength(1);
    expect(s().selectedIds).toEqual([r.id]);
    expect(s().saveStatus).toBe('dirty');
  });

  it('elimina, duplica, copia y pega', () => {
    const r = createShape(s().doc, 'rect');
    s().addElement(r);
    s().duplicateSelected();
    expect(getActivePage().elements).toHaveLength(2);
    expect(getActivePage().elements[1].x).toBe(r.x + 20);
    s().copy();
    s().paste();
    expect(getActivePage().elements).toHaveLength(3);
    s().selectAll();
    s().deleteSelected();
    expect(getActivePage().elements).toHaveLength(0);
  });

  it('no elimina elementos bloqueados', () => {
    const r = createShape(s().doc, 'rect');
    s().addElement(r);
    s().toggleLock();
    s().select([r.id]);
    s().deleteSelected();
    expect(getActivePage().elements).toHaveLength(1);
  });

  it('el título se deriva del primer texto', () => {
    s().addElement(createText(s().doc, 'body', { text: 'Hola editor' }));
    expect(s().doc.title).toBe('Hola editor');
    s().setTitle('Mi título');
    s().addElement(createText(s().doc, 'body', { text: 'otro' }));
    expect(s().doc.title).toBe('Mi título');
  });
});

describe('historial', () => {
  it('deshace y rehace inserciones y ediciones', () => {
    const r = createShape(s().doc, 'rect');
    s().addElement(r);
    s().updateElements([r.id], { fill: '#ff0000' });
    s().undo();
    expect(getActivePage().elements[0]).toMatchObject({ fill: r.fill });
    s().undo();
    expect(getActivePage().elements).toHaveLength(0);
    s().redo();
    s().redo();
    expect(getActivePage().elements[0]).toMatchObject({ fill: '#ff0000' });
  });

  it('una acción nueva descarta el futuro', () => {
    s().addElement(createShape(s().doc, 'rect'));
    s().undo();
    expect(s().future).toHaveLength(1);
    s().addElement(createShape(s().doc, 'ellipse'));
    expect(s().future).toHaveLength(0);
  });

  it('fusiona cambios con la misma mergeKey (p. ej. flechas)', () => {
    const r = createShape(s().doc, 'rect');
    s().addElement(r);
    s().nudge(1, 0);
    s().nudge(1, 0);
    s().nudge(1, 0);
    expect(s().past).toHaveLength(2);
    s().undo();
    expect(getActivePage().elements[0].x).toBe(r.x);
  });

  it('emite deshacer como parches hacia adelante', () => {
    const seen: { source: string; patches: Patch[] }[] = [];
    const off = onDocChange((patches, source) => seen.push({ source, patches }));
    s().addElement(createShape(s().doc, 'rect'));
    s().undo();
    off();
    expect(seen.map((x) => x.source)).toEqual(['local', 'undo']);
    expect(seen[1].patches.length).toBeGreaterThan(0);
  });

  it('no registra cambios vacíos', () => {
    expect(s().commit('nada', () => {})).toBe(false);
    expect(s().past).toHaveLength(0);
  });
});

describe('capas', () => {
  const setup = () => {
    const a = createShape(s().doc, 'rect', { id: 'a' });
    const b = createShape(s().doc, 'rect', { id: 'b' });
    const c = createShape(s().doc, 'rect', { id: 'c' });
    for (const el of [a, b, c]) s().addElement(el);
    return () => getActivePage().elements.map((e) => e.id).join('');
  };

  it('adelante / atrás / al frente / al fondo', () => {
    const order = setup();
    s().select(['a']);
    s().arrange('forward');
    expect(order()).toBe('bac');
    s().arrange('front');
    expect(order()).toBe('bca');
    s().arrange('back');
    expect(order()).toBe('abc');
    s().arrange('backward');
    expect(order()).toBe('abc');
  });

  it('reordena por arrastre en el panel', () => {
    const order = setup();
    s().moveLayer(getActivePage().id, 0, 2);
    expect(order()).toBe('bca');
  });

  it('alinea un elemento a la página y varios entre sí', () => {
    setup();
    s().updateElements(['a'], { x: 10, y: 10, width: 100, height: 100 });
    s().updateElements(['b'], { x: 300, y: 50, width: 50, height: 50 });
    s().select(['a']);
    s().align('right');
    expect(getActivePage().elements[0].x).toBe(900);
    s().select(['a', 'b']);
    s().align('top');
    expect(getActivePage().elements.slice(0, 2).map((e) => e.y)).toEqual([10, 10]);
  });
});

describe('páginas', () => {
  it('agrega, duplica, mueve y elimina páginas', () => {
    const first = getActivePage().id;
    s().addElement(createShape(s().doc, 'rect'));
    s().duplicatePage(first);
    expect(s().doc.pages).toHaveLength(2);
    expect(s().doc.pages[1].elements[0].id).not.toBe(s().doc.pages[0].elements[0].id);
    s().addPage();
    expect(s().doc.pages).toHaveLength(3);
    expect(s().activePageId).toBe(s().doc.pages[2].id);
    s().movePage(s().doc.pages[2].id, -1);
    expect(s().doc.pages[1].elements).toHaveLength(0);
    s().deletePage(s().doc.pages[1].id);
    expect(s().doc.pages).toHaveLength(2);
  });

  it('nunca deja el documento sin páginas', () => {
    s().deletePage(getActivePage().id);
    expect(s().doc.pages).toHaveLength(1);
  });

  it('redimensiona el diseño escalando el contenido', () => {
    const r = createShape(s().doc, 'rect');
    s().addElement(r);
    s().resizeDesign(500, 500, true);
    expect(getActivePage().elements[0]).toMatchObject({ x: r.x / 2, width: r.width / 2 });
  });
});

describe('colaboración', () => {
  it('aplica parches remotos sin tocar el historial', () => {
    const r = createShape(s().doc, 'rect');
    s().addElement(r);
    s().applyRemote([{ op: 'replace', path: ['pages', 0, 'elements', 0, 'fill'], value: '#000' }]);
    expect(getActivePage().elements[0]).toMatchObject({ fill: '#000' });
    expect(s().past).toHaveLength(1);
  });
});

describe('comportamientos observados', () => {
  it('el título automático sigue al primer texto mientras se edita', () => {
    const t = createText(s().doc, 'body');
    s().addElement(t);
    expect(s().doc.title).toBe('Texto del párrafo');
    s().updateElements([t.id], { text: 'Hola mundo' });
    expect(s().doc.title).toBe('Hola mundo');
  });

  it('rehacer una inserción vuelve a seleccionar el elemento', () => {
    const r = createShape(s().doc, 'rect');
    s().addElement(r);
    s().undo();
    expect(s().selectedIds).toEqual([]);
    s().redo();
    expect(s().selectedIds).toEqual([r.id]);
  });

  it('deshacer un borrado selecciona lo restaurado', () => {
    const r = createShape(s().doc, 'rect');
    s().addElement(r);
    s().deleteSelected();
    s().undo();
    expect(s().selectedIds).toEqual([r.id]);
  });
});

describe('selección tras deshacer un reordenamiento', () => {
  it('no selecciona elementos que ya existían', () => {
    const a = createShape(s().doc, 'rect', { id: 'a' });
    const b = createShape(s().doc, 'rect', { id: 'b' });
    s().addElement(a);
    s().addElement(b);
    s().select(['a']);
    s().arrange('front');
    s().undo();
    expect(s().selectedIds).toEqual(['a']);
  });
});
