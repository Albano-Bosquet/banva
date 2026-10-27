/**
 * Biblioteca de formas propia. Cada forma se define en una caja de 100×100 y se
 * escala a la caja del elemento. Las rect/ellipse/line conservan su render nativo
 * (esquinas redondeadas, trazo de línea), el resto se dibuja como trazado SVG.
 */

export type ShapeRender = 'rect' | 'ellipse' | 'line' | 'path';

export interface ShapeDef {
  key: string;
  label: string;
  category: ShapeCategory;
  render: ShapeRender;
  path?: string;
  /** Valores iniciales al insertar (p. ej. esquinas, trazo de línea). */
  preset?: Record<string, unknown>;
}

export type ShapeCategory = 'Líneas' | 'Básicas' | 'Polígonos' | 'Estrellas' | 'Flechas' | 'Diagrama de flujo' | 'Globos de diálogo' | 'Decorativas';

type Pt = [number, number];

/** Ajusta puntos a la caja 0..100 y los convierte en un trazado cerrado. */
function fitPolygon(pts: Pt[]): string {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const sx = 100 / (Math.max(...xs) - minX || 1);
  const sy = 100 / (Math.max(...ys) - minY || 1);
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${r((x - minX) * sx)} ${r((y - minY) * sy)}`).join(' ') + ' Z';
}
const r = (n: number) => Math.round(n * 100) / 100;

function regular(n: number, rotate = -90): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = ((rotate + (360 / n) * i) * Math.PI) / 180;
    return [Math.cos(a), Math.sin(a)];
  });
}

function star(points: number, inner: number): Pt[] {
  return Array.from({ length: points * 2 }, (_, i) => {
    const a = (-90 + (180 / points) * i) * (Math.PI / 180);
    const rad = i % 2 ? inner : 1;
    return [Math.cos(a) * rad, Math.sin(a) * rad];
  });
}

function gear(teeth: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < teeth; i++) {
    const a0 = (360 / teeth) * i;
    for (const [da, rad] of [[0, 0.78], [0.12, 1], [0.38, 1], [0.5, 0.78]] as const) {
      const a = ((a0 + da * (360 / teeth)) * Math.PI) / 180;
      pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
    }
  }
  return pts;
}

/** Curva cerrada suave (Catmull-Rom → Bézier) a través de puntos en 0..100. */
function smooth(pts: Pt[]): string {
  const n = pts.length;
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${r(c1[0])} ${r(c1[1])} ${r(c2[0])} ${r(c2[1])} ${p2[0]} ${p2[1]}`;
  }
  return d + ' Z';
}

/** Flor de n pétalos como curva suave alternando radios. */
function petals(n: number, inner: number): string {
  const pts: Pt[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (-90 + (180 / n) * i) * (Math.PI / 180);
    const rad = i % 2 ? inner : 1;
    pts.push([r(50 + Math.cos(a) * rad * 50), r(50 + Math.sin(a) * rad * 50)]);
  }
  return smooth(pts);
}

const P = (key: string, label: string, category: ShapeCategory, path: string, preset?: Record<string, unknown>): ShapeDef => ({ key, label, category, render: 'path', path, preset });

