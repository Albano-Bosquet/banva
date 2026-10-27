import { create } from 'zustand';
import { createBlock, type Block, type BlockType } from '@trazo/shared';
import { useEditor } from '../store/editorStore';

/** Pedido de foco para el próximo render (al crear, dividir o borrar bloques). */
export const useDocFocus = create<{ id: string | null; at: 'start' | 'end'; seq: number; request(id: string, at?: 'start' | 'end'): void }>((set, get) => ({
  id: null,
  at: 'end',
  seq: 0,
  request: (id, at = 'end') => set({ id, at, seq: get().seq + 1 }),
}));

const blocksOf = () => useEditor.getState().doc.blocks ?? [];

export function updateBlock(id: string, patch: Partial<Block>, opts: { label?: string; mergeKey?: string } = {}) {
  useEditor.getState().commit(opts.label ?? 'Editar bloque', (d) => {
    const b = d.blocks?.find((x) => x.id === id);
    if (b) Object.assign(b, patch);
  }, { mergeKey: opts.mergeKey });
}

export function insertBlockAfter(afterId: string | null, block: Block, focus = true): Block {
  useEditor.getState().commit('Agregar bloque', (d) => {
    d.blocks ??= [];
    const i = afterId ? d.blocks.findIndex((b) => b.id === afterId) : d.blocks.length - 1;
    d.blocks.splice(i + 1, 0, block);
  });
  if (focus) useDocFocus.getState().request(block.id, 'start');
  return block;
}

export function removeBlock(id: string, focusPrev = true) {
  const list = blocksOf();
  const i = list.findIndex((b) => b.id === id);
  if (i < 0) return;
  useEditor.getState().commit('Eliminar bloque', (d) => {
    d.blocks = (d.blocks ?? []).filter((b) => b.id !== id);
    // Un documento nunca queda vacío: siempre hay un párrafo donde escribir.
    if (!d.blocks.length) d.blocks.push(createBlock('p'));
  });
  const after = blocksOf();
  if (focusPrev) useDocFocus.getState().request(after[Math.max(0, i - 1)].id, 'end');
}

export function moveBlock(id: string, toIndex: number) {
  useEditor.getState().commit('Mover bloque', (d) => {
    const list = d.blocks ?? [];
    const from = list.findIndex((b) => b.id === id);
    if (from < 0) return;
    const [b] = list.splice(from, 1);
    list.splice(Math.max(0, Math.min(list.length, toIndex > from ? toIndex - 1 : toIndex)), 0, b);
  });
}

/** Cambia el tipo de un bloque de texto conservando su contenido. */
export function setBlockType(id: string, type: BlockType) {
  const b = blocksOf().find((x) => x.id === id);
  if (!b) return;
  const textual = ['p', 'h1', 'h2', 'h3', 'bullet', 'number', 'check', 'quote', 'callout'];
  if (textual.includes(b.type) && textual.includes(type)) {
    updateBlock(id, { type, ...(type === 'callout' && !b.color ? { color: '#fff4d6' } : {}) }, { label: 'Cambiar estilo' });
    useDocFocus.getState().request(id, 'end');
    return;
  }
  // Tipos estructurales: si el bloque está vacío se reemplaza; si no, se inserta debajo.
  const fresh = createBlock(type);
  const empty = textual.includes(b.type) && !(b.html ?? '').replace(/<br>/g, '').trim();
  if (empty) {
    useEditor.getState().commit('Insertar bloque', (d) => {
      const i = (d.blocks ?? []).findIndex((x) => x.id === id);
      if (i >= 0) d.blocks!.splice(i, 1, { ...fresh, id });
    });
    if (type === 'divider' || type === 'pagebreak') insertBlockAfter(id, createBlock('p'));
  } else {
    insertBlockAfter(id, fresh, false);
    if (type === 'divider' || type === 'pagebreak') insertBlockAfter(fresh.id, createBlock('p'));
  }
}

/** Une el bloque con el anterior (Retroceso al inicio). */
export function mergeWithPrevious(id: string) {
  const list = blocksOf();
  const i = list.findIndex((b) => b.id === id);
  const prev = list[i - 1];
  const cur = list[i];
  if (!prev || !cur) return;
  if (prev.html === undefined) return removeBlock(prev.id, false);
  const joined = (prev.html ?? '') + (cur.html ?? '');
  useEditor.getState().commit('Unir bloques', (d) => {
    const p = d.blocks!.find((b) => b.id === prev.id)!;
    p.html = joined;
    d.blocks = d.blocks!.filter((b) => b.id !== id);
  });
  useDocFocus.getState().request(prev.id, 'end');
}

const LIST_TYPES: BlockType[] = ['bullet', 'number', 'check'];

/** Enter: divide el bloque en el cursor. Las listas siguen siendo listas; los títulos dan paso a párrafos. */
export function splitBlock(id: string, before: string, after: string) {
  const b = blocksOf().find((x) => x.id === id);
  if (!b) return;
  // Enter en un ítem de lista vacío lo convierte en párrafo (salir de la lista).
  if (LIST_TYPES.includes(b.type) && !before.trim() && !after.trim()) {
    updateBlock(id, { type: 'p', html: '' }, { label: 'Salir de la lista' });
    useDocFocus.getState().request(id, 'start');
    return;
  }
  const nextType: BlockType = LIST_TYPES.includes(b.type) ? b.type : 'p';
  const next = createBlock(nextType, { html: after });
  useEditor.getState().commit('Nuevo párrafo', (d) => {
    const list = d.blocks!;
    const i = list.findIndex((x) => x.id === id);
    list[i].html = before;
    list.splice(i + 1, 0, next);
  });
  useDocFocus.getState().request(next.id, 'start');
}

/** Atajos tipo Markdown al comienzo de un párrafo. */
export const MARKDOWN: [RegExp, BlockType][] = [
  [/^#\s$/, 'h1'],
  [/^##\s$/, 'h2'],
  [/^###\s$/, 'h3'],
  [/^[-*]\s$/, 'bullet'],
  [/^1[.)]\s$/, 'number'],
  [/^\[\s?\]\s$/, 'check'],
  [/^>\s$/, 'quote'],
  [/^---$/, 'divider'],
];
