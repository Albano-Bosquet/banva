import type { DesignElement } from '@trazo/shared';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Caja alineada a los ejes que contiene al elemento rotado.
 * Konva rota alrededor de (x, y), la esquina superior izquierda sin rotar.
 */
export function elementBounds(el: Pick<DesignElement, 'x' | 'y' | 'width' | 'height' | 'rotation'>): Box {
  if (!el.rotation) return { x: el.x, y: el.y, width: el.width, height: el.height };
  const rad = (el.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corners = [
    [0, 0],
    [el.width, 0],
    [el.width, el.height],
    [0, el.height],
  ].map(([px, py]) => [el.x + px * cos - py * sin, el.y + px * sin + py * cos]);
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

export function unionBounds(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.width));
  const maxY = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export interface Guide {
  orientation: 'V' | 'H';
  /** Posición en unidades de diseño (x para V, y para H). */
  pos: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: Guide[];
}

/**
 * Ajuste magnético: compara bordes y centro de la caja en movimiento con los de
 * la página y del resto de los elementos, y devuelve la corrección más cercana
 * por eje dentro del umbral.
 */
export function computeSnap(moving: Box, targets: Box[], page: { width: number; height: number }, threshold: number): SnapResult {
  const vTargets = [0, page.width / 2, page.width];
  const hTargets = [0, page.height / 2, page.height];
  for (const t of targets) {
    vTargets.push(t.x, t.x + t.width / 2, t.x + t.width);
    hTargets.push(t.y, t.y + t.height / 2, t.y + t.height);
  }
  const vLines = [moving.x, moving.x + moving.width / 2, moving.x + moving.width];
  const hLines = [moving.y, moving.y + moving.height / 2, moving.y + moving.height];

  const best = (lines: number[], targetsAxis: number[]) => {
    let result: { delta: number; pos: number } | null = null;
    for (const line of lines) {
      for (const t of targetsAxis) {
        const delta = t - line;
        if (Math.abs(delta) <= threshold && (!result || Math.abs(delta) < Math.abs(result.delta))) {
          result = { delta, pos: t };
        }
      }
    }
    return result;
  };

  const v = best(vLines, vTargets);
  const h = best(hLines, hTargets);
  const guides: Guide[] = [];
  if (v) guides.push({ orientation: 'V', pos: v.pos });
  if (h) guides.push({ orientation: 'H', pos: h.pos });
  return { dx: v?.delta ?? 0, dy: h?.delta ?? 0, guides };
}

export type AlignEdge = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

/** Desplazamiento necesario para alinear `box` con `ref` en el borde indicado. */
export function alignDelta(box: Box, ref: Box, edge: AlignEdge): { dx: number; dy: number } {
  switch (edge) {
    case 'left':
      return { dx: ref.x - box.x, dy: 0 };
    case 'center':
      return { dx: ref.x + ref.width / 2 - (box.x + box.width / 2), dy: 0 };
    case 'right':
      return { dx: ref.x + ref.width - (box.x + box.width), dy: 0 };
    case 'top':
      return { dx: 0, dy: ref.y - box.y };
    case 'middle':
      return { dx: 0, dy: ref.y + ref.height / 2 - (box.y + box.height / 2) };
    case 'bottom':
      return { dx: 0, dy: ref.y + ref.height - (box.y + box.height) };
  }
}
