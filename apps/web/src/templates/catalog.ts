import type { DesignDoc } from '@trazo/shared';
import { G, F, L, R, S, T, chart, ctx, doc, form, grid, inch, mm, page, solid, table, type Ctx } from './kit';

/**
 * Categorías y tamaños tomados de la galería observada (ANALISIS_CANVA.md §14).
 * Todas las plantillas son originales de Banva: textos, paletas y composiciones propias.
 */
export interface Category {
  id: string;
  label: string;
  width: number;
  height: number;
  /** Medida original cuando no es en px. */
  note?: string;
  group: 'Redes sociales' | 'Negocios' | 'Impresos' | 'Video y web' | 'Educación';
}

export const CATEGORIES: Category[] = [
  { id: 'ig-post', label: 'Post de Instagram', width: 1080, height: 1350, group: 'Redes sociales' },
  { id: 'ig-story', label: 'Historia', width: 1080, height: 1920, group: 'Redes sociales' },
  { id: 'fb-post', label: 'Post de Facebook', width: 940, height: 788, group: 'Redes sociales' },
  { id: 'fb-cover', label: 'Portada de Facebook', width: 820, height: 312, group: 'Redes sociales' },
  { id: 'yt-thumb', label: 'Miniatura de YouTube', width: 1280, height: 720, group: 'Redes sociales' },
  { id: 'banner', label: 'Banner', width: 1500, height: 500, group: 'Redes sociales' },
  { id: 'presentation', label: 'Presentación', width: 1920, height: 1080, group: 'Negocios' },
  { id: 'logo', label: 'Logo', width: 2000, height: 2000, group: 'Negocios' },
  { id: 'business-card', label: 'Tarjeta de presentación', width: inch(3.5), height: inch(2), note: '3,5 × 2 in', group: 'Negocios' },
  { id: 'invoice', label: 'Factura', width: mm(210), height: mm(297), note: 'A4', group: 'Negocios' },
  { id: 'resume', label: 'Currículum', width: mm(210), height: mm(297), note: 'A4', group: 'Negocios' },
  { id: 'infographic', label: 'Infografía', width: 800, height: 2000, group: 'Negocios' },
  { id: 'flyer', label: 'Flyer', width: mm(210), height: mm(297), note: 'A4', group: 'Impresos' },
  { id: 'poster', label: 'Cartel', width: mm(420), height: mm(594), note: 'A2', group: 'Impresos' },
  { id: 'invitation', label: 'Invitación', width: mm(105), height: mm(148), note: 'A6', group: 'Impresos' },
  { id: 'certificate', label: 'Certificado', width: mm(297), height: mm(210), note: 'A4 horizontal', group: 'Impresos' },
  { id: 'brochure', label: 'Folleto', width: mm(297), height: mm(210), note: 'A4 horizontal', group: 'Impresos' },
  { id: 'newsletter', label: 'Boletín', width: mm(210), height: mm(297), note: 'A4', group: 'Impresos' },
  { id: 'tshirt', label: 'Remera', width: inch(14), height: inch(18), note: '14 × 18 in', group: 'Impresos' },
  { id: 'calendar', label: 'Calendario', width: 1920, height: 1080, group: 'Impresos' },
  { id: 'video', label: 'Video', width: 1920, height: 1080, group: 'Video y web' },
  { id: 'website', label: 'Sitio web', width: 1366, height: 768, group: 'Video y web' },
  { id: 'wallpaper', label: 'Fondo de escritorio', width: 1920, height: 1080, group: 'Video y web' },
  { id: 'worksheet', label: 'Ficha de trabajo', width: mm(210), height: mm(297), note: 'A4', group: 'Educación' },
];

export interface Template {
  id: string;
  name: string;
  category: string;
  tags: string;
  build(): DesignDoc;
}

const defs: Template[] = [];

/** Registra una plantilla de la categoría con el tamaño de esa categoría. */
function tpl(id: string, category: string, name: string, tags: string, pages: (c: Ctx) => ReturnType<typeof page>[], title = name) {
  const cat = CATEGORIES.find((x) => x.id === category)!;
  defs.push({ id, name, category, tags, build: () => doc(title, cat.width, cat.height, pages(ctx(cat.width, cat.height))) });
}

/** Plantilla de tamaño propio dentro de una categoría (las cuadradas heredadas). */
function tplSized(id: string, category: string, name: string, tags: string, w: number, h: number, pages: (c: Ctx) => ReturnType<typeof page>[], title = name) {
  defs.push({ id, name, category, tags, build: () => doc(title, w, h, pages(ctx(w, h))) });
}

// =========================================================================== Redes sociales

tplSized('oferta', 'ig-post', 'Oferta de temporada', 'venta descuento tienda naranja', 1080, 1080, (c) => [
  page('#ff6b4a', [
    S(c, 'ellipse', 0.593, -0.148, 0.574, 0.574, '#ffc145', { opacity: 0.9 }),
    S(c, 'ellipse', -0.167, 0.704, 0.444, 0.444, '#ffffff', { opacity: 0.18 }),
    T(c, 'SOLO ESTA SEMANA', 0.083, 0.278, 0.648, { size: 3.52, font: 'Space Grotesk', bold: true, ls: 0.56 }),
    T(c, '40% OFF\nen toda\nla tienda', 0.083, 0.343, 0.833, { size: 9.26, font: 'Space Grotesk', bold: true, color: '#ffffff', lh: 1.05 }),
    R(c, 0.083, 0.685, 0.333, 0.089, '#1f2430', { r: 4.44 }),
    T(c, 'Comprar ahora', 0.083, 0.709, 0.333, { size: 3.15, color: '#ffffff', bold: true, align: 'center' }),
    S(c, 'star', 0.759, 0.704, 0.148, 0.148, '#1f2430'),
  ]),
]);

tplSized('cita', 'ig-post', 'Cita inspiradora', 'frase cita motivación verde', 1080, 1080, (c) => [
  page('#2bb3a3', [
    R(c, 0.074, 0.074, 0.852, 0.852, 'transparent', { stroke: '#ffffff', sw: 0.37 }),
    T(c, '“', 0.13, 0.13, 0.185, { size: 24, font: 'Playfair Display', bold: true, color: '#ffffff' }),
    T(c, 'Lo simple bien hecho siempre funciona.', 0.148, 0.37, 0.704, { size: 7.2, font: 'Playfair Display', bold: true, color: '#ffffff', align: 'center' }),
    T(c, '— Anónimo', 0.148, 0.722, 0.704, { size: 3.3, align: 'center' }),
  ], ''),
], 'Cita');

tpl('ig-collage', 'ig-post', 'Collage de fin de semana', 'collage fotos recuerdos neutro', (c) => [
  page('#f4ede4', [
    T(c, 'fin de semana', 0.07, 0.045, 0.86, { size: 9, font: 'Caveat', bold: true, color: '#6b4f3a', align: 'center' }),
    grid(c, 'big+3', 0.06, 0.15, 0.88, 0.7, 1.2, 1.5),
    T(c, 'Lo mejor fue no tener planes.', 0.07, 0.885, 0.86, { size: 3.6, font: 'Playfair Display', italic: true, color: '#6b4f3a', align: 'center' }),
  ]),
]);

