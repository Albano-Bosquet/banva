import { beforeEach, describe, expect, it } from 'vitest';
import { createDoc, createFrame, createGrid, createTable, type FrameElement, type GridElement } from '@trazo/shared';
import { SHAPES, shapeDef, shapePath } from './shapeLibrary';
import { GRAPHICS, graphicDataUrl } from './graphicsLibrary';
import { SHEET_TEMPLATES } from './sheets';
import { niceScale } from '../canvas/bodies';
import { cellAt } from '../canvas/TableCellEditor';
import { parseTable } from '../editor/DataPanels';
import { fillTargetAt, insertImage } from '../editor/insert';
import { useEditor } from '../store/editorStore';

describe('biblioteca de formas', () => {
  it('cada forma de trazado tiene un path válido dentro de la caja 0..100', () => {
    for (const s of SHAPES.filter((x) => x.render === 'path')) {
      expect(s.path, s.key).toMatch(/^M/);
      const nums = s.path!.match(/-?\d+(\.\d+)?/g)!.map(Number);
      // Las coordenadas absolutas quedan en la caja (los arcos relativos de "thought" son la excepción).
      if (s.key !== 'thought') for (const n of nums) expect(n, s.key).toBeGreaterThanOrEqual(-5), expect(n, s.key).toBeLessThanOrEqual(105);
    }
  });

  it('resuelve claves conocidas y usa rectángulo para las desconocidas', () => {
    expect(shapeDef('hexagon').label).toBe('Hexágono');
    expect(shapeDef('no-existe').key).toBe('rect');
    expect(shapePath('ellipse')).toContain('A50 50');
  });
});

describe('ilustraciones', () => {
  it('cada SVG tiene tantos colores como marcadores', () => {
    for (const g of GRAPHICS) {
      const used = new Set([...g.svg.matchAll(/\{\{(\d+)\}\}/g)].map((m) => +m[1]));
      expect(Math.max(...used) + 1, g.id).toBe(g.colors.length);
    }
  });

  it('sustituye los colores en el data URL', () => {
    const url = graphicDataUrl('<svg fill="{{0}}" stroke="{{1}}"/>', ['#ff0000', '#00ff00']);
    expect(decodeURIComponent(url)).toContain('fill="#ff0000" stroke="#00ff00"');
  });
});

describe('gráficos', () => {
  it('elige escalas redondas', () => {
    expect(niceScale(24)).toEqual({ max: 25, step: 5, ticks: 5 });
    expect(niceScale(42)).toEqual({ max: 50, step: 10, ticks: 5 });
    expect(niceScale(0.8).max).toBeCloseTo(0.8);
    expect(niceScale(0)).toMatchObject({ max: 1 });
  });

  it('interpreta datos pegados en CSV, punto y coma o tabulaciones', () => {
    expect(parseTable('Mes,Ventas,Gastos\nEne,12,8\nFeb,19,"x"')).toEqual({
      labels: ['Ene', 'Feb'],
      series: [
        { name: 'Ventas', values: [12, 19] },
        { name: 'Gastos', values: [8, 0] },
      ],
    });
    expect(parseTable('A;B\nx;1,5')?.series[0].values).toEqual([1.5]);
    expect(parseTable('A\tB\nx\t3')?.labels).toEqual(['x']);
    expect(parseTable('solo una línea')).toBeNull();
  });
});

describe('tablas', () => {
  it('ubica la celda bajo un punto según los anchos de columna', () => {
    const t = createTable({ width: 1000, height: 1000 }, 4, 2, 'header', '#5b6cff', { width: 300, height: 400, colWidths: [2, 1] });
    expect(cellAt(t, 10, 10)).toEqual({ row: 0, col: 0 });
    expect(cellAt(t, 250, 150)).toEqual({ row: 1, col: 1 });
    expect(cellAt(t, 999, 999)).toEqual({ row: 3, col: 1 });
  });

  it('las plantillas de hoja tienen filas del mismo largo', () => {
    for (const t of SHEET_TEMPLATES) {
      for (const row of t.cells) expect(row.length, t.id).toBe(t.cells[0].length);
      if (t.colWidths) expect(t.colWidths.length, t.id).toBe(t.cells[0].length);
    }
  });
});

describe('rellenar marcos y cuadrículas', () => {
  let frame: FrameElement;
  let grid: GridElement;
  beforeEach(() => {
    const doc = createDoc(1000, 1000);
    grid = createGrid(doc, '2v', { gap: 0 });
    frame = createFrame(doc, 'ellipse', 'none', { x: 100, y: 100, width: 200, height: 200 });
    doc.pages[0].elements.push(grid, frame);
    useEditor.getState().load('t', doc);
  });

  it('encuentra el marco de más arriba y, si no, la celda de la cuadrícula', () => {
    const pageId = useEditor.getState().doc.pages[0].id;
    expect(fillTargetAt(pageId, { x: 150, y: 150 })).toMatchObject({ el: { id: frame.id }, cell: null });
    expect(fillTargetAt(pageId, { x: 800, y: 500 })).toMatchObject({ el: { id: grid.id }, cell: 1 });
  });

  it('insertar una imagen con un marco seleccionado lo rellena sin crear elementos', async () => {
    const st = useEditor.getState();
    st.select([frame.id]);
    await insertImage('/uploads/a.png');
    const page = useEditor.getState().doc.pages[0];
    expect(page.elements).toHaveLength(2);
    expect(page.elements.find((e) => e.id === frame.id)).toMatchObject({ src: '/uploads/a.png', zoom: 1 });
  });

  it('con una cuadrícula seleccionada se usa la primera celda vacía', async () => {
    useEditor.getState().updateElements([grid.id], (d) => {
      if (d.type === 'grid') d.cells[0].src = '/uploads/x.png';
    });
    useEditor.getState().select([grid.id]);
    await insertImage('/uploads/b.png');
    const g = useEditor.getState().doc.pages[0].elements.find((e) => e.id === grid.id) as GridElement;
    expect(g.cells.map((c) => c.src)).toEqual(['/uploads/x.png', '/uploads/b.png']);
  });
});