export const SHAPES: ShapeDef[] = [
  { key: 'line', label: 'Línea', category: 'Líneas', render: 'line' },
  { key: 'line', label: 'Línea de guiones', category: 'Líneas', render: 'line', preset: { dash: 'dashed' } },
  { key: 'line', label: 'Línea de puntos', category: 'Líneas', render: 'line', preset: { dash: 'dotted' } },
  { key: 'line', label: 'Flecha', category: 'Líneas', render: 'line', preset: { arrow: 'end' } },
  { key: 'line', label: 'Flecha doble', category: 'Líneas', render: 'line', preset: { arrow: 'both' } },

  { key: 'rect', label: 'Rectángulo', category: 'Básicas', render: 'rect' },
  { key: 'rect', label: 'Rectángulo redondeado', category: 'Básicas', render: 'rect', preset: { cornerRadius: 40 } },
  { key: 'ellipse', label: 'Círculo', category: 'Básicas', render: 'ellipse' },
  P('triangle', 'Triángulo', 'Básicas', 'M50 0 L100 100 L0 100 Z'),
  P('right-triangle', 'Triángulo rectángulo', 'Básicas', 'M0 0 L100 100 L0 100 Z'),
  P('diamond', 'Rombo', 'Básicas', 'M50 0 L100 50 L50 100 L0 50 Z'),
  P('parallelogram', 'Paralelogramo', 'Básicas', 'M25 0 L100 0 L75 100 L0 100 Z'),
  P('trapezoid', 'Trapecio', 'Básicas', 'M20 0 L80 0 L100 100 L0 100 Z'),
  P('arch', 'Arco', 'Básicas', 'M0 100 L0 50 A50 50 0 0 1 100 50 L100 100 Z'),
  P('semicircle', 'Semicírculo', 'Básicas', 'M0 100 A50 100 0 0 1 100 100 Z'),
  P('cross', 'Cruz', 'Básicas', 'M35 0 L65 0 L65 35 L100 35 L100 65 L65 65 L65 100 L35 100 L35 65 L0 65 L0 35 L35 35 Z'),

  P('pentagon', 'Pentágono', 'Polígonos', fitPolygon(regular(5))),
  P('hexagon', 'Hexágono', 'Polígonos', fitPolygon(regular(6, 0))),
  P('heptagon', 'Heptágono', 'Polígonos', fitPolygon(regular(7))),
  P('octagon', 'Octágono', 'Polígonos', fitPolygon(regular(8, 22.5))),
  P('decagon', 'Decágono', 'Polígonos', fitPolygon(regular(10))),

  P('star4', 'Estrella de 4 puntas', 'Estrellas', fitPolygon(star(4, 0.38))),
  P('star', 'Estrella', 'Estrellas', fitPolygon(star(5, 0.45))),
  P('star6', 'Estrella de 6 puntas', 'Estrellas', fitPolygon(star(6, 0.55))),
  P('star8', 'Estrella de 8 puntas', 'Estrellas', fitPolygon(star(8, 0.7))),
  P('burst', 'Explosión', 'Estrellas', fitPolygon(star(16, 0.8))),
  P('asterisk', 'Asterisco', 'Estrellas', fitPolygon(star(6, 0.22))),

  P('arrow-right', 'Flecha derecha', 'Flechas', 'M0 30 L60 30 L60 5 L100 50 L60 95 L60 70 L0 70 Z'),
  P('arrow-left', 'Flecha izquierda', 'Flechas', 'M100 30 L40 30 L40 5 L0 50 L40 95 L40 70 L100 70 Z'),
  P('arrow-up', 'Flecha arriba', 'Flechas', 'M30 100 L30 40 L5 40 L50 0 L95 40 L70 40 L70 100 Z'),
  P('arrow-down', 'Flecha abajo', 'Flechas', 'M30 0 L30 60 L5 60 L50 100 L95 60 L70 60 L70 0 Z'),
  P('arrow-double', 'Flecha doble', 'Flechas', 'M0 50 L28 10 L28 32 L72 32 L72 10 L100 50 L72 90 L72 68 L28 68 L28 90 Z'),
  P('chevron', 'Chevrón', 'Flechas', 'M0 0 L65 0 L100 50 L65 100 L0 100 L35 50 Z'),
  P('pentagon-arrow', 'Etiqueta flecha', 'Flechas', 'M0 0 L75 0 L100 50 L75 100 L0 100 Z'),

  P('terminator', 'Inicio/fin', 'Diagrama de flujo', 'M25 0 L75 0 A25 50 0 0 1 75 100 L25 100 A25 50 0 0 1 25 0 Z'),
  { key: 'rect', label: 'Proceso', category: 'Diagrama de flujo', render: 'rect' },
  P('decision', 'Decisión', 'Diagrama de flujo', 'M50 0 L100 50 L50 100 L0 50 Z'),
  P('data', 'Datos', 'Diagrama de flujo', 'M20 0 L100 0 L80 100 L0 100 Z'),
  P('document', 'Documento', 'Diagrama de flujo', 'M0 0 L100 0 L100 85 C75 70 60 100 30 95 C15 92 8 86 0 85 Z'),
  P('database', 'Base de datos', 'Diagrama de flujo', 'M0 12 C0 -4 100 -4 100 12 L100 88 C100 104 0 104 0 88 Z'),

  P('bubble', 'Globo rectangular', 'Globos de diálogo', 'M8 0 L92 0 Q100 0 100 8 L100 62 Q100 70 92 70 L40 70 L18 100 L22 70 L8 70 Q0 70 0 62 L0 8 Q0 0 8 0 Z'),
  P('bubble-round', 'Globo redondo', 'Globos de diálogo', 'M50 0 C80 0 100 16 100 38 C100 60 80 76 50 76 C44 76 38 75 33 74 L12 100 L18 68 C7 61 0 50 0 38 C0 16 20 0 50 0 Z'),
  P('thought', 'Pensamiento', 'Globos de diálogo', smooth([[20, 20], [45, 6], [72, 10], [94, 30], [90, 58], [64, 72], [36, 70], [10, 58], [4, 38]]) + ' M12 82 a6 6 0 1 0 0.1 0 Z M4 94 a4 4 0 1 0 0.1 0 Z'),

  P('heart', 'Corazón', 'Decorativas', 'M50 92 C20 70 0 52 0 30 C0 12 13 0 28 0 C38 0 46 6 50 14 C54 6 62 0 72 0 C87 0 100 12 100 30 C100 52 80 70 50 92 Z'),
  P('cloud', 'Nube', 'Decorativas', 'M22 90 C8 90 0 80 0 68 C0 56 9 47 21 47 C21 30 34 18 50 18 C63 18 73 26 77 37 C90 37 100 48 100 62 C100 78 89 90 74 90 Z'),
  P('drop', 'Gota', 'Decorativas', 'M50 0 C62 22 85 42 85 64 C85 84 69 100 50 100 C31 100 15 84 15 64 C15 42 38 22 50 0 Z'),
  P('banner', 'Banner', 'Decorativas', 'M0 0 L100 0 L88 50 L100 100 L0 100 L12 50 Z'),
  P('ribbon', 'Cinta', 'Decorativas', 'M0 0 L100 0 L100 100 L50 78 L0 100 Z'),
  P('gear', 'Engranaje', 'Decorativas', fitPolygon(gear(10))),
  P('flower', 'Flor', 'Decorativas', petals(6, 0.55)),
  P('blob', 'Orgánica', 'Decorativas', smooth([[50, 2], [80, 10], [98, 40], [88, 76], [58, 98], [22, 90], [2, 62], [10, 24]])),
  P('blob2', 'Orgánica 2', 'Decorativas', smooth([[40, 4], [76, 2], [98, 30], [92, 64], [70, 96], [30, 92], [4, 70], [8, 30]])),
  P('moon', 'Luna', 'Decorativas', 'M62 0 A50 50 0 1 0 100 70 A40 40 0 1 1 62 0 Z'),
  P('bolt', 'Rayo', 'Decorativas', 'M58 0 L8 58 L44 58 L34 100 L92 36 L56 36 Z'),
  P('squircle', 'Squircle', 'Decorativas', 'M50 0 C90 0 100 10 100 50 C100 90 90 100 50 100 C10 100 0 90 0 50 C0 10 10 0 50 0 Z'),
];