tpl('ig-tips', 'ig-post', '5 hábitos para trabajar mejor', 'consejos lista hábitos productividad violeta', (c) => [
  page('#efeaff', [
    S(c, 'blob', 0.55, -0.08, 0.6, 0.45, '#8a5cff', { opacity: 0.18 }),
    T(c, '5 HÁBITOS', 0.08, 0.08, 0.84, { size: 13, font: 'Bebas Neue', color: '#5a2fd1' }),
    T(c, 'para trabajar mejor', 0.08, 0.2, 0.84, { size: 5.4, font: 'DM Serif Display', italic: true }),
    ...['Empezá por la tarea difícil', 'Bloques de 45 minutos', 'Una sola pestaña abierta', 'Pausas lejos de la pantalla', 'Cerrá el día con una lista'].flatMap((t, i) => [
      S(c, 'ellipse', 0.08, 0.33 + i * 0.11, 0.09, 0.072, '#5a2fd1'),
      T(c, String(i + 1), 0.08, 0.345 + i * 0.11, 0.09, { size: 4.2, bold: true, color: '#ffffff', align: 'center' }),
      T(c, t, 0.21, 0.35 + i * 0.11, 0.72, { size: 4.2, font: 'Montserrat' }),
    ]),
    T(c, 'Guardalo para después →', 0.08, 0.9, 0.84, { size: 3, bold: true, color: '#5a2fd1', align: 'right' }),
  ]),
]);

tpl('evento', 'ig-story', 'Historia de evento', 'jazz música noche evento', (c) => [
  page('#1f2430', [
    S(c, 'ellipse', 0.13, 0.125, 0.741, 0.417, '#2bb3a3'),
    S(c, 'ellipse', 0.269, 0.203, 0.463, 0.26, '#1f2430'),
    T(c, 'Noche de jazz', 0.074, 0.594, 0.852, { size: 13, font: 'Playfair Display', italic: true, color: '#ffffff', align: 'center' }),
    L(c, 0.361, 0.708, 0.278, 0.56, '#ffc145'),
    T(c, 'Viernes 21 · 22 h\nCentro Cultural del Puerto', 0.074, 0.74, 0.852, { size: 4.8, color: '#c9cede', align: 'center', lh: 1.5 }),
  ]),
], 'Noche de jazz');

tpl('story-coleccion', 'ig-story', 'Nueva colección', 'moda colección tienda arco foto', (c) => [
  page('#efe6da', [
    T(c, 'NUEVA', 0.08, 0.06, 0.84, { size: 6, font: 'Montserrat', bold: true, ls: 2.4, color: '#8a5a3c', align: 'center' }),
    T(c, 'Colección\nOtoño', 0.08, 0.1, 0.84, { size: 16, font: 'DM Serif Display', color: '#3b2a20', align: 'center', lh: 0.95 }),
    F(c, 'arch', 0.14, 0.33, 0.72, 0.48),
    S(c, 'star4', 0.78, 0.31, 0.1, 0.056, '#c98b5e', { animation: 'spin' }),
    T(c, 'Deslizá para ver más', 0.08, 0.86, 0.84, { size: 4, font: 'Montserrat', color: '#3b2a20', align: 'center' }),
    S(c, 'arrow-up', 0.46, 0.9, 0.08, 0.045, '#3b2a20', { animation: 'bounce' }),
  ]),
]);

tpl('story-encuesta', 'ig-story', 'Encuesta rápida', 'pregunta encuesta quiz interactivo formulario', (c) => [
  page('#ffe14d', [
    G(c, 'confetti', 0.05, 0.03, 0.4),
    G(c, 'confetti', 0.6, 0.75, 0.35),
    T(c, 'Te leemos', 0.08, 0.17, 0.84, { size: 13, font: 'Bebas Neue', align: 'center' }),
    form(c, 'quiz', 0.1, 0.32, 0.8, { title: '¿Qué contenido querés ver?', fields: [{ id: 'answer', label: 'Elegí una opción', kind: 'choice', options: ['Tutoriales', 'Detrás de escena', 'Novedades'] }], accent: '#1f2430', background: '#ffffff' }),
  ]),
]);

tpl('fb-apertura', 'fb-post', 'Gran apertura', 'apertura local negocio inauguración', (c) => [
  page('#13302c', [
    F(c, 'rect', 0.5, 0, 0.5, 1),
    S(c, 'pentagon-arrow', 0, 0.1, 0.62, 0.14, '#ffc145'),
    T(c, 'GRAN APERTURA', 0.05, 0.13, 0.55, { size: 6.6, font: 'Bebas Neue', ls: 0.3 }),
    T(c, 'Barbería\nEl Puerto', 0.05, 0.33, 0.45, { size: 11, font: 'DM Serif Display', color: '#ffffff', lh: 1 }),
    T(c, 'Sábado 3 · desde las 10 h\nCorte gratis para los primeros 20', 0.05, 0.65, 0.42, { size: 3.3, color: '#bff0e8', lh: 1.5 }),
    R(c, 0.05, 0.84, 0.3, 0.09, '#2bb3a3', { r: 1 }),
    T(c, 'Reservá tu turno', 0.05, 0.865, 0.3, { size: 3, bold: true, color: '#13302c', align: 'center' }),
  ]),
]);

tpl('fb-webinar', 'fb-post', 'Webinar en vivo', 'webinar charla en vivo online evento', (c) => [
  page('#f3f5ff', [
    R(c, 0, 0, 1, 0.09, '#5b6cff'),
    T(c, '● EN VIVO', 0.04, 0.025, 0.4, { size: 3.4, bold: true, color: '#ffffff' }),
    T(c, 'Cómo armar tu primera tienda online', 0.06, 0.18, 0.52, { size: 7.6, font: 'Montserrat', bold: true, lh: 1.1 }),
    T(c, 'Jueves 15 · 19 h (ARG)\nInscripción gratuita', 0.06, 0.62, 0.5, { size: 3.6, color: '#4a5263', lh: 1.5 }),
    F(c, 'ellipse', 0.6, 0.22, 0.34, 0.405),
    S(c, 'ellipse', 0.57, 0.18, 0.4, 0.477, 'transparent', { stroke: '#5b6cff', sw: 0.6 }),
    T(c, 'Lucía Romero\nFundadora de Tiendita', 0.56, 0.74, 0.42, { size: 3, bold: true, align: 'center', lh: 1.4 }),
  ]),
]);

tpl('fb-cover-estudio', 'fb-cover', 'Portada de estudio creativo', 'portada estudio diseño marca degradado', (c) => [
  page('#1f2430', [
    G(c, 'grad-berry', 0, 0, 1),
    S(c, 'blob', 0.68, -0.4, 0.4, 1.3, '#ffffff', { opacity: 0.12 }),
    T(c, 'Estudio Faro', 0.05, 0.28, 0.6, { size: 16, font: 'DM Serif Display', color: '#ffffff' }),
    T(c, 'Diseño · Marca · Contenido', 0.05, 0.62, 0.6, { size: 6, font: 'Montserrat', color: '#ffffff', ls: 0.4 }),
  ]),
]);

tpl('fb-cover-fotos', 'fb-cover', 'Portada con fotos', 'portada fotos collage personal', (c) => [
  page('#ffffff', [
    grid(c, '3v', 0.35, 0, 0.65, 1, 0.6),
    T(c, 'Hola, soy\nMartina', 0.03, 0.22, 0.3, { size: 13, font: 'Caveat', bold: true, color: '#e84a8a', lh: 0.95 }),
    T(c, 'fotos · viajes · café', 0.03, 0.72, 0.3, { size: 5, color: '#4a5263' }),
  ]),
]);

