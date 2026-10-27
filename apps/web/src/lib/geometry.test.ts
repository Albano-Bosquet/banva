import { describe, expect, it } from 'vitest';
import { alignDelta, computeSnap, elementBounds, unionBounds } from './geometry';

describe('geometry', () => {
  it('calcula la caja de un elemento rotado 90°', () => {
    const b = elementBounds({ x: 100, y: 100, width: 50, height: 20, rotation: 90 });
    expect(b.x).toBeCloseTo(80);
    expect(b.y).toBeCloseTo(100);
    expect(b.width).toBeCloseTo(20);
    expect(b.height).toBeCloseTo(50);
  });

  it('une cajas', () => {
    expect(unionBounds([{ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 5, width: 5, height: 20 }])).toEqual({ x: 0, y: 0, width: 25, height: 25 });
    expect(unionBounds([])).toBeNull();
  });

  it('ajusta al centro de la página', () => {
    const r = computeSnap({ x: 447, y: 10, width: 100, height: 100 }, [], { width: 1000, height: 1000 }, 5);
    expect(r.dx).toBe(3);
    expect(r.guides).toContainEqual({ orientation: 'V', pos: 500 });
  });

  it('ajusta al borde de otro elemento y elige el más cercano', () => {
    const r = computeSnap({ x: 198, y: 300, width: 50, height: 50 }, [{ x: 100, y: 0, width: 100, height: 40 }], { width: 1000, height: 1000 }, 5);
    expect(r.dx).toBe(2);
    expect(r.dy).toBe(0);
  });

  it('no ajusta fuera del umbral', () => {
    const r = computeSnap({ x: 120, y: 130, width: 10, height: 10 }, [], { width: 1000, height: 1000 }, 5);
    expect(r).toEqual({ dx: 0, dy: 0, guides: [] });
  });

  it('calcula desplazamientos de alineación', () => {
    const page = { x: 0, y: 0, width: 100, height: 100 };
    expect(alignDelta({ x: 10, y: 10, width: 20, height: 20 }, page, 'center')).toEqual({ dx: 30, dy: 0 });
    expect(alignDelta({ x: 10, y: 10, width: 20, height: 20 }, page, 'bottom')).toEqual({ dx: 0, dy: 70 });
  });
});
