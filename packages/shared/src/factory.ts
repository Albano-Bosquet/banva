import type { ChartElement, ChartType, DesignDoc, FormElement, FormField, FrameDecoration, FrameElement, GraphicElement, GridElement, ImageElement, Page, ShapeElement, ShapeKind, SolidElement, SolidKind, TableElement, TextElement, VideoElement } from './schema';

let counter = 0;
/** Id corto, único dentro de la sesión y con baja probabilidad de colisión entre clientes. */
export function newId(prefix = 'e'): string {
  counter = (counter + 1) % 1_000_000;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rand}`;
}

export function createPage(partial: Partial<Page> = {}): Page {
  return { id: newId('p'), title: '', background: '#ffffff', elements: [], ...partial };
}

export function createDoc(width: number, height: number, title = 'Diseño sin título'): DesignDoc {
  return { title, width, height, pages: [createPage()] };
}

/** Las inserciones se centran en la página con un lado del 30 % del lado menor (comportamiento observado). */
function centeredBox(doc: Pick<DesignDoc, 'width' | 'height'>, w: number, h: number) {
  return { x: (doc.width - w) / 2, y: (doc.height - h) / 2, width: w, height: h };
}

export type TextPreset = 'heading' | 'subheading' | 'body';

const TEXT_PRESETS: Record<TextPreset, { text: string; ratio: number; fontStyle: TextElement['fontStyle'] }> = {
  heading: { text: 'Agregá un título', ratio: 0.075, fontStyle: 'bold' },
  subheading: { text: 'Agregá un subtítulo', ratio: 0.045, fontStyle: 'bold' },
  body: { text: 'Texto del párrafo', ratio: 0.03, fontStyle: 'normal' },
};

export function createText(doc: Pick<DesignDoc, 'width' | 'height'>, preset: TextPreset = 'body', overrides: Partial<TextElement> = {}): TextElement {
  const p = TEXT_PRESETS[preset];
  const fontSize = Math.max(8, Math.round(Math.min(doc.width, doc.height) * p.ratio));
  const width = Math.min(doc.width * 0.8, Math.max(fontSize * p.text.length * 0.6, fontSize * 4));
  const height = fontSize * 1.4;
  return {
    id: newId(),
    type: 'text',
    ...centeredBox(doc, width, height),
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    text: p.text,
    fontFamily: 'Inter',
    fontSize,
    fontStyle: p.fontStyle,
    textDecoration: '',
    fill: '#1f2430',
    align: 'center',
    lineHeight: 1.4,
    letterSpacing: 0,
    ...overrides,
  };
}

export function createShape(doc: Pick<DesignDoc, 'width' | 'height'>, shape: ShapeKind, overrides: Partial<ShapeElement> = {}): ShapeElement {
  const side = Math.round(Math.min(doc.width, doc.height) * 0.3);
  const isLine = shape === 'line';
  const thickness = Math.max(4, Math.round(side * 0.03));
  // Las líneas con flecha necesitan alto para la punta: el trazo es 1/5 de la caja.
  const h = isLine ? (overrides.arrow && overrides.arrow !== 'none' ? thickness * 5 : thickness) : side;
  return {
    id: newId(),
    type: 'shape',
    shape,
    ...centeredBox(doc, side, h),
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    fill: isLine ? '#1f2430' : '#2bb3a3',
    stroke: '#1f2430',
    strokeWidth: 0,
    cornerRadius: 0,
    ...overrides,
  };
}

/** Escala la imagen para que entre en el 50 % de la página conservando la proporción. */
export function createImage(doc: Pick<DesignDoc, 'width' | 'height'>, src: string, naturalWidth: number, naturalHeight: number, overrides: Partial<ImageElement> = {}): ImageElement {
  const maxW = doc.width * 0.5;
  const maxH = doc.height * 0.5;
  const scale = Math.min(maxW / naturalWidth, maxH / naturalHeight, 1);
  const w = Math.max(1, Math.round(naturalWidth * scale));
  const h = Math.max(1, Math.round(naturalHeight * scale));
  return {
    id: newId(),
    type: 'image',
    src,
    ...centeredBox(doc, w, h),
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    cornerRadius: 0,
    ...overrides,
  };
}

/** Título derivado del primer texto (bloques, notas, celdas o textos), como el comportamiento observado. */
export function deriveTitle(doc: DesignDoc): string | null {
  const clean = (t: string) => t.trim().split('\n')[0].slice(0, 60) || null;
  for (const b of doc.blocks ?? []) {
    const t = b.html ? clean(b.html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')) : null;
    if (t) return t;
  }
  if (doc.sheet) {
    const keys = Object.keys(doc.sheet.cells).sort(refOrder);
    for (const k of keys) {
      const v = doc.sheet.cells[k];
      if (v && !v.startsWith('=')) return clean(v);
    }
  }
  for (const page of doc.pages) {
    for (const el of page.elements) {
      if ((el.type === 'text' || el.type === 'sticky') && el.text.trim()) return clean(el.text);
    }
  }
  return null;
}

/** Orden de lectura de referencias: fila y después columna ("A1" < "B1" < "A2"). */
function refOrder(a: string, b: string): number {
  const p = (r: string) => {
    const m = /^([A-Z]+)(\d+)$/.exec(r);
    return m ? [parseInt(m[2], 10), m[1].length, m[1]] as const : [0, 0, r] as const;
  };
  const [ra, la, ca] = p(a);
  const [rb, lb, cb] = p(b);
  return ra - rb || la - lb || String(ca).localeCompare(String(cb));
}

// ---------------------------------------------------------------------------
// Elementos del panel "Elementos"

type Box = Pick<DesignDoc, 'width' | 'height'>;

function baseProps(doc: Box, w: number, h: number) {
  return { id: newId(), ...centeredBox(doc, w, h), rotation: 0, opacity: 1, locked: false, visible: true };
}

/** Lado de referencia para inserciones: 30 % del lado menor de la página. */
const side = (doc: Box, ratio = 0.3) => Math.round(Math.min(doc.width, doc.height) * ratio);

export function createGraphic(doc: Box, svg: string, colors: string[], aspect = 1, overrides: Partial<GraphicElement> = {}): GraphicElement {
  const s = side(doc);
  const w = aspect >= 1 ? s : Math.round(s * aspect);
  const h = aspect >= 1 ? Math.round(s / aspect) : s;
  return { ...baseProps(doc, w, h), type: 'graphic', svg, colors: [...colors], ...overrides };
}

export const CHART_COLORS = ['#5b6cff', '#ff6b4a', '#2bb3a3', '#ffc145', '#e84a8a', '#8a93a6'];

export function createChart(doc: Box, chartType: ChartType, overrides: Partial<ChartElement> = {}): ChartElement {
  const s = side(doc, 0.5);
  const multi = chartType === 'stacked' || chartType === 'line' || chartType === 'area';
  const round = chartType === 'pie' || chartType === 'donut';
  return {
    ...baseProps(doc, s, Math.round(s * (round ? 1 : 0.75))),
    type: 'chart',
    chartType,
    labels: ['Ene', 'Feb', 'Mar', 'Abr'],
    series: multi
      ? [
          { name: 'Serie 1', color: CHART_COLORS[0], values: [12, 19, 15, 24] },
          { name: 'Serie 2', color: CHART_COLORS[1], values: [8, 11, 17, 13] },
        ]
      : [{ name: 'Ventas', color: CHART_COLORS[0], values: [12, 19, 15, 24] }],
    title: '',
    showLegend: multi || round,
    showValues: false,
    showGrid: true,
    fontFamily: 'Inter',
    textColor: '#4a5263',
    ...overrides,
  };
}

export type TableStyle = 'plain' | 'header' | 'banded';

export function createTable(doc: Box, rows: number, cols: number, style: TableStyle = 'header', accent = '#5b6cff', overrides: Partial<TableElement> = {}): TableElement {
  const w = Math.round(Math.min(doc.width * 0.7, cols * side(doc, 0.18)));
  const fontSize = Math.max(10, Math.round(Math.min(doc.width, doc.height) * 0.022));
  const h = Math.round(rows * fontSize * 2.4);
  return {
    ...baseProps(doc, w, h),
    type: 'table',
    cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => '')),
    colWidths: Array.from({ length: cols }, () => 1 / cols),
    headerRow: style !== 'plain',
    banded: style === 'banded',
    accent,
    bandFill: tint(accent, 0.82),
    borderColor: style === 'banded' ? '#ffffff' : accent,
    borderWidth: style === 'banded' ? 2 : 1.5,
    fontFamily: 'Inter',
    fontSize,
    textColor: '#1f2430',
    align: 'left',
    ...overrides,
  };
}

/** Mezcla un color #rrggbb con blanco (amount 0..1). */
export function tint(hex: string, amount: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) + (255 - ((n >> shift) & 255)) * amount);
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
}

/** Proporción ancho/alto por decoración (dispositivos y mockups tienen la suya). */
export const DECORATION_ASPECT: Record<FrameDecoration, number> = {
  none: 1,
  polaroid: 0.84,
  film: 1.5,
  phone: 0.5,
  tablet: 0.75,
  laptop: 1.55,
  monitor: 1.3,
  tshirt: 0.95,
  mug: 1.25,
  poster: 0.75,
};

export function createFrame(doc: Box, mask: string, decoration: FrameDecoration = 'none', overrides: Partial<FrameElement> = {}): FrameElement {
  const aspect = decoration === 'none' && mask === 'arch' ? 0.75 : DECORATION_ASPECT[decoration];
  const s = side(doc, decoration === 'none' ? 0.4 : 0.5);
  const w = aspect >= 1 ? s : Math.round(s * aspect);
  const h = aspect >= 1 ? Math.round(s / aspect) : s;
  return {
    ...baseProps(doc, w, h),
    type: 'frame',
    mask,
    decoration,
    tint: decoration === 'tshirt' || decoration === 'mug' ? '#f4f4f6' : '#1f2430',
    cornerRadius: 0,
    src: null,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    ...overrides,
  };
}

type Cell = [number, number, number, number];
const t3 = 1 / 3;

/** Distribuciones de cuadrícula en fracciones [x, y, w, h]. */
export const GRID_LAYOUTS: { id: string; cells: Cell[] }[] = [
  { id: '1', cells: [[0, 0, 1, 1]] },
  { id: '2v', cells: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]] },
  { id: '2h', cells: [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]] },
  { id: '3v', cells: [[0, 0, t3, 1], [t3, 0, t3, 1], [2 * t3, 0, t3, 1]] },
  { id: '3h', cells: [[0, 0, 1, t3], [0, t3, 1, t3], [0, 2 * t3, 1, t3]] },
  { id: '1+2', cells: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },
  { id: '2+1', cells: [[0, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0, 0.5, 1]] },
  { id: 'top+2', cells: [[0, 0, 1, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },
  { id: '2x2', cells: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },
  { id: '1+3', cells: [[0, 0, 1, 0.6], [0, 0.6, t3, 0.4], [t3, 0.6, t3, 0.4], [2 * t3, 0.6, t3, 0.4]] },
  { id: 'big+3', cells: [[0, 0, 2 * t3, 1], [2 * t3, 0, t3, t3], [2 * t3, t3, t3, t3], [2 * t3, 2 * t3, t3, t3]] },
  { id: '3x2', cells: [0, 1, 2].flatMap((c) => [0, 1].map((r): Cell => [c * t3, r / 2, t3, 0.5])) },
  { id: '2x3', cells: [0, 1].flatMap((c) => [0, 1, 2].map((r): Cell => [c / 2, r * t3, 0.5, t3])) },
  { id: 'mosaic', cells: [[0, 0, 0.6, 0.5], [0.6, 0, 0.4, 0.5], [0, 0.5, 0.4, 0.5], [0.4, 0.5, 0.6, 0.5]] },
  { id: '3x3', cells: [0, 1, 2].flatMap((r) => [0, 1, 2].map((c): Cell => [c * t3, r * t3, t3, t3])) },
];

/** Las cuadrículas ocupan la página completa (comportamiento observado). */
export function createGrid(doc: Box, layoutId: string, overrides: Partial<GridElement> = {}): GridElement {
  const layout = GRID_LAYOUTS.find((l) => l.id === layoutId) ?? GRID_LAYOUTS[0];
  return {
    id: newId(),
    x: 0,
    y: 0,
    width: doc.width,
    height: doc.height,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    type: 'grid',
    cells: layout.cells.map(([x, y, w, h]) => ({ x, y, w, h, src: null, zoom: 1, offsetX: 0, offsetY: 0 })),
    gap: Math.round(Math.min(doc.width, doc.height) * 0.01),
    cornerRadius: 0,
    ...overrides,
  };
}

export function createSolid(doc: Box, solid: SolidKind, color = '#5b6cff', overrides: Partial<SolidElement> = {}): SolidElement {
  const s = side(doc);
  return { ...baseProps(doc, s, s), type: 'solid', solid, color, yaw: 35, pitch: 25, ...overrides };
}

export function createVideo(doc: Box, src: string, naturalWidth: number, naturalHeight: number, overrides: Partial<VideoElement> = {}): VideoElement {
  const scale = Math.min((doc.width * 0.6) / naturalWidth, (doc.height * 0.6) / naturalHeight);
  const w = Math.max(16, Math.round(naturalWidth * scale));
  const h = Math.max(16, Math.round(naturalHeight * scale));
  return { ...baseProps(doc, w, h), type: 'video', src, muted: true, loop: true, cornerRadius: 0, ...overrides };
}

export type FormPreset = 'newsletter' | 'contact' | 'rsvp' | 'rating' | 'quiz';

type FormContent = Pick<FormElement, 'title' | 'fields' | 'submitLabel' | 'accent' | 'background' | 'textColor'>;

export const FORM_PRESETS: Record<FormPreset, FormContent & { label: string }> = {
  newsletter: {
    label: 'Boletín',
    title: 'Sumate al boletín',
    fields: [{ id: 'email', label: 'Tu correo', kind: 'email', required: true }],
    submitLabel: 'Suscribirme',
    accent: '#5b6cff',
    background: '#f1f2ff',
    textColor: '#1f2430',
  },
  contact: {
    label: 'Contacto',
    title: 'Escribinos',
    fields: [
      { id: 'name', label: 'Nombre', kind: 'text', required: true },
      { id: 'email', label: 'Correo', kind: 'email', required: true },
      { id: 'msg', label: 'Mensaje', kind: 'textarea' },
    ],
    submitLabel: 'Enviar',
    accent: '#2bb3a3',
    background: '#13302c',
    textColor: '#ffffff',
  },
  rsvp: {
    label: 'Confirmación',
    title: 'Confirmá tu asistencia',
    fields: [
      { id: 'name', label: 'Tu nombre', kind: 'text', required: true },
      { id: 'going', label: '¿Venís?', kind: 'choice', options: ['Sí, ahí estaré', 'No puedo'] },
    ],
    submitLabel: 'Confirmar',
    accent: '#ff6b4a',
    background: '#fff4ef',
    textColor: '#1f2430',
  },
  rating: {
    label: 'Valoración',
    title: '¿Qué te pareció?',
    fields: [
      { id: 'stars', label: 'Puntaje', kind: 'rating' },
      { id: 'comment', label: 'Comentario', kind: 'textarea' },
    ],
    submitLabel: 'Enviar opinión',
    accent: '#ffc145',
    background: '#1f2430',
    textColor: '#ffffff',
  },
  quiz: {
    label: 'Pregunta',
    title: '¿Cuál es el planeta más grande?',
    fields: [{ id: 'answer', label: 'Elegí una opción', kind: 'choice', options: ['Marte', 'Júpiter', 'Venus'] }],
    submitLabel: 'Responder',
    accent: '#e84a8a',
    background: '#fff0f6',
    textColor: '#1f2430',
  },
};

/** Alto de cada tipo de campo en unidades de la grilla del formulario (ancho / 18). */
export function formFieldUnits(f: FormField): number {
  if (f.kind === 'textarea') return 4.4;
  if (f.kind === 'rating') return 3;
  if (f.kind === 'choice') return 1.6 + (f.options?.length ?? 0) * 1.7;
  return 3;
}

/** Alto total del formulario en unidades: título + campos + botón. */
export function formUnits(fields: FormField[]): number {
  return 3.4 + fields.reduce((s, f) => s + formFieldUnits(f), 0) + 3.4;
}

export function createForm(doc: Box, preset: FormPreset, overrides: Partial<FormElement> = {}): FormElement {
  const { label: _label, ...p } = FORM_PRESETS[preset];
  const w = side(doc, 0.55);
  const content = structuredClone(p);
  return {
    ...baseProps(doc, w, Math.round(formUnits(content.fields) * (w / 18))),
    type: 'form',
    ...content,
    fontFamily: 'Inter',
    ...overrides,
  };
}