tpl('yt-reaccion', 'yt-thumb', 'Miniatura de tutorial', 'youtube miniatura tutorial video', (c) => [
  page('#ffe14d', [
    R(c, 0, 0.7, 1, 0.3, '#1f2430'),
    F(c, 'ellipse', 0.6, 0.06, 0.36, 0.64),
    S(c, 'ellipse', 0.585, 0.04, 0.39, 0.68, 'transparent', { stroke: '#1f2430', sw: 1.2 }),
    T(c, 'EDITÁ\nEN 5 MIN', 0.04, 0.06, 0.58, { size: 22, font: 'Bebas Neue', lh: 0.9 }),
    S(c, 'arrow-right', 0.46, 0.5, 0.14, 0.15, '#e84a8a', { rotation: -15 }),
    T(c, 'Guía para principiantes', 0.04, 0.77, 0.9, { size: 8, font: 'Montserrat', bold: true, color: '#ffffff' }),
  ]),
]);

tpl('banner-x', 'banner', 'Banner de perfil', 'banner perfil cabecera x twitter', (c) => [
  page('#0b3d91', [
    S(c, 'ellipse', 0.72, -0.5, 0.36, 1.6, '#2bb3a3', { opacity: 0.5 }),
    S(c, 'ellipse', 0.82, 0.2, 0.25, 1.2, '#5b6cff', { opacity: 0.6 }),
    T(c, 'Escribo sobre producto y diseño', 0.05, 0.3, 0.62, { size: 11, font: 'Montserrat', bold: true, color: '#ffffff', lh: 1.1 }),
    T(c, 'boletín semanal → trazo.dev', 0.05, 0.7, 0.6, { size: 6, color: '#bff0e8' }),
  ]),
]);

// =========================================================================== Negocios

tpl('presentacion', 'presentation', 'Presentación simple', 'presentación proyecto equipo objetivos', (c) => [
  page('#f4e9d8', [
    R(c, 0, 0, 0.333, 1, '#5b6cff'),
    T(c, 'Presentación del proyecto', 0.396, 0.352, 0.552, { size: 10.2, bold: true, lh: 1.1 }),
    T(c, 'Equipo de producto · 2026', 0.396, 0.63, 0.521, { size: 4.07, color: '#4a5263' }),
  ], 'Portada'),
  page('#ffffff', [
    T(c, 'Objetivos', 0.073, 0.111, 0.625, { size: 8.9, bold: true }),
    L(c, 0.073, 0.25, 0.125, 0.93, '#5b6cff'),
    T(c, '• Validar la propuesta con usuarios\n• Lanzar la primera versión\n• Medir y mejorar cada semana', 0.073, 0.333, 0.729, { size: 5.2, color: '#4a5263', lh: 1.7 }),
  ], 'Objetivos'),
], 'Presentación del proyecto');

tpl('pres-pitch', 'presentation', 'Pitch de startup', 'pitch startup inversores negocio oscuro gráfico', (c) => [
  page('#11131a', [
    S(c, 'blob', 0.62, -0.2, 0.5, 0.9, '#5b6cff', { opacity: 0.35 }),
    solid(c, 'gem', 0.68, 0.18, 0.22, '#8a96ff', { animation: 'spin' }),
    T(c, 'Rumbo', 0.07, 0.3, 0.6, { size: 16, font: 'Montserrat', bold: true, color: '#ffffff' }),
    T(c, 'Logística de última milla para pymes', 0.07, 0.52, 0.55, { size: 4.4, color: '#c9cede' }),
    T(c, 'Ronda semilla · 2026', 0.07, 0.85, 0.4, { size: 2.6, color: '#8a93a6', ls: 0.3 }),
  ], 'Portada'),
  page('#11131a', [
    T(c, 'El problema', 0.07, 0.12, 0.4, { size: 6, bold: true, color: '#ff6b4a' }),
    T(c, 'El 38 % de los envíos de pymes llega tarde y cada demora cuesta un cliente.', 0.07, 0.26, 0.38, { size: 3.8, color: '#ffffff', lh: 1.4 }),
    L(c, 0.5, 0.12, 0.001, 0.2, '#2b3040'),
    T(c, 'La solución', 0.55, 0.12, 0.4, { size: 6, bold: true, color: '#2bb3a3' }),
    T(c, 'Rutas optimizadas y repartidores de barrio, con seguimiento en tiempo real.', 0.55, 0.26, 0.38, { size: 3.8, color: '#ffffff', lh: 1.4 }),
  ], 'Problema y solución'),
  page('#11131a', [
    T(c, 'Tracción', 0.07, 0.1, 0.5, { size: 6, bold: true, color: '#ffffff' }),
    chart(c, 'bar', 0.07, 0.24, 0.55, 0.66, { labels: ['T1', 'T2', 'T3', 'T4'], series: [{ name: 'Envíos (miles)', color: '#5b6cff', values: [4, 9, 17, 31] }], showValues: true, textColor: '#c9cede', showLegend: false }),
    T(c, '×7,7', 0.68, 0.36, 0.28, { size: 14, font: 'Montserrat', bold: true, color: '#2bb3a3' }),
    T(c, 'crecimiento en un año', 0.68, 0.6, 0.28, { size: 3.4, color: '#c9cede' }),
  ], 'Tracción'),
  page('#11131a', [
    T(c, 'Equipo', 0.07, 0.1, 0.5, { size: 6, bold: true, color: '#ffffff' }),
    ...['Ana · CEO', 'Leo · CTO', 'Mía · Operaciones'].flatMap((n, i) => [
      F(c, 'ellipse', 0.1 + i * 0.3, 0.3, 0.18, 0.32),
      T(c, n, 0.06 + i * 0.3, 0.68, 0.26, { size: 3.4, color: '#ffffff', align: 'center' }),
    ]),
  ], 'Equipo'),
], 'Rumbo · pitch');

tpl('logo-cafe', 'logo', 'Logo de cafetería', 'logo café cafetería sello circular', (c) => [
  page('#f4ede4', [
    S(c, 'ellipse', 0.2, 0.2, 0.6, 0.6, '#3b2a20'),
    S(c, 'ellipse', 0.235, 0.235, 0.53, 0.53, 'transparent', { stroke: '#f4ede4', sw: 0.5, dash: 'dashed' }),
    G(c, 'coffee', 0.4, 0.29, 0.2, ['#f4ede4', '#c98b5e', '#f4ede4']),
    T(c, 'GRANO', 0.2, 0.5, 0.6, { size: 9, font: 'Bebas Neue', color: '#f4ede4', align: 'center', ls: 1 }),
    T(c, 'café de especialidad', 0.2, 0.61, 0.6, { size: 2.6, font: 'Montserrat', color: '#c98b5e', align: 'center', ls: 0.4 }),
  ]),
], 'Grano café');

