import { create } from 'zustand';
import { applyPatches, enablePatches, produceWithPatches, type Draft, type Patch as ImmerPatch } from 'immer';
import {
  createDoc,
  createPage,
  deriveTitle,
  newId,
  type DesignDoc,
  type DesignElement,
  type Page,
  type Patch,
  type TextElement,
} from '@trazo/shared';
import { alignDelta, elementBounds, unionBounds, type AlignEdge } from '../lib/geometry';

enablePatches();

export const DEFAULT_TITLE = 'Diseño sin título';
const MERGE_WINDOW_MS = 800;
const HISTORY_LIMIT = 200;

export interface HistoryEntry {
  label: string;
  patches: Patch[];
  inverse: Patch[];
  mergeKey?: string;
  at: number;
}

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'offline' | 'error';
export type Arrange = 'forward' | 'backward' | 'front' | 'back';

/** Origen de un cambio en el documento: local (nuevo, deshacer, rehacer) o remoto (colaborador). */
export type ChangeSource = 'local' | 'undo' | 'redo' | 'remote' | 'load';
type ChangeListener = (patches: Patch[], source: ChangeSource) => void;

export interface CommitOptions {
  /** Cambios consecutivos con la misma clave dentro de la ventana se fusionan en una sola entrada de historial. */
  mergeKey?: string;
  /** Cambios derivados (p. ej. re-medir texto) que se sincronizan pero no se deshacen. */
  skipHistory?: boolean;
}

export interface EditorState {
  designId: string | null;
  revision: number;
  doc: DesignDoc;
  activePageId: string;
  selectedIds: string[];
  editingTextId: string | null;
  zoom: number;
  past: HistoryEntry[];
  future: HistoryEntry[];
  clipboard: DesignElement[];
  saveStatus: SaveStatus;

  load(designId: string | null, doc: DesignDoc, revision?: number): void;
  commit(label: string, recipe: (draft: Draft<DesignDoc>) => void, opts?: CommitOptions): boolean;
  applyRemote(patches: Patch[]): void;
  replaceDoc(doc: DesignDoc, revision: number): void;
  setRevision(revision: number): void;
  setSaveStatus(status: SaveStatus): void;
  undo(): void;
  redo(): void;

  // selección
  select(ids: string[], additive?: boolean): void;
  selectAll(): void;
  clearSelection(): void;
  setEditingText(id: string | null): void;

  // elementos
  addElement(el: DesignElement, pageId?: string): void;
  updateElements(ids: string[], patch: Partial<DesignElement> | ((el: Draft<DesignElement>) => void), opts?: CommitOptions & { label?: string }): void;
  deleteSelected(): void;
  duplicateSelected(): void;
  copy(): void;
  cut(): void;
  paste(): void;
  nudge(dx: number, dy: number): void;
  arrange(kind: Arrange): void;
  moveLayer(pageId: string, fromIndex: number, toIndex: number): void;
  align(edge: AlignEdge): void;
  toggleLock(ids?: string[]): void;
  toggleVisibility(id: string): void;

  // páginas
  setActivePage(id: string): void;
  addPage(afterId?: string): void;
  duplicatePage(id: string): void;
  deletePage(id: string): void;
  movePage(id: string, dir: -1 | 1): void;
  renamePage(id: string, title: string): void;
  setPageBackground(id: string, color: string): void;

  // documento
  setTitle(title: string): void;
  resizeDesign(width: number, height: number, scaleContent: boolean): void;
  /** Inserta las páginas de una plantilla (escaladas al tamaño del diseño si hace falta). */
  applyTemplate(template: DesignDoc): void;
  setZoom(zoom: number): void;
}

type TextMeasurer = (el: TextElement) => number;
let measureText: TextMeasurer | null = null;
/** El lienzo registra cómo medir texto; así la altura guardada coincide con la renderizada. */
export function setTextMeasurer(fn: TextMeasurer | null) {
  measureText = fn;
}

