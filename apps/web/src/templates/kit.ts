import {
  createChart,
  createForm,
  createFrame,
  createGraphic,
  createGrid,
  createPage,
  createShape,
  createSolid,
  createTable,
  createText,
  type ChartElement,
  type DesignDoc,
  type DesignElement,
  type FormElement,
  type FormPreset,
  type FrameDecoration,
  type FrameElement,
  type Page,
  type ShapeElement,
  type SolidKind,
  type TableElement,
  type TableStyle,
  type TextElement,
} from '@trazo/shared';
import { GRAPHICS } from '../elements/graphicsLibrary';

/**
 * Kit para escribir plantillas: las posiciones se dan en fracciones del ancho/alto de
 * la página y los tamaños de letra en "u" (1 % del lado menor), así cada plantilla se
 * lee como un boceto y escala sola.
 */
export interface Ctx {
  w: number;
  h: number;
  /** 1 % del lado menor de la página. */
  u: number;
  /** Alias que piden las fábricas del modelo. */
  width: number;
  height: number;
}

export function ctx(w: number, h: number): Ctx {
  return { w, h, u: Math.min(w, h) / 100, width: w, height: h };
}

export interface TextOpts {
  size?: number;
  font?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  align?: TextElement['align'];
  lh?: number;
  ls?: number;
  underline?: boolean;
  animation?: DesignElement['animation'];
  rotation?: number;
}

/** Texto en (x, y) con ancho `width` (fracciones de la página). */
export function T(c: Ctx, text: string, x: number, y: number, width: number, o: TextOpts = {}): TextElement {
  const fontSize = (o.size ?? 4) * c.u;
  const fontStyle: TextElement['fontStyle'] = o.bold && o.italic ? 'bold italic' : o.bold ? 'bold' : o.italic ? 'italic' : 'normal';
  const lines = text.split('\n').length;
  return createText(c, 'body', {
    text,
    x: x * c.w,
    y: y * c.h,
    width: width * c.w,
    height: fontSize * (o.lh ?? 1.25) * lines,
    fontSize,
    fontFamily: o.font ?? 'Inter',
    fill: o.color ?? '#1f2430',
    fontStyle,
    align: o.align ?? 'left',
    lineHeight: o.lh ?? 1.25,
    letterSpacing: (o.ls ?? 0) * c.u,
    textDecoration: o.underline ? 'underline' : '',
    animation: o.animation,
    rotation: o.rotation ?? 0,
  });
}

export interface ShapeOpts {
  r?: number;
  stroke?: string;
  sw?: number;
  opacity?: number;
  rotation?: number;
  dash?: ShapeElement['dash'];
  arrow?: ShapeElement['arrow'];
  animation?: DesignElement['animation'];
}

/** Forma de la biblioteca en una caja (fracciones). El radio y el borde van en "u". */
export function S(c: Ctx, shape: string, x: number, y: number, w: number, h: number, fill: string, o: ShapeOpts = {}): ShapeElement {
  return createShape(c, shape, {
    x: x * c.w,
    y: y * c.h,
    width: Math.max(1, w * c.w),
    height: Math.max(1, h * c.h),
    fill,
    cornerRadius: (o.r ?? 0) * c.u,
    stroke: o.stroke ?? '#1f2430',
    strokeWidth: (o.sw ?? 0) * c.u,
    opacity: o.opacity ?? 1,
    rotation: o.rotation ?? 0,
    dash: o.dash,
    arrow: o.arrow,
    animation: o.animation,
  });
}

/** Rectángulo (atajo de S). */
export const R = (c: Ctx, x: number, y: number, w: number, h: number, fill: string, o: ShapeOpts = {}) => S(c, 'rect', x, y, w, h, fill, o);

/** Línea horizontal de grosor `t` (en u). */
export const L = (c: Ctx, x: number, y: number, w: number, t: number, color: string, o: ShapeOpts = {}) =>
  createShape(c, 'line', { x: x * c.w, y: y * c.h, width: w * c.w, height: t * c.u, fill: color, dash: o.dash, arrow: o.arrow, opacity: o.opacity ?? 1 });