tpl('logo-monograma', 'logo', 'Monograma minimalista', 'logo monograma iniciales minimalista estudio', (c) => [
  page('#ffffff', [
    S(c, 'arch', 0.36, 0.26, 0.28, 0.34, '#1f2430'),
    T(c, 'NL', 0.36, 0.38, 0.28, { size: 11, font: 'DM Serif Display', color: '#ffffff', align: 'center' }),
    T(c, 'NORA LUNA', 0.2, 0.66, 0.6, { size: 4.2, font: 'Montserrat', bold: true, align: 'center', ls: 1.6 }),
    T(c, 'arquitectura', 0.2, 0.72, 0.6, { size: 2.4, color: '#8a93a6', align: 'center', ls: 0.8 }),
  ]),
], 'Nora Luna');

tpl('tarjeta-moderna', 'business-card', 'Tarjeta moderna', 'tarjeta presentación contacto profesional', (c) => [
  page('#ffffff', [
    R(c, 0, 0, 0.36, 1, '#2bb3a3'),
    G(c, 'icon-leaf', 0.08, 0.3, 0.2, ['#ffffff']),
    T(c, 'Camila Ortiz', 0.42, 0.18, 0.55, { size: 10, font: 'Montserrat', bold: true }),
    T(c, 'Paisajista', 0.42, 0.36, 0.55, { size: 6.5, color: '#2bb3a3' }),
    T(c, '+54 11 5555 0101\nhola@verdeortiz.com\nverdeortiz.com', 0.42, 0.56, 0.56, { size: 5.6, color: '#4a5263', lh: 1.4 }),
  ]),
  page('#2bb3a3', [T(c, 'verde ortiz', 0.1, 0.4, 0.8, { size: 14, font: 'DM Serif Display', italic: true, color: '#ffffff', align: 'center' })]),
]);

tpl('tarjeta-minimal', 'business-card', 'Tarjeta minimal', 'tarjeta presentación minimalista negro', (c) => [
  page('#1f2430', [
    T(c, 'TOMÁS RÍOS', 0.08, 0.2, 0.84, { size: 11, font: 'Bebas Neue', color: '#ffffff', ls: 1 }),
    L(c, 0.08, 0.46, 0.15, 1.6, '#ffc145'),
    T(c, 'Fotografía de producto', 0.08, 0.55, 0.84, { size: 6, color: '#c9cede' }),
    T(c, 'tomasrios.ar', 0.08, 0.75, 0.84, { size: 6, color: '#ffc145' }),
  ]),
]);

tpl('factura-simple', 'invoice', 'Factura con totales', 'factura presupuesto cobro totales fórmulas', (c) => [
  page('#ffffff', [
    T(c, 'FACTURA', 0.08, 0.06, 0.5, { size: 8, font: 'Montserrat', bold: true, color: '#5b6cff', ls: 0.5 }),
    T(c, 'N.º 0001-00000123\nFecha: 27/10/2026', 0.6, 0.065, 0.32, { size: 2.2, color: '#4a5263', align: 'right', lh: 1.5 }),
    T(c, 'Estudio Faro\nAv. Siempre Viva 742, CABA\nCUIT 30-12345678-9', 0.08, 0.15, 0.42, { size: 2.3, lh: 1.5 }),
    T(c, 'Facturar a\nCliente Ejemplo S.A.\nCalle Falsa 123', 0.6, 0.15, 0.32, { size: 2.3, align: 'right', lh: 1.5 }),
    table(c, [
      ['Descripción', 'Cant.', 'Precio', 'Subtotal'],
      ['Diseño de marca', '1', '450000', '=B2*C2'],
      ['Piezas para redes', '12', '18000', '=B3*C3'],
      ['Sesión de fotos', '1', '120000', '=B4*C4'],
      ['', '', 'Subtotal', '=SUMA(D2:D4)'],
      ['', '', 'IVA 21 %', '=D5*0.21'],
      ['', '', 'Total', '=D5+D6'],
    ], 0.08, 0.32, 0.84, 0.36, 'header', '#5b6cff', { colWidths: [2.6, 0.8, 1.2, 1.4], fontSize: 2.2, borderWidth: 1 }),
    T(c, 'Gracias por confiar en nosotros. Pago a 15 días por transferencia.', 0.08, 0.86, 0.84, { size: 2.2, color: '#8a93a6' }),
  ]),
], 'Factura 0001-00000123');

tpl('cv-lateral', 'resume', 'Currículum con barra lateral', 'currículum cv trabajo foto profesional', (c) => [
  page('#ffffff', [
    R(c, 0, 0, 0.34, 1, '#1f2430'),
    F(c, 'ellipse', 0.07, 0.05, 0.2, 0.141),
    T(c, 'CONTACTO', 0.05, 0.23, 0.26, { size: 2.6, bold: true, color: '#ffc145', ls: 0.3 }),
    T(c, 'valen@correo.com\n+54 9 11 5555 0000\nRosario, Argentina', 0.05, 0.26, 0.27, { size: 2.2, color: '#ffffff', lh: 1.6 }),
    T(c, 'HABILIDADES', 0.05, 0.37, 0.26, { size: 2.6, bold: true, color: '#ffc145', ls: 0.3 }),
    T(c, 'Figma\nInvestigación con usuarios\nPrototipado\nSistemas de diseño', 0.05, 0.4, 0.27, { size: 2.2, color: '#ffffff', lh: 1.6 }),
    T(c, 'Valentina Paz', 0.39, 0.05, 0.56, { size: 7, font: 'Montserrat', bold: true }),
    T(c, 'Diseñadora UX', 0.39, 0.11, 0.56, { size: 3.6, color: '#2bb3a3' }),
    T(c, 'EXPERIENCIA', 0.39, 0.19, 0.56, { size: 2.8, bold: true, ls: 0.3 }),
    L(c, 0.39, 0.215, 0.56, 0.25, '#e3e6ee'),
    T(c, 'Diseñadora UX · Banco Norte\n2023 – hoy\nRediseño del home banking: +22 % de transferencias completadas.', 0.39, 0.23, 0.56, { size: 2.2, color: '#4a5263', lh: 1.5 }),
    T(c, 'Diseñadora visual · Agencia Sur\n2020 – 2023\nIdentidades para 30 marcas locales.', 0.39, 0.33, 0.56, { size: 2.2, color: '#4a5263', lh: 1.5 }),
    T(c, 'EDUCACIÓN', 0.39, 0.45, 0.56, { size: 2.8, bold: true, ls: 0.3 }),
    L(c, 0.39, 0.475, 0.56, 0.25, '#e3e6ee'),
    T(c, 'Diseño Gráfico · Universidad Nacional de Rosario', 0.39, 0.49, 0.56, { size: 2.2, color: '#4a5263' }),
  ]),
], 'CV Valentina Paz');

tpl('cv-clasico', 'resume', 'Currículum clásico', 'currículum cv clásico simple sin foto', (c) => [
  page('#fbfaf7', [
    T(c, 'Martín Gómez', 0.08, 0.06, 0.84, { size: 8, font: 'DM Serif Display', align: 'center' }),
    T(c, 'Ingeniero de datos · martin@correo.com · Córdoba', 0.08, 0.12, 0.84, { size: 2.3, color: '#4a5263', align: 'center' }),
    L(c, 0.08, 0.16, 0.84, 0.2, '#1f2430'),
    ...[
      ['Perfil', 'Seis años construyendo pipelines y tableros que el negocio realmente usa.'],
      ['Experiencia', 'Data Engineer · Fintech Andina (2022 – hoy)\nAnalista de datos · Retail Centro (2019 – 2022)'],
      ['Herramientas', 'Python · SQL · dbt · Airflow · PostgreSQL'],
      ['Idiomas', 'Español nativo · Inglés avanzado'],
    ].flatMap(([h, b], i) => [
      T(c, h.toUpperCase(), 0.08, 0.2 + i * 0.13, 0.24, { size: 2.5, bold: true, ls: 0.3 }),
      T(c, b, 0.33, 0.2 + i * 0.13, 0.59, { size: 2.4, color: '#4a5263', lh: 1.5 }),
    ]),
  ]),
], 'CV Martín Gómez');

