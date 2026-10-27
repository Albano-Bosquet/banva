import { createImage, createVideo, type DesignElement, type FrameElement, type GridElement } from '@trazo/shared';
import { useEditor } from '../store/editorStore';
import { loadImage } from '../canvas/useImage';
import { gridCellBoxes } from '../canvas/bodies';
import { elementBounds } from '../lib/geometry';

type Point = { x: number; y: number };

/** Punto en coordenadas locales (sin rotación) de un elemento. */
function toLocal(el: DesignElement, p: Point): Point {
  const rad = (-el.rotation * Math.PI) / 180;
  const dx = p.x - el.x;
  const dy = p.y - el.y;
  return { x: dx * Math.cos(rad) - dy * Math.sin(rad), y: dx * Math.sin(rad) + dy * Math.cos(rad) };
}

/** Marco o celda de cuadrícula bajo un punto de la página (el de más arriba). */
export function fillTargetAt(pageId: string, p: Point): { el: FrameElement | GridElement; cell: number | null } | null {
  const page = useEditor.getState().doc.pages.find((x) => x.id === pageId);
  if (!page) return null;
  for (let i = page.elements.length - 1; i >= 0; i--) {
    const el = page.elements[i];
    if (!el.visible || el.locked || (el.type !== 'frame' && el.type !== 'grid')) continue;
    const l = toLocal(el, p);
    if (l.x < 0 || l.y < 0 || l.x > el.width || l.y > el.height) continue;
    if (el.type === 'frame') return { el, cell: null };
    const boxes = gridCellBoxes(el);
    const cell = boxes.findIndex((b) => l.x >= b.x && l.x <= b.x + b.w && l.y >= b.y && l.y <= b.y + b.h);
    if (cell >= 0) return { el, cell };
  }
  return null;
}

/** Pone una imagen en un marco o en una celda, reiniciando su encuadre. */
export function fillWithImage(target: { el: FrameElement | GridElement; cell: number | null }, src: string) {
  useEditor.getState().updateElements([target.el.id], (d) => {
    if (d.type === 'frame') Object.assign(d, { src, zoom: 1, offsetX: 0, offsetY: 0 });
    if (d.type === 'grid' && target.cell !== null) Object.assign(d.cells[target.cell], { src, zoom: 1, offsetX: 0, offsetY: 0 });
  }, { label: 'Rellenar marco' });
  useEditor.getState().select([target.el.id]);
}

/** Marco o cuadrícula seleccionados que pueden recibir una imagen. */
function selectedFillTarget(): { el: FrameElement | GridElement; cell: number | null } | null {
  const st = useEditor.getState();
  if (st.selectedIds.length !== 1) return null;
  const el = st.doc.pages.flatMap((p) => p.elements).find((e) => e.id === st.selectedIds[0]);
  if (!el || el.locked) return null;
  if (el.type === 'frame') return { el, cell: null };
  if (el.type === 'grid') {
    const empty = el.cells.findIndex((c) => !c.src);
    return { el, cell: empty >= 0 ? empty : 0 };
  }
  return null;
}

/**
 * Inserta una imagen. Si hay un marco o una cuadrícula seleccionados, la imagen los
 * rellena (como al soltarla encima); si no, se agrega como elemento nuevo.
 */
export async function insertImage(url: string, opts: { credit?: string; pageId?: string; at?: Point } = {}) {
  const st = useEditor.getState();
  const target = opts.at && opts.pageId ? fillTargetAt(opts.pageId, opts.at) : selectedFillTarget();
  if (target) return fillWithImage(target, url);
  const img = await loadImage(url);
  const el = createImage(st.doc, url, img.naturalWidth, img.naturalHeight, opts.credit ? { credit: opts.credit } : {});
  if (opts.at) {
    el.x = opts.at.x - el.width / 2;
    el.y = opts.at.y - el.height / 2;
  }
  st.addElement(el, opts.pageId);
}

export function loadVideoSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => resolve({ width: v.videoWidth || 1280, height: v.videoHeight || 720 });
    v.onerror = () => resolve({ width: 1280, height: 720 });
    v.src = url;
  });
}

export async function insertVideo(url: string, opts: { pageId?: string; at?: Point } = {}) {
  const { width, height } = await loadVideoSize(url);
  const st = useEditor.getState();
  const el = createVideo(st.doc, url, width, height);
  if (opts.at) {
    el.x = opts.at.x - el.width / 2;
    el.y = opts.at.y - el.height / 2;
  }
  st.addElement(el, opts.pageId);
}

/** Centro visible de un elemento, útil para pruebas y posicionamiento. */
export function centerOf(el: DesignElement): Point {
  const b = elementBounds(el);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
