import { beforeEach, describe, expect, it } from 'vitest';
import { createBlock, createDocOfKind, createSheet, type Block } from '@trazo/shared';
import { sanitizeHtml, textOf } from './sanitize';
import { blocksToHtml, blocksToMarkdown, standaloneHtml } from './exportDoc';
import { mergeWithPrevious, removeBlock, setBlockType, splitBlock, useDocFocus } from './ops';
import { useEditor } from '../store/editorStore';
import { formatValue, sheetGrid, sheetToCsv } from '../sheets/SheetEditor';
import { addAdjacentSticky, placeTool, useWbTool } from '../whiteboard/tools';

describe('saneador de html', () => {
  it('conserva el formato y descarta lo peligroso', () => {
    expect(sanitizeHtml('<b>hola</b> <strong>x</strong> <em>y</em>')).toBe('<b>hola</b> <b>x</b> <i>y</i>');
    expect(sanitizeHtml('<img src=x onerror="alert(1)">texto<script>alert(1)</script>')).toBe('textoalert(1)');
    expect(sanitizeHtml('<a href="javascript:alert(1)">mal</a>')).toBe('<a>mal</a>');
    expect(sanitizeHtml('<a href="https://ok.test" onclick="x()">bien</a>')).toBe('<a href="https://ok.test" target="_blank" rel="noopener noreferrer">bien</a>');
    expect(sanitizeHtml('<span style="color: rgb(232, 64, 42); position: fixed">rojo</span>')).toBe('<span style="color: rgb(232, 64, 42);">rojo</span>');
    expect(sanitizeHtml('<div>uno</div><div>dos</div>')).toBe('uno<br>dos');
  });

  it('textOf devuelve el texto plano', () => {
    expect(textOf('<b>a</b> b')).toBe('a b');
  });
});

describe('exportación de documentos', () => {
  const blocks: Block[] = [
    createBlock('h1', { html: 'Título' }),
    createBlock('bullet', { html: 'uno' }),
    createBlock('bullet', { html: '<b>dos</b>' }),
    createBlock('check', { html: 'hecho', checked: true }),
    createBlock('table', { rows: [['A', 'B'], ['1', '2']] }),
    createBlock('button', { html: 'Comprar', url: 'https://tienda.test' }),
  ];

  it('agrupa listas y genera html con estilos en línea', () => {
    const html = blocksToHtml(blocks, true);
    expect(html.match(/<ul/g)).toHaveLength(2); // viñetas y tareas son listas distintas
    expect(html).toContain('<li style="">uno</li>');
    expect(html).toContain('href="https://tienda.test"');
    expect(html).toContain('☑ <s>hecho</s>');
    expect(standaloneHtml('x', blocks, 600, true)).toContain('max-width:600px');
  });

  it('exporta Markdown', () => {
    expect(blocksToMarkdown(blocks)).toBe('# Título\n\n- uno\n\n- **dos**\n\n- [x] hecho\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n[Comprar](https://tienda.test)');
  });
});

describe('operaciones de bloques', () => {
  beforeEach(() => {
    const doc = createDocOfKind('doc');
    doc.blocks = [createBlock('h1', { id: 'a', html: 'Título' }), createBlock('bullet', { id: 'b', html: 'uno' })];
    useEditor.getState().load('d', doc);
  });
  const blocks = () => useEditor.getState().doc.blocks!;

  it('Enter en una lista crea otro ítem; en un ítem vacío sale de la lista', () => {
    splitBlock('b', 'un', 'o');
    expect(blocks().map((x) => [x.type, x.html])).toEqual([['h1', 'Título'], ['bullet', 'un'], ['bullet', 'o']]);
    expect(useDocFocus.getState().id).toBe(blocks()[2].id);
    const empty = blocks()[2].id;
    useEditor.getState().commit('t', (d) => void (d.blocks![2].html = ''));
    splitBlock(empty, '', '');
    expect(blocks()[2]).toMatchObject({ type: 'p', html: '' });
  });

  it('Retroceso al inicio une con el bloque anterior', () => {
    mergeWithPrevious('b');
    expect(blocks()).toHaveLength(1);
    expect(blocks()[0].html).toBe('Títulouno');
  });

  it('un párrafo vacío se reemplaza por el bloque elegido en el menú', () => {
    useEditor.getState().commit('t', (d) => void d.blocks!.push(createBlock('p', { id: 'c' })));
    setBlockType('c', 'table');
    expect(blocks()[2]).toMatchObject({ id: 'c', type: 'table' });
    setBlockType('a', 'h2');
    expect(blocks()[0]).toMatchObject({ type: 'h2', html: 'Título' });
  });

  it('nunca queda un documento sin bloques', () => {
    removeBlock('a');
    removeBlock('b');
    expect(blocks()).toHaveLength(1);
    expect(blocks()[0].type).toBe('p');
  });
});

describe('hoja de cálculo', () => {
  it('arma la grilla usada, calcula y exporta CSV', () => {
    const s = createSheet();
    s.cells = { A1: 'Item', B1: 'Monto', A2: 'Té', B2: '1500', B3: '=B2*2', C4: 'x;y' };
    expect(sheetGrid(s)).toHaveLength(4);
    expect(sheetToCsv(s).split('\r\n')).toEqual(['Item;Monto;', 'Té;1500;', ';3000;', ';;"x;y"']);
  });

  it('formatea moneda, porcentaje y decimales', () => {
    expect(formatValue(1234.5, { format: 'currency' })).toBe('$ 1.234,50');
    expect(formatValue(0.256, { format: 'percent', decimals: 1 })).toBe('25,6 %');
    expect(formatValue(3, { decimals: 2 })).toBe('3,00');
    expect(formatValue('texto', { format: 'currency' })).toBe('texto');
  });
});

describe('pizarra', () => {
  beforeEach(() => useEditor.getState().load('w', createDocOfKind('whiteboard')));

  it('coloca una nota con el color elegido y la abre para escribir', () => {
    useWbTool.getState().set({ stickyColor: '#bff0c8' });
    const el = placeTool('sticky', 500, 400)!;
    expect(el).toMatchObject({ type: 'sticky', color: '#bff0c8', x: 390, y: 290 });
    expect(useEditor.getState().editingTextId).toBe(el.id);
  });

  it('el "+" crea una nota contigua alineada', () => {
    const el = placeTool('sticky', 500, 400)!;
    if (el.type !== 'sticky') throw new Error();
    addAdjacentSticky(el, 'right');
    addAdjacentSticky(el, 'bottom');
    const notes = useEditor.getState().doc.pages[0].elements;
    expect(notes.map((n) => [n.x, n.y])).toEqual([[390, 290], [634, 290], [390, 534]]);
  });

  it('las secciones van al fondo', () => {
    placeTool('sticky', 100, 100);
    placeTool('section', 100, 100);
    expect(useEditor.getState().doc.pages[0].elements[0].name).toBe('Sección');
  });
});