tpl('info-pasos', 'infographic', 'Infografía de pasos', 'infografía pasos proceso guía', (c) => [
  page('#f3f5ff', [
    T(c, 'Cómo lanzar un producto', 0.08, 0.03, 0.84, { size: 8.5, font: 'Montserrat', bold: true, align: 'center', lh: 1.1 }),
    T(c, 'en cinco pasos', 0.08, 0.1, 0.84, { size: 5, font: 'Caveat', color: '#5b6cff', align: 'center' }),
    ...['Investigá el problema', 'Prototipá rápido', 'Probá con 5 personas', 'Lanzá algo pequeño', 'Medí y repetí'].flatMap((t, i) => [
      S(c, 'ellipse', 0.1, 0.16 + i * 0.16, 0.18, 0.072, ['#5b6cff', '#2bb3a3', '#ffc145', '#ff6b4a', '#e84a8a'][i]),
      T(c, String(i + 1), 0.1, 0.175 + i * 0.16, 0.18, { size: 6, bold: true, color: '#ffffff', align: 'center' }),
      T(c, t, 0.34, 0.17 + i * 0.16, 0.58, { size: 4.6, font: 'Montserrat', bold: true }),
      T(c, 'Una frase que explica por qué este paso importa.', 0.34, 0.2 + i * 0.16, 0.58, { size: 3, color: '#4a5263' }),
      ...(i < 4 ? [L(c, 0.188, 0.235 + i * 0.16, 0.004, 1.5, '#c9cede')] : []),
    ]),
  ]),
]);

tpl('info-datos', 'infographic', 'Infografía de datos', 'infografía estadísticas datos gráficos números', (c) => [
  page('#13302c', [
    T(c, 'El agua en números', 0.08, 0.03, 0.84, { size: 8.5, font: 'DM Serif Display', color: '#ffffff', align: 'center' }),
    G(c, 'wave', 0.1, 0.09, 0.8, ['#2bb3a3', '#bff0e8']),
    T(c, '71 %', 0.08, 0.22, 0.84, { size: 20, font: 'Bebas Neue', color: '#bff0e8', align: 'center' }),
    T(c, 'de la superficie del planeta es agua', 0.08, 0.3, 0.84, { size: 4, color: '#ffffff', align: 'center' }),
    chart(c, 'donut', 0.15, 0.36, 0.7, 0.28, { labels: ['Salada', 'Hielo', 'Dulce'], series: [{ name: 'Agua', color: '#2bb3a3', values: [97, 2, 1] }], showValues: true, textColor: '#ffffff' }),
    T(c, 'Consumo diario por persona (litros)', 0.08, 0.67, 0.84, { size: 3.6, bold: true, color: '#ffffff', align: 'center' }),
    chart(c, 'hbar', 0.08, 0.7, 0.84, 0.24, { labels: ['Ducha', 'Inodoro', 'Cocina', 'Lavarropas'], series: [{ name: 'Litros', color: '#ffc145', values: [60, 45, 20, 35] }], showValues: true, showLegend: false, textColor: '#ffffff' }),
  ]),
]);

// =========================================================================== Impresos

tpl('flyer-pizza', 'flyer', 'Flyer de pizzería', 'pizza comida restaurante promoción', (c) => [
  page('#c8281e', [
    S(c, 'ellipse', -0.3, 0.45, 1.2, 0.85, '#f6d36b'),
    S(c, 'ellipse', 0.15, 0.62, 0.22, 0.155, '#c8281e'),
    S(c, 'ellipse', 0.48, 0.55, 0.2, 0.14, '#c8281e'),
    S(c, 'ellipse', 0.3, 0.8, 0.18, 0.13, '#c8281e'),
    T(c, 'PIZZA', 0.06, 0.05, 0.88, { size: 30, font: 'Bebas Neue', color: '#f6d36b', align: 'center' }),
    T(c, 'DEL JUEVES', 0.06, 0.28, 0.88, { size: 11, font: 'Bebas Neue', color: '#ffffff', align: 'center', ls: 1 }),
    S(c, 'burst', 0.66, 0.36, 0.3, 0.212, '#ffffff', { rotation: 12, animation: 'pulse' }),
    T(c, '2×1', 0.66, 0.43, 0.3, { size: 9, font: 'Bebas Neue', color: '#c8281e', align: 'center', rotation: 12 }),
    T(c, 'Pedidos al 4555-0102 · Delivery gratis', 0.06, 0.93, 0.88, { size: 3.2, bold: true, color: '#1f2430', align: 'center' }),
  ]),
]);

tpl('flyer-yoga', 'flyer', 'Clases de yoga', 'yoga bienestar clases salud calma', (c) => [
  page('#eef3ec', [
    S(c, 'blob2', 0.45, -0.05, 0.7, 0.45, '#cfe2c8'),
    F(c, 'arch', 0.5, 0.08, 0.42, 0.4),
    T(c, 'Yoga\nal aire\nlibre', 0.07, 0.1, 0.42, { size: 13, font: 'DM Serif Display', color: '#2a5a3a', lh: 0.95 }),
    G(c, 'leaf', 0.07, 0.42, 0.12, ['#7fb06e', '#2a5a3a']),
    T(c, 'Sábados y domingos · 9 h\nParque de los Patos', 0.07, 0.56, 0.86, { size: 4.4, color: '#2a5a3a', lh: 1.5 }),
    T(c, 'Traé tu mat. Primera clase sin cargo.', 0.07, 0.68, 0.86, { size: 3.4, color: '#4a5263' }),
    R(c, 0.07, 0.83, 0.86, 0.08, '#2a5a3a', { r: 4 }),
    T(c, 'Inscribite: @yogaenelparque', 0.07, 0.852, 0.86, { size: 3.6, bold: true, color: '#ffffff', align: 'center' }),
  ]),
]);

tpl('cartel-festival', 'poster', 'Cartel de festival', 'festival música cartel concierto geométrico', (c) => [
  page('#1f2430', [
    S(c, 'ellipse', 0.1, 0.06, 0.8, 0.566, '#ff6b4a'),
    S(c, 'semicircle', 0.1, 0.26, 0.8, 0.283, '#ffc145'),
    S(c, 'triangle', 0.3, 0.2, 0.4, 0.2, '#2bb3a3'),
    T(c, 'SONORA', 0.06, 0.66, 0.88, { size: 26, font: 'Bebas Neue', color: '#ffffff', align: 'center', ls: 1 }),
    T(c, 'FESTIVAL DE MÚSICA INDEPENDIENTE', 0.06, 0.8, 0.88, { size: 3.4, font: 'Montserrat', bold: true, color: '#ffc145', align: 'center', ls: 0.6 }),
    T(c, '14 · 15 · 16 de marzo — Predio Ferial', 0.06, 0.86, 0.88, { size: 3.4, color: '#c9cede', align: 'center' }),
  ]),
]);