/** Ilustración de la biblioteca; `size` es el ancho en fracción del ancho de página. */
export function G(c: Ctx, id: string, x: number, y: number, size: number, colors?: string[], o: { rotation?: number; opacity?: number; animation?: DesignElement['animation'] } = {}): DesignElement {
  const def = GRAPHICS.find((g) => g.id === id);
  if (!def) throw new Error(`ilustración desconocida: ${id}`);
  const aspect = def.aspect ?? 1;
  const width = size * c.w;
  return createGraphic(c, def.svg, colors ?? def.colors, aspect, {
    x: x * c.w,
    y: y * c.h,
    width,
    height: width / aspect,
    rotation: o.rotation ?? 0,
    opacity: o.opacity ?? 1,
    animation: o.animation ?? def.animation,
  });
}

/** Marco para foto (queda con el relleno de ejemplo hasta que se suelte una imagen). */
export function F(c: Ctx, mask: string, x: number, y: number, w: number, h: number, o: { deco?: FrameDecoration; r?: number; tint?: string; rotation?: number } = {}): FrameElement {
  return createFrame(c, mask, o.deco ?? 'none', {
    x: x * c.w,
    y: y * c.h,
    width: w * c.w,
    height: h * c.h,
    cornerRadius: (o.r ?? 0) * c.u,
    rotation: o.rotation ?? 0,
    ...(o.tint ? { tint: o.tint } : {}),
  });
}

export function grid(c: Ctx, layout: string, x: number, y: number, w: number, h: number, gap = 1, r = 0) {
  return createGrid(c, layout, { x: x * c.w, y: y * c.h, width: w * c.w, height: h * c.h, gap: gap * c.u, cornerRadius: r * c.u });
}

export function chart(c: Ctx, type: ChartElement['chartType'], x: number, y: number, w: number, h: number, o: Partial<ChartElement> = {}) {
  return createChart(c, type, { x: x * c.w, y: y * c.h, width: w * c.w, height: h * c.h, ...o });
}

export function table(c: Ctx, cells: string[][], x: number, y: number, w: number, h: number, style: TableStyle, accent: string, o: Partial<TableElement> = {}) {
  return createTable(c, cells.length, cells[0].length, style, accent, {
    cells,
    x: x * c.w,
    y: y * c.h,
    width: w * c.w,
    height: h * c.h,
    fontSize: (o.fontSize ?? 2.4) * c.u,
    ...o,
    ...(o.fontSize ? { fontSize: o.fontSize * c.u } : {}),
  });
}

export function form(c: Ctx, preset: FormPreset, x: number, y: number, w: number, o: Partial<FormElement> = {}) {
  const f = createForm(c, preset, o);
  const k = (w * c.w) / f.width;
  return { ...f, x: x * c.w, y: y * c.h, width: f.width * k, height: f.height * k };
}

export function solid(c: Ctx, kind: SolidKind, x: number, y: number, size: number, color: string, o: { yaw?: number; pitch?: number; animation?: DesignElement['animation'] } = {}) {
  return createSolid(c, kind, color, { x: x * c.w, y: y * c.h, width: size * c.w, height: size * c.w, yaw: o.yaw ?? 35, pitch: o.pitch ?? 25, animation: o.animation });
}

export function page(background: string, elements: DesignElement[], title = ''): Page {
  return createPage({ background, title, elements });
}

export function doc(title: string, w: number, h: number, pages: Page[]): DesignDoc {
  return { title, width: w, height: h, pages };
}

/** Milímetros/pulgadas a px a 96 ppp (la conversión que usa Banva para A4: 794 × 1123). */
export const mm = (v: number) => Math.round((v / 25.4) * 96);
export const inch = (v: number) => Math.round(v * 96);
