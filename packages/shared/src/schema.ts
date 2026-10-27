import { z } from 'zod';

/**
 * Modelo de documento. Todas las medidas están en píxeles de diseño
 * (independientes del zoom), igual que el modelo observado en el análisis.
 */

const base = {
  id: z.string().min(1),
  name: z.string().optional(),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number(),
  opacity: z.number().min(0).max(1),
  locked: z.boolean(),
  visible: z.boolean(),
  /** Animación: de entrada (fade, rise, pop, slide) o en bucle (pulse, spin, bounce, wiggle). */
  animation: z.enum(['none', 'fade', 'rise', 'pop', 'slide', 'pulse', 'spin', 'bounce', 'wiggle']).optional(),
};

export const textElementSchema = z.object({
  ...base,
  type: z.literal('text'),
  text: z.string(),
  fontFamily: z.string(),
  fontSize: z.number().positive(),
  fontStyle: z.enum(['normal', 'bold', 'italic', 'bold italic']),
  textDecoration: z.enum(['', 'underline']),
  fill: z.string(),
  align: z.enum(['left', 'center', 'right']),
  lineHeight: z.number().positive(),
  letterSpacing: z.number(),
});

/** Clave de la biblioteca de formas (rect, ellipse, line, triangle, star, hexagon, arrow-right, heart…). */
export const shapeKindSchema = z.string().min(1);

export const shapeElementSchema = z.object({
  ...base,
  type: z.literal('shape'),
  shape: shapeKindSchema,
  fill: z.string(),
  stroke: z.string(),
  strokeWidth: z.number().min(0),
  cornerRadius: z.number().min(0),
  /** Solo líneas: trazo y punta de flecha. */
  dash: z.enum(['solid', 'dashed', 'dotted']).optional(),
  arrow: z.enum(['none', 'end', 'both']).optional(),
});

export const imageElementSchema = z.object({
  ...base,
  type: z.literal('image'),
  src: z.string().min(1),
  cornerRadius: z.number().min(0),
  /** Atribución de imágenes con licencia abierta (p. ej. Openverse). */
  credit: z.string().optional(),
  /** Ajustes del editor de fotos (0 = sin cambio). */
  filters: z
    .object({
      brightness: z.number().min(-1).max(1),
      contrast: z.number().min(-100).max(100),
      saturation: z.number().min(-2).max(10),
      blur: z.number().min(0).max(40),
      grayscale: z.boolean(),
      sepia: z.boolean(),
      invert: z.boolean(),
      flipX: z.boolean(),
      flipY: z.boolean(),
    })
    .partial()
    .optional(),
});

/** Nota adhesiva de la pizarra. */
export const stickyElementSchema = z.object({
  ...base,
  type: z.literal('sticky'),
  text: z.string(),
  color: z.string(),
  author: z.string().optional(),
  fontSize: z.number().positive(),
});

/** Trazo a mano alzada (puntos relativos a x, y). */
export const drawElementSchema = z.object({
  ...base,
  type: z.literal('draw'),
  points: z.array(z.number()),
  stroke: z.string(),
  strokeWidth: z.number().positive(),
});

/** Ilustración SVG con colores editables: el SVG lleva marcadores {{0}}, {{1}}… */
export const graphicElementSchema = z.object({
  ...base,
  type: z.literal('graphic'),
  svg: z.string().min(1),
  colors: z.array(z.string()),
});

export const chartTypeSchema = z.enum(['bar', 'hbar', 'stacked', 'line', 'area', 'pie', 'donut']);
export const chartElementSchema = z.object({
  ...base,
  type: z.literal('chart'),
  chartType: chartTypeSchema,
  labels: z.array(z.string()),
  series: z.array(z.object({ name: z.string(), color: z.string(), values: z.array(z.number()) })).min(1),
  title: z.string(),
  showLegend: z.boolean(),
  showValues: z.boolean(),
  showGrid: z.boolean(),
  fontFamily: z.string(),
  textColor: z.string(),
});

/** Tabla / hoja de cálculo: las celdas que empiezan con "=" son fórmulas. */
export const tableElementSchema = z.object({
  ...base,
  type: z.literal('table'),
  cells: z.array(z.array(z.string())).min(1),
  colWidths: z.array(z.number().positive()),
  headerRow: z.boolean(),
  banded: z.boolean(),
  accent: z.string(),
  bandFill: z.string(),
  borderColor: z.string(),
  borderWidth: z.number().min(0),
  fontFamily: z.string(),
  fontSize: z.number().positive(),
  textColor: z.string(),
  align: z.enum(['left', 'center', 'right']),
});

const imageFill = {
  src: z.string().nullable(),
  /** >= 1: cuánto se amplía la imagen por encima de "cubrir". */
  zoom: z.number().min(1),
  /** Desplazamiento del recorte, de -1 a 1 en cada eje. */
  offsetX: z.number().min(-1).max(1),
  offsetY: z.number().min(-1).max(1),
};