tpl('cartel-suizo', 'poster', 'Cartel tipográfico', 'cartel minimalista tipografía exposición arte', (c) => [
  page('#f2efe8', [
    R(c, 0.06, 0.04, 0.88, 0.5, '#e8402a'),
    T(c, 'Forma\ny vacío', 0.09, 0.07, 0.8, { size: 17, font: 'Montserrat', bold: true, color: '#f2efe8', lh: 0.9 }),
    S(c, 'ellipse', 0.55, 0.3, 0.33, 0.233, '#1f2430'),
    T(c, 'Exposición de arte contemporáneo', 0.06, 0.6, 0.5, { size: 3.6, bold: true, lh: 1.3 }),
    T(c, 'Museo de la Ciudad\nDel 2 al 30 de abril\nEntrada libre', 0.62, 0.6, 0.32, { size: 3, color: '#4a5263', lh: 1.4 }),
    L(c, 0.06, 0.92, 0.88, 0.3, '#1f2430'),
  ]),
]);

tpl('invitacion-cumple', 'invitation', 'Invitación de cumpleaños', 'cumpleaños fiesta invitación globos', (c) => [
  page('#fff1e6', [
    G(c, 'confetti', 0.05, 0.02, 0.9),
    T(c, '¡Festejemos!', 0.08, 0.2, 0.84, { size: 13, font: 'Lobster', color: '#e84a8a', align: 'center' }),
    T(c, 'Sofi cumple', 0.08, 0.37, 0.84, { size: 7, font: 'Montserrat', align: 'center' }),
    T(c, '7', 0.08, 0.43, 0.84, { size: 34, font: 'Bebas Neue', color: '#ffc145', align: 'center' }),
    T(c, 'Sábado 12 · 16 h\nSalón Arcoíris, Mitre 450', 0.08, 0.76, 0.84, { size: 5, align: 'center', lh: 1.4 }),
    T(c, 'Confirmá a mamá: 11 5555 0303', 0.08, 0.9, 0.84, { size: 4, color: '#8a93a6', align: 'center' }),
  ]),
]);

tpl('invitacion-boda', 'invitation', 'Invitación de boda', 'boda casamiento elegante invitación', (c) => [
  page('#fbf8f2', [
    S(c, 'rect', 0.05, 0.035, 0.9, 0.93, 'transparent', { stroke: '#b89b6a', sw: 0.6 }),
    G(c, 'leaf', 0.42, 0.07, 0.16, ['#b89b6a', '#8a7448']),
    T(c, 'Nos casamos', 0.08, 0.22, 0.84, { size: 6, font: 'Montserrat', color: '#8a7448', align: 'center', ls: 1 }),
    T(c, 'Julia\n&\nNicolás', 0.08, 0.31, 0.84, { size: 14, font: 'DM Serif Display', italic: true, align: 'center', lh: 1 }),
    T(c, '20 · 09 · 2027', 0.08, 0.7, 0.84, { size: 6, font: 'Montserrat', bold: true, color: '#8a7448', align: 'center', ls: 0.8 }),
    T(c, 'Estancia La Calma, San Antonio de Areco', 0.08, 0.79, 0.84, { size: 4.2, align: 'center' }),
  ]),
]);

tpl('certificado-clasico', 'certificate', 'Certificado de reconocimiento', 'certificado diploma reconocimiento curso', (c) => [
  page('#fffdf7', [
    R(c, 0.025, 0.035, 0.95, 0.93, 'transparent', { stroke: '#0b3d91', sw: 1.5 }),
    R(c, 0.04, 0.056, 0.92, 0.888, 'transparent', { stroke: '#ffc145', sw: 0.5 }),
    T(c, 'CERTIFICADO', 0.1, 0.13, 0.8, { size: 9, font: 'DM Serif Display', color: '#0b3d91', align: 'center', ls: 1 }),
    T(c, 'DE RECONOCIMIENTO', 0.1, 0.27, 0.8, { size: 3.4, font: 'Montserrat', bold: true, color: '#8a93a6', align: 'center', ls: 1 }),
    T(c, 'Se otorga a', 0.1, 0.38, 0.8, { size: 3.6, align: 'center' }),
    T(c, 'Nombre Apellido', 0.1, 0.45, 0.8, { size: 10, font: 'Caveat', bold: true, color: '#1f2430', align: 'center' }),
    L(c, 0.25, 0.62, 0.5, 0.2, '#c9cede'),
    T(c, 'por completar el curso de Diseño de Interfaces (40 horas).', 0.1, 0.66, 0.8, { size: 3.4, color: '#4a5263', align: 'center' }),
    S(c, 'burst', 0.44, 0.75, 0.12, 0.17, '#ffc145'),
    T(c, 'Firma\nDirectora', 0.08, 0.8, 0.3, { size: 2.8, align: 'center', lh: 1.4 }),
    T(c, 'Fecha\n27/10/2026', 0.62, 0.8, 0.3, { size: 2.8, align: 'center', lh: 1.4 }),
  ]),
], 'Certificado');

tpl('certificado-moderno', 'certificate', 'Certificado moderno', 'certificado moderno premio equipo', (c) => [
  page('#ffffff', [
    R(c, 0, 0, 0.3, 1, '#5b6cff'),
    S(c, 'ellipse', 0.06, 0.32, 0.18, 0.255, '#ffffff', { opacity: 0.2 }),
    G(c, 'icon-star', 0.1, 0.38, 0.1, ['#ffffff']),
    T(c, 'Premio al\nmejor equipo', 0.36, 0.14, 0.58, { size: 9, font: 'Montserrat', bold: true, lh: 1 }),
    T(c, 'Equipo Pagos', 0.36, 0.48, 0.58, { size: 7, font: 'DM Serif Display', italic: true, color: '#5b6cff' }),
    T(c, 'Por lanzar la nueva app en tiempo récord y con cero incidentes.', 0.36, 0.64, 0.56, { size: 3.2, color: '#4a5263' }),
    T(c, 'Octubre 2026', 0.36, 0.84, 0.3, { size: 3, bold: true }),
  ]),
], 'Premio al mejor equipo');

tpl('folleto-servicios', 'brochure', 'Folleto tríptico de servicios', 'folleto tríptico servicios empresa', (c) => [
  page('#ffffff', [
    R(c, 0.667, 0, 0.333, 1, '#13302c'),
    T(c, 'Huerta\nUrbana', 0.69, 0.3, 0.29, { size: 9, font: 'DM Serif Display', color: '#ffffff', align: 'center', lh: 1 }),
    G(c, 'plant', 0.77, 0.08, 0.13),
    T(c, 'Diseñamos y cuidamos huertas en terrazas y balcones.', 0.69, 0.62, 0.29, { size: 2.8, color: '#bff0e8', align: 'center' }),
    T(c, 'Quiénes somos', 0.03, 0.08, 0.28, { size: 4, bold: true, color: '#2a7a49' }),
    T(c, 'Un equipo de agrónomas y paisajistas que cree que todos pueden cosechar algo.', 0.03, 0.16, 0.28, { size: 2.6, color: '#4a5263', lh: 1.5 }),
    F(c, 'squircle', 0.03, 0.5, 0.28, 0.4),
    T(c, 'Contacto', 0.36, 0.08, 0.28, { size: 4, bold: true, color: '#2a7a49' }),
    T(c, 'hola@huertaurbana.ar\n11 5555 0404\n@huertaurbana', 0.36, 0.16, 0.28, { size: 2.8, color: '#4a5263', lh: 1.6 }),
  ], 'Exterior'),
  page('#f3f8f2', [
    ...['Diseño', 'Instalación', 'Mantenimiento'].flatMap((h, i) => [
      F(c, 'ellipse', 0.06 + i * 0.333, 0.08, 0.22, 0.31),
      T(c, h, 0.03 + i * 0.333, 0.45, 0.28, { size: 4.4, bold: true, color: '#2a7a49', align: 'center' }),
      T(c, 'Te contamos qué incluye este servicio y cuánto tiempo lleva.', 0.03 + i * 0.333, 0.53, 0.28, { size: 2.6, color: '#4a5263', align: 'center', lh: 1.5 }),
    ]),
  ], 'Interior'),
], 'Huerta Urbana');