const byKey = new Map<string, ShapeDef>();
for (const s of SHAPES) if (!byKey.has(s.key)) byKey.set(s.key, s);

export function shapeDef(key: string): ShapeDef {
  return byKey.get(key) ?? byKey.get('rect')!;
}

export const SHAPE_CATEGORIES: ShapeCategory[] = ['Líneas', 'Básicas', 'Polígonos', 'Estrellas', 'Flechas', 'Diagrama de flujo', 'Globos de diálogo', 'Decorativas'];

/** Trazado SVG en la caja 0..100 para miniaturas y máscaras (incluye rect y elipse). */
export function shapePath(key: string): string {
  const def = shapeDef(key);
  if (def.render === 'ellipse') return 'M0 50 A50 50 0 1 0 100 50 A50 50 0 1 0 0 50 Z';
  if (def.render === 'rect' || def.render === 'line') return 'M0 0 H100 V100 H0 Z';
  return def.path!;
}

type ClipCtx = { rect(x: number, y: number, w: number, h: number): void; ellipse(...a: number[]): void; roundRect?(x: number, y: number, w: number, h: number, r: number): void; _context?: CanvasRenderingContext2D };

/**
 * clipFunc de Konva para recortar con una forma de la biblioteca. Konva llama a
 * ctx.clip(...valorDevuelto), así que los trazados se devuelven como [Path2D].
 */
export function maskClip(key: string, w: number, h: number, radius = 0) {
  const def = shapeDef(key);
  return (ctx: ClipCtx): [Path2D] | void => {
    if (def.render === 'ellipse') {
      ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      return;
    }
    if (def.render === 'path') {
      const p = new Path2D();
      p.addPath(new Path2D(def.path!), new DOMMatrix().scale(w / 100, h / 100));
      return [p];
    }
    const rr = Math.min(radius, w / 2, h / 2);
    if (rr > 0) ctx._context?.roundRect(0, 0, w, h, rr);
    else ctx.rect(0, 0, w, h);
  };
}