export const frameDecorationSchema = z.enum(['none', 'polaroid', 'film', 'phone', 'tablet', 'laptop', 'monitor', 'tshirt', 'mug', 'poster']);
/** Marco: una máscara con forma (o un dispositivo/mockup) que se rellena con una imagen. */
export const frameElementSchema = z.object({
  ...base,
  type: z.literal('frame'),
  mask: z.string().min(1),
  decoration: frameDecorationSchema,
  /** Color del objeto en mockups (remera, taza) o del cuerpo del dispositivo. */
  tint: z.string(),
  cornerRadius: z.number().min(0),
  ...imageFill,
});

/** Cuadrícula: celdas en fracciones de la caja, cada una con su imagen. */
export const gridCellSchema = z.object({ x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive(), ...imageFill });
export const gridElementSchema = z.object({
  ...base,
  type: z.literal('grid'),
  cells: z.array(gridCellSchema).min(1),
  gap: z.number().min(0),
  cornerRadius: z.number().min(0),
});

export const solidKindSchema = z.enum(['cube', 'pyramid', 'prism', 'cylinder', 'cone', 'sphere', 'torus', 'gem']);
/** Objeto 3D dibujado con proyección y sombreado plano. */
export const solidElementSchema = z.object({
  ...base,
  type: z.literal('solid'),
  solid: solidKindSchema,
  color: z.string(),
  yaw: z.number(),
  pitch: z.number(),
});

export const videoElementSchema = z.object({
  ...base,
  type: z.literal('video'),
  src: z.string().min(1),
  muted: z.boolean(),
  loop: z.boolean(),
  cornerRadius: z.number().min(0),
});

export const formFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  kind: z.enum(['text', 'email', 'textarea', 'rating', 'choice']),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
});
/** Formulario: se dibuja en el lienzo y es interactivo en el modo de presentación. */
export const formElementSchema = z.object({
  ...base,
  type: z.literal('form'),
  title: z.string(),
  fields: z.array(formFieldSchema),
  submitLabel: z.string(),
  accent: z.string(),
  background: z.string(),
  textColor: z.string(),
  fontFamily: z.string(),
});

export const elementSchema = z.discriminatedUnion('type', [
  textElementSchema,
  shapeElementSchema,
  imageElementSchema,
  graphicElementSchema,
  chartElementSchema,
  tableElementSchema,
  frameElementSchema,
  gridElementSchema,
  solidElementSchema,
  videoElementSchema,
  formElementSchema,
  stickyElementSchema,
  drawElementSchema,
]);

/** Pista de audio del diseño (no es un elemento visual, como en el editor observado). */
export const audioTrackSchema = z.object({
  id: z.string().min(1),
  src: z.string().min(1),
  title: z.string(),
  credit: z.string().optional(),
  volume: z.number().min(0).max(1),
});

export const pageSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  background: z.string(),
  elements: z.array(elementSchema),
  /** Video: duración de la escena en segundos. */
  duration: z.number().positive().optional(),
});

/** Tipos de diseño (como los accesos del Inicio observado). */
export const designKindSchema = z.enum(['design', 'doc', 'email', 'sheet', 'whiteboard', 'website', 'video']);

/** Bloques de documentos y correos. `html` lleva el texto con formato en línea (saneado). */
export const blockSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['p', 'h1', 'h2', 'h3', 'bullet', 'number', 'check', 'quote', 'callout', 'divider', 'pagebreak', 'table', 'image', 'chart', 'button', 'columns']),
  html: z.string().optional(),
  checked: z.boolean().optional(),
  align: z.enum(['left', 'center', 'right', 'justify']).optional(),
  /** Tabla: celdas como html. */
  rows: z.array(z.array(z.string())).optional(),
  src: z.string().optional(),
  /** Botón: enlace. */
  url: z.string().optional(),
  /** Bloque destacado y botón: color de fondo. */
  color: z.string().optional(),
  /** Columnas: html de cada columna. */
  cols: z.array(z.string()).optional(),
  chart: z
    .object({
      chartType: z.enum(['bar', 'line', 'pie']),
      labels: z.array(z.string()),
      values: z.array(z.number()),
      color: z.string(),
    })
    .optional(),
});

export const cellStyleSchema = z
  .object({
    bold: z.boolean(),
    italic: z.boolean(),
    color: z.string(),
    bg: z.string(),
    align: z.enum(['left', 'center', 'right']),
    format: z.enum(['general', 'number', 'currency', 'percent']),
    decimals: z.number().int().min(0).max(6),
  })
  .partial();

/** Hoja de cálculo: celdas por referencia ("B3"). */
export const sheetSchema = z.object({
  rows: z.number().int().positive().max(1000),
  cols: z.number().int().positive().max(52),
  cells: z.record(z.string(), z.string()),
  styles: z.record(z.string(), cellStyleSchema),
  colWidths: z.record(z.string(), z.number().positive()),
  frozenRows: z.number().int().min(0).optional(),
  fontFamily: z.string().optional(),
});