tpl('boletin-mensual', 'newsletter', 'Boletín mensual', 'boletín newsletter noticias mensual empresa', (c) => [
  page('#ffffff', [
    R(c, 0, 0, 1, 0.14, '#ff6b4a'),
    T(c, 'El Mensual', 0.06, 0.03, 0.6, { size: 9, font: 'DM Serif Display', color: '#ffffff' }),
    T(c, 'N.º 12 · Octubre 2026', 0.6, 0.06, 0.34, { size: 2.6, color: '#ffffff', align: 'right' }),
    F(c, 'rect', 0.06, 0.17, 0.88, 0.25),
    T(c, 'Abrimos una nueva sede en Mendoza', 0.06, 0.44, 0.88, { size: 5.4, font: 'Montserrat', bold: true }),
    T(c, 'Después de dos años de trabajo remoto, el equipo de Cuyo ya tiene su espacio propio con lugar para 30 personas.', 0.06, 0.5, 0.88, { size: 2.7, color: '#4a5263', lh: 1.5 }),
    L(c, 0.06, 0.6, 0.88, 0.2, '#e3e6ee'),
    ...['Cumpleaños del mes', 'Lo que viene'].flatMap((h, i) => [
      T(c, h, 0.06 + i * 0.46, 0.63, 0.42, { size: 3.6, bold: true, color: '#ff6b4a' }),
      T(c, i === 0 ? 'Ana (4), Leo (11), Mía (23) y Tomás (30). ¡Feliz vuelta al sol!' : 'Jornada de innovación el 14/11 y cierre de año el 19/12.', 0.06 + i * 0.46, 0.67, 0.42, { size: 2.6, color: '#4a5263', lh: 1.5 }),
    ]),
    F(c, 'squircle', 0.06, 0.78, 0.42, 0.17),
    T(c, 'Foto del mes: el equipo de soporte en la feria de empleo.', 0.52, 0.8, 0.42, { size: 2.6, italic: true, color: '#4a5263', lh: 1.5 }),
  ]),
], 'El Mensual · Octubre');

tpl('remera-frase', 'tshirt', 'Remera con frase', 'remera estampa frase tipografía', (c) => [
  page('#ffffff', [
    T(c, 'HECHO', 0.05, 0.25, 0.9, { size: 26, font: 'Bebas Neue', align: 'center' }),
    T(c, 'es mejor que', 0.05, 0.45, 0.9, { size: 9, font: 'Caveat', bold: true, color: '#ff6b4a', align: 'center' }),
    T(c, 'PERFECTO', 0.05, 0.54, 0.9, { size: 26, font: 'Bebas Neue', align: 'center' }),
  ]),
]);

tpl('remera-sol', 'tshirt', 'Remera ilustrada', 'remera estampa ilustración sol verano', (c) => [
  page('#ffffff', [
    G(c, 'sun', 0.27, 0.08, 0.46),
    G(c, 'wave', 0.15, 0.42, 0.7),
    T(c, 'BUENOS DÍAS', 0.05, 0.76, 0.9, { size: 12, font: 'Montserrat', bold: true, color: '#ff8a3d', align: 'center', ls: 1 }),
  ]),
]);

function monthCells(year: number, month: number): string[][] {
  const first = new Date(year, month, 1).getDay(); // 0 = domingo
  const offset = (first + 6) % 7; // semana que empieza el lunes
  const days = new Date(year, month + 1, 0).getDate();
  const rows: string[][] = [['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']];
  let row: string[] = Array.from({ length: offset }, () => '');
  for (let d = 1; d <= days; d++) {
    row.push(String(d));
    if (row.length === 7) rows.push(row), (row = []);
  }
  if (row.length) rows.push([...row, ...Array.from({ length: 7 - row.length }, () => '')]);
  return rows;
}

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

tpl('calendario-mensual', 'calendar', 'Calendario mensual', 'calendario mes agenda planificador', (c) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return [
    page('#fffaf2', [
      F(c, 'arch', 0.04, 0.1, 0.26, 0.8),
      T(c, MONTHS[m], 0.35, 0.06, 0.4, { size: 11, font: 'DM Serif Display' }),
      T(c, String(y), 0.75, 0.09, 0.21, { size: 6, font: 'Montserrat', bold: true, color: '#ff6b4a', align: 'right' }),
      table(c, monthCells(y, m), 0.35, 0.24, 0.61, 0.7, 'header', '#ff6b4a', { fontSize: 2.6, align: 'center', borderColor: '#f1d9cf' }),
    ], MONTHS[m]),
  ];
}, 'Calendario');

// =========================================================================== Video y web

tpl('video-intro', 'video', 'Intro animada', 'video intro animación canal presentación', (c) => [
  page('#5b6cff', [
    S(c, 'ellipse', -0.1, 0.5, 0.4, 0.71, '#8a96ff', { animation: 'pulse' }),
    S(c, 'star4', 0.82, 0.12, 0.08, 0.142, '#ffc145', { animation: 'spin' }),
    T(c, 'Bienvenidos', 0.1, 0.32, 0.8, { size: 16, font: 'Montserrat', bold: true, color: '#ffffff', align: 'center', animation: 'rise' }),
    T(c, 'al canal de recetas rápidas', 0.1, 0.56, 0.8, { size: 5, color: '#ffffff', align: 'center', animation: 'fade' }),
  ], 'Intro'),
  page('#1f2430', [
    F(c, 'rect', 0.05, 0.1, 0.5, 0.8, { r: 2 }),
    T(c, 'Hoy:\nbudín de banana', 0.6, 0.3, 0.36, { size: 8, font: 'DM Serif Display', color: '#ffffff', animation: 'slide' }),
    T(c, '3 ingredientes · 40 min', 0.6, 0.62, 0.36, { size: 3.6, color: '#ffc145', animation: 'fade' }),
  ], 'Receta'),
  page('#ffc145', [
    T(c, '¡Suscribite!', 0.1, 0.35, 0.8, { size: 14, font: 'Bebas Neue', align: 'center', animation: 'pop' }),
    G(c, 'anim-bell', 0.45, 0.6, 0.1),
  ], 'Cierre'),
], 'Recetas rápidas · intro');

