import { createDoc, createPage, newId } from './factory';
import type { Block, BlockType, DesignDoc, DesignKind, Sheet } from './schema';

/** Tamaño de página por tipo de diseño (Doc usa A4 a 96 ppp; Correo, 600 px como los clientes de correo). */
export const KIND_SIZE: Record<Exclude<DesignKind, 'design'>, { width: number; height: number }> = {
  doc: { width: 794, height: 1123 },
  email: { width: 600, height: 900 },
  sheet: { width: 1920, height: 1080 },
  whiteboard: { width: 3200, height: 2000 },
  website: { width: 1366, height: 768 },
  video: { width: 1920, height: 1080 },
};

export const KIND_LABEL: Record<DesignKind, string> = {
  design: 'Diseño',
  doc: 'Doc',
  email: 'Correo',
  sheet: 'Hoja de cálculo',
  whiteboard: 'Pizarra',
  website: 'Sitio web',
  video: 'Video',
};

export function createBlock(type: BlockType = 'p', extra: Partial<Block> = {}): Block {
  const b: Block = { id: newId('b'), type, ...extra };
  if (type === 'table' && !b.rows) b.rows = [['', '', ''], ['', '', ''], ['', '', '']];
  if (['p', 'h1', 'h2', 'h3', 'bullet', 'number', 'check', 'quote', 'callout', 'button'].includes(type) && b.html === undefined) b.html = '';
  if (type === 'button') b.url ??= 'https://';
  if (type === 'callout') b.color ??= '#fff4d6';
  if (type === 'columns') b.cols ??= ['', ''];
  if (type === 'chart')
    b.chart ??= { chartType: 'bar', labels: ['A', 'B', 'C'], values: [3, 5, 2], color: '#5b6cff' };
  return b;
}

export function createSheet(rows = 100, cols = 26): Sheet {
  return { rows, cols, cells: {}, styles: {}, colWidths: {}, frozenRows: 0 };
}

/** Documento nuevo de un tipo dado, con el contenido inicial que muestra el editor observado. */
export function createDocOfKind(kind: DesignKind, width?: number, height?: number, title = 'Diseño sin título'): DesignDoc {
  if (kind === 'design') return createDoc(width ?? 1080, height ?? 1080, title);
  const size = KIND_SIZE[kind];
  const doc = createDoc(width ?? size.width, height ?? size.height, title);
  doc.kind = kind;
  if (kind === 'doc' || kind === 'email') doc.blocks = [createBlock('h1'), createBlock('p')];
  if (kind === 'sheet') doc.sheet = createSheet();
  if (kind === 'video') doc.pages = [createPage({ duration: 5 })];
  if (kind === 'whiteboard') doc.pages = [createPage({ background: '#ffffff' })];
  return doc;
}

/** Texto plano de un html de bloque (para títulos, esquema y búsqueda). */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