export const designDocSchema = z.object({
  title: z.string(),
  width: z.number().int().positive().max(10000),
  height: z.number().int().positive().max(10000),
  pages: z.array(pageSchema).min(1),
  audio: z.array(audioTrackSchema).optional(),
  /** Ausente = diseño libre (compatibilidad con documentos anteriores). */
  kind: designKindSchema.optional(),
  blocks: z.array(blockSchema).optional(),
  sheet: sheetSchema.optional(),
  /** Sitio web publicado (ruta pública /#/p/<id>). */
  published: z.boolean().optional(),
});

export const designSchema = z.object({
  id: z.string(),
  revision: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
  doc: designDocSchema,
});

export const createDesignBodySchema = z.object({
  title: z.string().optional(),
  width: z.number().int().positive().max(10000),
  height: z.number().int().positive().max(10000),
  /** Documento inicial (p. ej. desde una plantilla). Si falta, se crea en blanco. */
  doc: designDocSchema.optional(),
  kind: designKindSchema.optional(),
});

export const saveDesignBodySchema = z.object({
  baseRevision: z.number().int().nonnegative(),
  doc: designDocSchema,
});

/** Parche estilo Immer (RFC-6902 simplificado) usado en historial y colaboración. */
export const patchSchema = z.object({
  op: z.enum(['add', 'remove', 'replace']),
  path: z.array(z.union([z.string(), z.number()])),
  value: z.unknown().optional(),
});

/** Mensajes del canal WebSocket de colaboración. */
export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('join'), designId: z.string(), clientId: z.string(), name: z.string().optional() }),
  z.object({ type: z.literal('patch'), baseRevision: z.number().int(), patches: z.array(patchSchema), opId: z.string() }),
  z.object({ type: z.literal('cursor'), pageId: z.string(), x: z.number(), y: z.number() }),
]);

export type TextElement = z.infer<typeof textElementSchema>;
export type ShapeKind = z.infer<typeof shapeKindSchema>;
export type ShapeElement = z.infer<typeof shapeElementSchema>;
export type ImageElement = z.infer<typeof imageElementSchema>;
export type GraphicElement = z.infer<typeof graphicElementSchema>;
export type ChartType = z.infer<typeof chartTypeSchema>;
export type ChartElement = z.infer<typeof chartElementSchema>;
export type TableElement = z.infer<typeof tableElementSchema>;
export type FrameDecoration = z.infer<typeof frameDecorationSchema>;
export type FrameElement = z.infer<typeof frameElementSchema>;
export type GridElement = z.infer<typeof gridElementSchema>;
export type GridCell = z.infer<typeof gridCellSchema>;
export type SolidKind = z.infer<typeof solidKindSchema>;
export type SolidElement = z.infer<typeof solidElementSchema>;
export type VideoElement = z.infer<typeof videoElementSchema>;
export type FormField = z.infer<typeof formFieldSchema>;
export type FormElement = z.infer<typeof formElementSchema>;
export type AudioTrack = z.infer<typeof audioTrackSchema>;
export type StickyElement = z.infer<typeof stickyElementSchema>;
export type DrawElement = z.infer<typeof drawElementSchema>;
export type DesignKind = z.infer<typeof designKindSchema>;
export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block['type'];
export type CellStyle = z.infer<typeof cellStyleSchema>;
export type Sheet = z.infer<typeof sheetSchema>;
export type ImageFilters = NonNullable<ImageElement['filters']>;
export type AnimationKind = NonNullable<DesignElement['animation']>;
export type DesignElement = z.infer<typeof elementSchema>;
export type Page = z.infer<typeof pageSchema>;
export type DesignDoc = z.infer<typeof designDocSchema>;
export type Design = z.infer<typeof designSchema>;
export type CreateDesignBody = z.infer<typeof createDesignBodySchema>;
export type SaveDesignBody = z.infer<typeof saveDesignBodySchema>;
export type Patch = z.infer<typeof patchSchema>;
export type ClientMessage = z.infer<typeof clientMessageSchema>;

export type ServerMessage =
  | { type: 'welcome'; revision: number; doc: DesignDoc; peers: Peer[] }
  | { type: 'patch'; revision: number; patches: Patch[]; clientId: string; opId: string }
  | { type: 'ack'; revision: number; opId: string }
  | { type: 'resync'; revision: number; doc: DesignDoc }
  | { type: 'peers'; peers: Peer[] }
  | { type: 'cursor'; clientId: string; pageId: string; x: number; y: number };

export interface Peer {
  clientId: string;
  name: string;
  color: string;
}

export const formResponseBodySchema = z.object({
  values: z.record(z.string(), z.union([z.string(), z.number()])),
});
export type FormResponseBody = z.infer<typeof formResponseBodySchema>;
export interface FormResponse {
  id: string;
  formId: string;
  at: string;
  values: Record<string, string | number>;
}

/** Resultado de búsqueda en el banco de medios abierto (Openverse). */
export interface MediaResult {
  id: string;
  title: string;
  thumbnail: string;
  creator: string;
  license: string;
  /** Solo audio: URL para escuchar antes de importar. */
  preview?: string;
  /** Solo audio: duración en ms. */
  duration?: number;
}

export interface DesignSummary {
  id: string;
  title: string;
  kind?: DesignKind;
  width: number;
  height: number;
  pageCount: number;
  updatedAt: string;
}