tpl('web-landing', 'website', 'Página de producto', 'sitio web landing página producto app', (c) => [
  page('#ffffff', [
    T(c, 'Ritmo', 0.05, 0.05, 0.2, { size: 4.6, font: 'Montserrat', bold: true, color: '#5b6cff' }),
    T(c, 'Funciones     Precios     Ayuda', 0.55, 0.06, 0.4, { size: 2.4, color: '#4a5263', align: 'right' }),
    T(c, 'Tus hábitos, a tu ritmo', 0.05, 0.25, 0.5, { size: 9, font: 'Montserrat', bold: true, lh: 1.05 }),
    T(c, 'Una app simple para sostener lo que te propusiste, sin culpa.', 0.05, 0.52, 0.42, { size: 3.4, color: '#4a5263' }),
    R(c, 0.05, 0.67, 0.18, 0.09, '#5b6cff', { r: 4 }),
    T(c, 'Probala gratis', 0.05, 0.695, 0.18, { size: 2.8, bold: true, color: '#ffffff', align: 'center' }),
    S(c, 'blob', 0.55, 0.12, 0.42, 0.8, '#eef0ff'),
    F(c, 'rect', 0.66, 0.16, 0.2, 0.72, { deco: 'phone' }),
  ], 'Inicio'),
  page('#f6f7fb', [
    T(c, 'Todo lo que necesitás', 0.05, 0.1, 0.9, { size: 6, font: 'Montserrat', bold: true, align: 'center' }),
    ...[['icon-calendar', 'Recordatorios', 'Avisos amables, a la hora que elijas.'], ['icon-star', 'Rachas', 'Mirá cuánto avanzaste en la semana.'], ['icon-chat', 'Comunidad', 'Grupos chicos para acompañarse.']].flatMap(([icon, h, b], i) => [
      R(c, 0.07 + i * 0.3, 0.3, 0.26, 0.55, '#ffffff', { r: 2 }),
      G(c, icon, 0.16 + i * 0.3, 0.36, 0.08, ['#5b6cff']),
      T(c, h, 0.09 + i * 0.3, 0.56, 0.22, { size: 3.6, bold: true, align: 'center' }),
      T(c, b, 0.09 + i * 0.3, 0.64, 0.22, { size: 2.6, color: '#4a5263', align: 'center' }),
    ]),
  ], 'Funciones'),
  page('#5b6cff', [
    T(c, 'Recibí novedades', 0.05, 0.3, 0.45, { size: 7, font: 'Montserrat', bold: true, color: '#ffffff' }),
    T(c, 'Una vez al mes, sin spam.', 0.05, 0.48, 0.45, { size: 3.4, color: '#ffffff' }),
    form(c, 'newsletter', 0.55, 0.2, 0.38),
  ], 'Contacto'),
], 'Ritmo · sitio');

tpl('fondo-degradado', 'wallpaper', 'Fondo degradado', 'fondo escritorio wallpaper degradado', (c) => [
  page('#1f2430', [
    G(c, 'grad-ocean', 0, -0.39, 1),
    S(c, 'blob', 0.6, 0.3, 0.5, 0.9, '#ffffff', { opacity: 0.08 }),
    S(c, 'blob2', -0.1, -0.2, 0.4, 0.7, '#1f2430', { opacity: 0.15 }),
    T(c, 'enfocate en una cosa', 0.06, 0.82, 0.5, { size: 3.6, font: 'Montserrat', color: '#ffffff', ls: 0.6 }),
  ]),
]);

tpl('fondo-organizador', 'wallpaper', 'Organizador de escritorio', 'fondo escritorio organizador carpetas', (c) => [
  page('#f4ede4', [
    ...['Trabajo', 'Personal', 'Proyectos', 'Archivo'].flatMap((h, i) => [
      R(c, 0.04 + i * 0.24, 0.08, 0.22, 0.84, ['#e9d7c3', '#dfe8d8', '#d8e2ef', '#efd9de'][i], { r: 1.5 }),
      T(c, h, 0.04 + i * 0.24, 0.12, 0.22, { size: 4.2, font: 'DM Serif Display', color: '#3b2a20', align: 'center' }),
    ]),
    T(c, 'ordená tus íconos en cada columna', 0.3, 0.94, 0.4, { size: 1.8, color: '#8a7448', align: 'center' }),
  ]),
]);

// =========================================================================== Educación

tpl('ficha-sumas', 'worksheet', 'Ficha de sumas', 'ficha escuela matemática sumas niños', (c) => [
  page('#ffffff', [
    T(c, 'Nombre: ______________________   Fecha: ___________', 0.07, 0.04, 0.86, { size: 2.6 }),
    T(c, '¡A sumar!', 0.07, 0.1, 0.86, { size: 9, font: 'Lobster', color: '#2bb3a3', align: 'center' }),
    G(c, 'anim-smile', 0.82, 0.08, 0.1, undefined, { animation: 'none' }),
    ...[['3 + 4', '6 + 2'], ['5 + 5', '8 + 1'], ['7 + 3', '2 + 9'], ['4 + 6', '9 + 9']].flatMap((pair, r) =>
      pair.flatMap((op, i) => [
        R(c, 0.08 + i * 0.44, 0.24 + r * 0.17, 0.4, 0.13, '#f3f8f2', { r: 2, stroke: '#2bb3a3', sw: 0.3 }),
        T(c, `${op} = ____`, 0.08 + i * 0.44, 0.28 + r * 0.17, 0.4, { size: 6, font: 'Montserrat', bold: true, align: 'center' }),
      ]),
    ),
  ]),
], 'Ficha: sumas');

tpl('ficha-lectura', 'worksheet', 'Ficha de lectura', 'ficha lectura comprensión escuela', (c) => [
  page('#fffdf7', [
    T(c, 'Comprensión lectora', 0.07, 0.05, 0.86, { size: 6, font: 'Montserrat', bold: true, color: '#8a5cff' }),
    T(c, 'Leé el texto y respondé.', 0.07, 0.1, 0.86, { size: 3, color: '#4a5263' }),
    R(c, 0.07, 0.15, 0.86, 0.22, '#f1ecff', { r: 2 }),
    T(c, 'El faro de la isla se encendía todas las noches. Una tormenta lo apagó y Lucía, la hija del farero, subió los 120 escalones con un farol para que los barcos pudieran volver.', 0.1, 0.17, 0.8, { size: 3, lh: 1.6 }),
    ...['¿Qué pasó con el faro?', '¿Quién subió los escalones?', '¿Por qué era importante encenderlo?'].flatMap((q, i) => [
      T(c, `${i + 1}. ${q}`, 0.07, 0.42 + i * 0.17, 0.86, { size: 3.2, bold: true }),
      L(c, 0.07, 0.48 + i * 0.17, 0.86, 0.2, '#c9cede', { dash: 'dashed' }),
      L(c, 0.07, 0.53 + i * 0.17, 0.86, 0.2, '#c9cede', { dash: 'dashed' }),
    ]),
  ]),
], 'Ficha: lectura');

export const TEMPLATES: Template[] = defs;

export function templatesIn(category: string): Template[] {
  return defs.filter((t) => t.category === category);
}

/** Búsqueda por nombre, etiquetas y categoría (sin distinguir tildes). */
export function searchTemplates(q: string): Template[] {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const words = norm(q).split(/\s+/).filter(Boolean);
  return defs.filter((t) => {
    const hay = norm(`${t.name} ${t.tags} ${CATEGORIES.find((c) => c.id === t.category)?.label ?? ''}`);
    return words.every((w) => hay.includes(w));
  });
}