const listeners = new Set<ChangeListener>();
/** Suscripción a cambios del documento como parches (usada por autoguardado y colaboración). */
export function onDocChange(fn: ChangeListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit(patches: Patch[], source: ChangeSource) {
  if (!patches.length) return;
  for (const fn of listeners) fn(patches, source);
}

const toPatches = (p: ImmerPatch[]): Patch[] => p.map((x) => ({ op: x.op, path: [...x.path], value: x.value }));
const toImmer = (p: Patch[]): ImmerPatch[] => p as ImmerPatch[];

function activePage(s: Pick<EditorState, 'doc' | 'activePageId'>): Page {
  return s.doc.pages.find((p) => p.id === s.activePageId) ?? s.doc.pages[0];
}

function findElement(doc: Draft<DesignDoc> | DesignDoc, id: string): { page: Page; index: number } | null {
  for (const page of doc.pages as Page[]) {
    const index = page.elements.findIndex((e) => e.id === id);
    if (index >= 0) return { page, index };
  }
  return null;
}

/**
 * Tras deshacer/rehacer se seleccionan los elementos que la operación vuelve a
 * insertar (p. ej. rehacer una inserción o deshacer un borrado); si no hay, se
 * conserva la selección que siga existiendo.
 */
function restoredSelection(prev: DesignDoc, doc: DesignDoc, current: string[]): string[] {
  const before = new Set(prev.pages.flatMap((p) => p.elements.map((e) => e.id)));
  for (const page of doc.pages) {
    const added = page.elements.filter((e) => !before.has(e.id)).map((e) => e.id);
    if (added.length) return added;
  }
  return current.filter((id) => findElement(doc, id));
}

const initialDoc = createDoc(1080, 1080, DEFAULT_TITLE);

export const useEditor = create<EditorState>()((set, get) => ({
  designId: null,
  revision: 0,
  doc: initialDoc,
  activePageId: initialDoc.pages[0].id,
  selectedIds: [],
  editingTextId: null,
  zoom: 0.5,
  past: [],
  future: [],
  clipboard: [],
  saveStatus: 'saved',

  load(designId, doc, revision = 0) {
    set({ designId, doc, revision, activePageId: doc.pages[0].id, selectedIds: [], editingTextId: null, past: [], future: [], saveStatus: 'saved' });
  },

  commit(label, recipe, opts = {}) {
    const state = get();
    const derivedBefore = deriveTitle(state.doc);
    const [next, rawPatches, rawInverse] = produceWithPatches(state.doc, (draft) => {
      recipe(draft);
      if (measureText) {
        for (const page of draft.pages) {
          for (const el of page.elements) {
            if (el.type !== 'text') continue;
            const h = measureText(el as TextElement);
            if (Math.abs(h - el.height) > 0.5) el.height = h;
          }
        }
      }
      // Título automático a partir del primer texto mientras el usuario no haya puesto uno
      // (si el título actual es el que se derivó antes, sigue siendo automático).
      if (draft.title === DEFAULT_TITLE || draft.title === '' || draft.title === derivedBefore) {
        const derived = deriveTitle(draft as DesignDoc);
        if (derived) draft.title = derived;
      }
    });
    if (!rawPatches.length) return false;
    const patches = toPatches(rawPatches);
    const inverse = toPatches(rawInverse);
    const now = Date.now();
    const last = state.past[state.past.length - 1];
    let past: HistoryEntry[];
    if (opts.skipHistory) {
      past = state.past;
    } else if (opts.mergeKey && last?.mergeKey === opts.mergeKey && now - last.at < MERGE_WINDOW_MS) {
      past = [...state.past.slice(0, -1), { ...last, patches: [...last.patches, ...patches], inverse: [...inverse, ...last.inverse], at: now }];
    } else {
      past = [...state.past, { label, patches, inverse, mergeKey: opts.mergeKey, at: now }].slice(-HISTORY_LIMIT);
    }
    // La selección puede apuntar a elementos que ya no existen.
    const selectedIds = state.selectedIds.filter((id) => findElement(next, id));
    const activePageId = next.pages.some((p) => p.id === state.activePageId) ? state.activePageId : next.pages[0].id;
    set({ doc: next, past, future: [], selectedIds, activePageId, saveStatus: 'dirty' });
    emit(patches, 'local');
    return true;
  },

  applyRemote(patches) {
    const s = get();
    const doc = applyPatches(s.doc, toImmer(patches));
    const selectedIds = s.selectedIds.filter((id) => findElement(doc, id));
    const activePageId = doc.pages.some((p) => p.id === s.activePageId) ? s.activePageId : doc.pages[0].id;
    set({ doc, selectedIds, activePageId });
    emit(patches, 'remote');
  },

  replaceDoc(doc, revision) {
    const s = get();
    const activePageId = doc.pages.some((p) => p.id === s.activePageId) ? s.activePageId : doc.pages[0].id;
    set({ doc, revision, activePageId, selectedIds: s.selectedIds.filter((id) => findElement(doc, id)), past: [], future: [] });
  },

  setRevision(revision) {
    set({ revision });
  },

  setSaveStatus(saveStatus) {
    set({ saveStatus });
  },

  // Deshacer aplica los parches inversos y los emite como un cambio nuevo hacia adelante
  // (mismo modelo observado: deshacer viaja al servidor como una operación más).
  undo() {
    const s = get();
    const entry = s.past[s.past.length - 1];
    if (!entry) return;
    const doc = applyPatches(s.doc, toImmer(entry.inverse));
    set({ doc, past: s.past.slice(0, -1), future: [...s.future, entry], selectedIds: restoredSelection(s.doc, doc, s.selectedIds), editingTextId: null, saveStatus: 'dirty', activePageId: doc.pages.some((p) => p.id === s.activePageId) ? s.activePageId : doc.pages[0].id });
    emit(entry.inverse, 'undo');
  },

  redo() {
    const s = get();
    const entry = s.future[s.future.length - 1];
    if (!entry) return;
    const doc = applyPatches(s.doc, toImmer(entry.patches));
    set({ doc, future: s.future.slice(0, -1), past: [...s.past, entry], selectedIds: restoredSelection(s.doc, doc, s.selectedIds), saveStatus: 'dirty', activePageId: doc.pages.some((p) => p.id === s.activePageId) ? s.activePageId : doc.pages[0].id });
    emit(entry.patches, 'redo');
  },

  select(ids, additive = false) {
    const s = get();
    let next = ids;
    if (additive) {
      const current = new Set(s.selectedIds);
      for (const id of ids) {
        if (current.has(id)) current.delete(id);
        else current.add(id);
      }
      next = [...current];
    }
    // La selección siempre pertenece a una sola página: la del primer elemento.
    const first = next[0] ? findElement(s.doc, next[0]) : null;
    const pageId = first?.page.id ?? s.activePageId;
    const page = s.doc.pages.find((p) => p.id === pageId)!;
    next = next.filter((id) => page.elements.some((e) => e.id === id));
    set({ selectedIds: next, activePageId: pageId, editingTextId: s.editingTextId && next.includes(s.editingTextId) ? s.editingTextId : null });
  },

  selectAll() {
    const page = activePage(get());
    set({ selectedIds: page.elements.filter((e) => e.visible && !e.locked).map((e) => e.id) });
  },

  clearSelection() {
    set({ selectedIds: [], editingTextId: null });
  },

  setEditingText(id) {
    set({ editingTextId: id, selectedIds: id ? [id] : get().selectedIds });
  },

  addElement(el, pageId) {
    const target = pageId ?? get().activePageId;
    get().commit('Insertar elemento', (d) => {
      const page = d.pages.find((p) => p.id === target) ?? d.pages[0];
      page.elements.push(el as Draft<DesignElement>);
    });
    set({ selectedIds: [el.id], activePageId: target });
  },

  updateElements(ids, patch, opts = {}) {
    if (!ids.length) return;
    get().commit(
      opts.label ?? 'Editar elemento',
      (d) => {
        for (const id of ids) {
          const found = findElement(d, id);
          if (!found) continue;
          const el = d.pages.find((p) => p.id === found.page.id)!.elements[found.index];
          if (typeof patch === 'function') patch(el);
          else Object.assign(el, patch);
        }
      },
      opts,
    );
  },

  deleteSelected() {
    const ids = new Set(get().selectedIds);
    if (!ids.size) return;
    get().commit('Eliminar', (d) => {
      for (const page of d.pages) page.elements = page.elements.filter((e) => !ids.has(e.id) || e.locked);
    });
  },

  duplicateSelected() {
    const s = get();
    const page = activePage(s);
    const sel = page.elements.filter((e) => s.selectedIds.includes(e.id));
    if (!sel.length) return;
    const copies = sel.map((e) => ({ ...structuredClone(e), id: newId(), x: e.x + 20, y: e.y + 20, locked: false }));
    s.commit('Duplicar', (d) => {
      const p = d.pages.find((x) => x.id === page.id)!;
      p.elements.push(...(copies as Draft<DesignElement>[]));
    });
    set({ selectedIds: copies.map((c) => c.id) });
  },

  copy() {
    const s = get();
    const page = activePage(s);
    set({ clipboard: structuredClone(page.elements.filter((e) => s.selectedIds.includes(e.id))) });
  },

  cut() {
    get().copy();
    get().deleteSelected();
  },

  paste() {
    const s = get();
    if (!s.clipboard.length) return;
    const pasted = s.clipboard.map((e) => ({ ...structuredClone(e), id: newId(), x: e.x + 20, y: e.y + 20 }));
    // Los pegados sucesivos se van corriendo en cascada.
    set({ clipboard: pasted });
    const pageId = s.activePageId;
    s.commit('Pegar', (d) => {
      d.pages.find((p) => p.id === pageId)!.elements.push(...(pasted as Draft<DesignElement>[]));
    });
    set({ selectedIds: pasted.map((p) => p.id) });
  },

  nudge(dx, dy) {
    const s = get();
    const ids = activePage(s).elements.filter((e) => s.selectedIds.includes(e.id) && !e.locked).map((e) => e.id);
    s.updateElements(ids, (el) => {
      el.x += dx;
      el.y += dy;
    }, { label: 'Mover', mergeKey: `nudge:${ids.join(',')}` });
  },

  arrange(kind) {
    const s = get();
    const page = activePage(s);
    const selected = new Set(s.selectedIds);
    if (!selected.size) return;
    s.commit('Organizar', (d) => {
      const p = d.pages.find((x) => x.id === page.id)!;
      const els = p.elements;
      if (kind === 'front' || kind === 'back') {
        const moving = els.filter((e) => selected.has(e.id));
        const rest = els.filter((e) => !selected.has(e.id));
        p.elements = kind === 'front' ? [...rest, ...moving] : [...moving, ...rest];
        return;
      }
      // Un paso: recorrer en el sentido del movimiento para no saltar elementos seleccionados contiguos.
      const order = kind === 'forward' ? [...els.keys()].reverse() : [...els.keys()];
      for (const i of order) {
        const j = kind === 'forward' ? i + 1 : i - 1;
        if (j < 0 || j >= els.length) continue;
        if (selected.has(els[i].id) && !selected.has(els[j].id)) [els[i], els[j]] = [els[j], els[i]];
      }
    });
  },

  moveLayer(pageId, fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    get().commit('Reordenar capas', (d) => {
      const p = d.pages.find((x) => x.id === pageId);
      if (!p || fromIndex < 0 || fromIndex >= p.elements.length) return;
      const [el] = p.elements.splice(fromIndex, 1);
      p.elements.splice(Math.max(0, Math.min(toIndex, p.elements.length)), 0, el);
    });
  },

  // Un elemento se alinea a la página; varios, a la caja que los contiene.
  align(edge) {
    const s = get();
    const page = activePage(s);
    const sel = page.elements.filter((e) => s.selectedIds.includes(e.id) && !e.locked);
    if (!sel.length) return;
    const ref = sel.length === 1 ? { x: 0, y: 0, width: s.doc.width, height: s.doc.height } : unionBounds(sel.map(elementBounds))!;
    s.commit('Alinear', (d) => {
      const p = d.pages.find((x) => x.id === page.id)!;
      for (const el of p.elements) {
        if (!sel.some((x) => x.id === el.id)) continue;
        const { dx, dy } = alignDelta(elementBounds(el), ref, edge);
        el.x += dx;
        el.y += dy;
      }
    });
  },

  toggleLock(ids) {
    const s = get();
    const target = ids ?? s.selectedIds;
    const els = activePage(s).elements.filter((e) => target.includes(e.id));
    if (!els.length) return;
    const lock = !els.every((e) => e.locked);
    s.updateElements(target, { locked: lock }, { label: lock ? 'Bloquear' : 'Desbloquear' });
  },

  toggleVisibility(id) {
    const found = findElement(get().doc, id);
    if (!found) return;
    const el = found.page.elements[found.index];
    get().updateElements([id], { visible: !el.visible }, { label: 'Visibilidad' });
  },

  setActivePage(id) {
    if (get().activePageId !== id) set({ activePageId: id, selectedIds: [], editingTextId: null });
  },

  addPage(afterId) {
    const page = createPage();
    const s = get();
    s.commit('Agregar página', (d) => {
      const idx = afterId ? d.pages.findIndex((p) => p.id === afterId) : d.pages.length - 1;
      d.pages.splice(idx + 1, 0, page);
    });
    set({ activePageId: page.id, selectedIds: [] });
  },

  duplicatePage(id) {
    const s = get();
    const src = s.doc.pages.find((p) => p.id === id);
    if (!src) return;
    const copy: Page = { ...structuredClone(src), id: newId('p'), elements: src.elements.map((e) => ({ ...structuredClone(e), id: newId() })) };
    s.commit('Duplicar página', (d) => {
      d.pages.splice(d.pages.findIndex((p) => p.id === id) + 1, 0, copy);
    });
    set({ activePageId: copy.id, selectedIds: [] });
  },

  deletePage(id) {
    const s = get();
    if (s.doc.pages.length <= 1) return;
    const idx = s.doc.pages.findIndex((p) => p.id === id);
    s.commit('Eliminar página', (d) => {
      d.pages.splice(idx, 1);
    });
    const pages = get().doc.pages;
    set({ activePageId: pages[Math.min(idx, pages.length - 1)].id, selectedIds: [] });
  },

  movePage(id, dir) {
    get().commit('Mover página', (d) => {
      const i = d.pages.findIndex((p) => p.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.pages.length) return;
      [d.pages[i], d.pages[j]] = [d.pages[j], d.pages[i]];
    });
  },

  renamePage(id, title) {
    get().commit('Renombrar página', (d) => {
      const p = d.pages.find((x) => x.id === id);
      if (p) p.title = title;
    }, { mergeKey: `rename:${id}` });
  },

  setPageBackground(id, color) {
    get().commit('Fondo', (d) => {
      const p = d.pages.find((x) => x.id === id);
      if (p) p.background = color;
    }, { mergeKey: `bg:${id}` });
  },

  setTitle(title) {
    get().commit('Título', (d) => {
      d.title = title.trim() || DEFAULT_TITLE;
    }, { mergeKey: 'title' });
  },

  resizeDesign(width, height, scaleContent) {
    const s = get();
    const sx = width / s.doc.width;
    const sy = height / s.doc.height;
    s.commit('Redimensionar', (d) => {
      d.width = width;
      d.height = height;
      if (!scaleContent) return;
      // Escala uniforme (la menor) y recentrado, para no deformar el contenido.
      const k = Math.min(sx, sy);
      const offX = (width - s.doc.width * k) / 2;
      const offY = (height - s.doc.height * k) / 2;
      for (const p of d.pages) for (const el of p.elements) scaleElement(el as DesignElement, k, offX, offY);
    });
  },

  applyTemplate(template) {
    const s = get();
    const k = Math.min(s.doc.width / template.width, s.doc.height / template.height);
    const offX = (s.doc.width - template.width * k) / 2;
    const offY = (s.doc.height - template.height * k) / 2;
    const pages = structuredClone(template.pages);
    if (Math.abs(k - 1) > 1e-6 || offX || offY) for (const p of pages) for (const el of p.elements) scaleElement(el, k, offX, offY);
    s.commit('Aplicar plantilla', (d) => {
      const idx = Math.max(0, d.pages.findIndex((p) => p.id === s.activePageId));
      // Una página vacía se reemplaza; si tiene contenido, la plantilla se agrega después.
      if (d.pages[idx].elements.length === 0) d.pages.splice(idx, 1, ...(pages as Draft<Page>[]));
      else d.pages.splice(idx + 1, 0, ...(pages as Draft<Page>[]));
      if (d.title === DEFAULT_TITLE) d.title = template.title;
    });
    set({ activePageId: pages[0].id, selectedIds: [], editingTextId: null });
  },

  setZoom(zoom) {
    set({ zoom: Math.max(0.1, Math.min(4, zoom)) });
  },
}));

/** Escala uniforme de un elemento (posición, tamaño y medidas internas como la tipografía). */
function scaleElement(el: DesignElement | Draft<DesignElement>, k: number, offX: number, offY: number) {
  el.x = el.x * k + offX;
  el.y = el.y * k + offY;
  el.width *= k;
  el.height *= k;
  if (el.type === 'text' || el.type === 'table') el.fontSize *= k;
  if (el.type === 'text') el.letterSpacing *= k;
  if (el.type === 'grid') el.gap *= k;
  if (el.type === 'shape') el.strokeWidth *= k;
  if ('cornerRadius' in el) el.cornerRadius *= k;
}

export function getActivePage(): Page {
  return activePage(useEditor.getState());
}

export function getSelectedElements(): DesignElement[] {
  const s = useEditor.getState();
  return activePage(s).elements.filter((e) => s.selectedIds.includes(e.id));
}

// En desarrollo el store queda accesible desde la consola y las pruebas E2E.
if (import.meta.env?.DEV) (globalThis as { __trazoEditor?: typeof useEditor }).__trazoEditor = useEditor;
