import { describe, expect, it } from 'vitest';
import {
  GRID_LAYOUTS,
  colName,
  createChart,
  createDoc,
  createForm,
  createFrame,
  createGraphic,
  createGrid,
  createShape,
  createSolid,
  createTable,
  createVideo,
  designDocSchema,
  displayCells,
  evaluateCells,
  parseRef,
  tint,
  toNumber,
} from './index';

describe('nuevos elementos', () => {
  it('todas las fábricas producen documentos válidos', () => {
    const doc = createDoc(1080, 1080);
    doc.pages[0].elements.push(
      createShape(doc, 'hexagon'),
      createShape(doc, 'line', { dash: 'dashed', arrow: 'end' }),
      createGraphic(doc, '<svg fill="{{0}}"/>', ['#ff0000']),
      createChart(doc, 'bar'),
      createChart(doc, 'donut'),
      createTable(doc, 3, 4, 'banded', '#ff6b4a'),
      createFrame(doc, 'ellipse'),
      createFrame(doc, 'rect', 'phone'),
      createGrid(doc, '2x2'),
      createSolid(doc, 'cube'),
      createVideo(doc, '/uploads/a.mp4', 1920, 1080),
      createForm(doc, 'contact'),
    );
    doc.audio = [{ id: 'a1', src: '/uploads/a.mp3', title: 'Pista', volume: 0.8 }];
    const r = designDocSchema.safeParse(doc);
    expect(r.success, JSON.stringify(r.error?.issues?.[0])).toBe(true);
  });

  it('las cuadrículas cubren la página completa', () => {
    const g = createGrid({ width: 800, height: 600 }, '1+2');
    expect(g).toMatchObject({ x: 0, y: 0, width: 800, height: 600 });
    expect(g.cells).toHaveLength(3);
    for (const layout of GRID_LAYOUTS) {
      const area = layout.cells.reduce((s, [, , w, h]) => s + w * h, 0);
      expect(area, layout.id).toBeCloseTo(1, 5);
    }
  });

  it('los marcos de dispositivos respetan su proporción', () => {
    const phone = createFrame({ width: 1000, height: 1000 }, 'rect', 'phone');
    expect(phone.width / phone.height).toBeCloseTo(0.5, 2);
  });

  it('las líneas con flecha reservan alto para la punta', () => {
    const plain = createShape({ width: 1000, height: 1000 }, 'line');
    const arrow = createShape({ width: 1000, height: 1000 }, 'line', { arrow: 'end' });
    expect(arrow.height).toBe(plain.height * 5);
  });

  it('tint aclara colores hacia el blanco', () => {
    expect(tint('#000000', 0.5)).toBe('#808080');
    expect(tint('#ff6b4a', 1)).toBe('#ffffff');
  });
});

describe('fórmulas', () => {
  it('parsea referencias y nombres de columna', () => {
    expect(parseRef('B3')).toEqual({ row: 2, col: 1 });
    expect(parseRef('AA1')).toEqual({ row: 0, col: 26 });
    expect(colName(0)).toBe('A');
    expect(colName(27)).toBe('AB');
  });

  it('interpreta números en distintos formatos', () => {
    expect(toNumber('1200')).toBe(1200);
    expect(toNumber('1.200,50')).toBe(1200.5);
    expect(toNumber('$ 30')).toBe(30);
    expect(toNumber('15%')).toBe(0.15);
    expect(toNumber('hola')).toBeNull();
  });

  it('evalúa sumas, promedios, aritmética y referencias encadenadas', () => {
    const cells = [
      ['Item', 'Monto'],
      ['A', '100'],
      ['B', '250'],
      ['Total', '=SUMA(B2:B3)'],
      ['Promedio', '=PROMEDIO(B2:B3)'],
      ['Con IVA', '=B4*1.21'],
      ['Mixto', '=(B2+B3)/2 - MIN(B2;B3) + 2^3'],
    ];
    const v = evaluateCells(cells);
    expect(v[3][1]).toBe(350);
    expect(v[4][1]).toBe(175);
    expect(v[5][1]).toBeCloseTo(423.5);
    expect(v[6][1]).toBe(83);
    expect(displayCells(cells)[5][1]).toBe('423,5');
  });

  it('informa errores sin romper el resto', () => {
    const cells = [['=A2', '=1/0', '=FOO(1)', '=2+'], ['=A1', '5', '=B2*2', 'x']];
    const d = displayCells(cells);
    expect(d[0][0]).toBe('#CICLO');
    expect(d[0][1]).toBe('#DIV/0');
    expect(d[0][2]).toBe('#NOMBRE');
    expect(d[0][3]).toBe('#ERROR');
    expect(d[1][2]).toBe('10');
  });
});
