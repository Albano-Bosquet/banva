import type { AnimationKind } from '@trazo/shared';

/**
 * Ilustraciones, íconos, degradados y stickers animados originales de Banva.
 * Cada SVG usa un viewBox propio y marcadores {{0}}, {{1}}… para los colores
 * editables (la barra contextual muestra una muestra por color, como en el editor observado).
 */
export interface GraphicDef {
  id: string;
  label: string;
  category: GraphicCategory;
  svg: string;
  colors: string[];
  /** Ancho / alto. */
  aspect?: number;
  tags: string;
  animation?: AnimationKind;
}

export type GraphicCategory = 'Ilustraciones' | 'Degradados' | 'Íconos' | 'Animados';

const svg = (body: string, vb = '0 0 100 100') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${body}</svg>`;

const ILLUSTRATIONS_RAW: Omit<GraphicDef, 'category'>[] = [
  {
    id: 'sun',
    label: 'Sol',
    tags: 'sol verano calor cielo',
    colors: ['#ffc145', '#ff8a3d'],
    svg: svg(
      `<g stroke="{{1}}" stroke-width="6" stroke-linecap="round">${Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        return `<line x1="${50 + Math.cos(a) * 32}" y1="${50 + Math.sin(a) * 32}" x2="${50 + Math.cos(a) * 46}" y2="${50 + Math.sin(a) * 46}"/>`;
      }).join('')}</g><circle cx="50" cy="50" r="24" fill="{{0}}"/>`,
    ),
  },
  {
    id: 'cloud',
    label: 'Nube',
    tags: 'nube cielo clima',
    colors: ['#ffffff', '#a9c7ff'],
    aspect: 1.6,
    svg: svg(`<path d="M30 56c-11 0-20-7-20-17s9-17 20-17c3-11 13-19 26-19 14 0 25 9 27 22 9 1 17 8 17 16 0 9-8 15-18 15z" fill="{{0}}" stroke="{{1}}" stroke-width="4"/>`, '0 0 110 68'),
  },
  {
    id: 'leaf',
    label: 'Hoja',
    tags: 'hoja planta naturaleza verde',
    colors: ['#3fae6b', '#1d6b3e'],
    svg: svg(`<path d="M15 85C15 40 45 12 88 12c0 46-28 76-73 73z" fill="{{0}}"/><path d="M15 85L70 30M40 60l-2-14M52 48l-1-13M40 60l15 1M52 48l14 1" stroke="{{1}}" stroke-width="4" stroke-linecap="round" fill="none"/>`),
  },
  {
    id: 'flower',
    label: 'Flor',
    tags: 'flor primavera naturaleza',
    colors: ['#ff7aa8', '#ffc145', '#3fae6b'],
    svg: svg(
      `<path d="M50 60v36" stroke="{{2}}" stroke-width="5"/><path d="M50 84c-12-2-18-10-18-18 10 0 18 8 18 18z" fill="{{2}}"/>${Array.from({ length: 6 }, (_, i) => `<ellipse cx="50" cy="20" rx="12" ry="18" fill="{{0}}" transform="rotate(${i * 60} 50 40)"/>`).join('')}<circle cx="50" cy="40" r="11" fill="{{1}}"/>`,
    ),
  },
  {
    id: 'mountains',
    label: 'Montañas',
    tags: 'montaña paisaje viaje naturaleza',
    colors: ['#5b6cff', '#8a96ff', '#ffffff', '#ffc145'],
    aspect: 1.5,
    svg: svg(`<circle cx="112" cy="22" r="11" fill="{{3}}"/><path d="M0 100L48 30l52 70z" fill="{{0}}"/><path d="M60 100l42-52 48 52z" fill="{{1}}"/><path d="M48 30l-12 17 7 4 5-6 6 7 8-4z" fill="{{2}}"/>`, '0 0 150 100'),
  },
  {
    id: 'wave',
    label: 'Ola',
    tags: 'ola mar agua playa',
    colors: ['#2bb3a3', '#bff0e8'],
    aspect: 2,
    svg: svg(`<path d="M0 30c25 0 25-20 50-20s25 20 50 20 25-20 50-20 25 20 50 20v70H0z" fill="{{0}}"/><path d="M0 50c25 0 25-14 50-14s25 14 50 14 25-14 50-14 25 14 50 14" stroke="{{1}}" stroke-width="5" fill="none"/>`, '0 0 200 100'),
  },
  {
    id: 'coffee',
    label: 'Taza de café',
    tags: 'café taza bebida mañana',
    colors: ['#ff6b4a', '#6b3f2a', '#c9c9d1'],
    svg: svg(`<path d="M38 8c-6 8 6 10 0 18M54 8c-6 8 6 10 0 18" stroke="{{2}}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M18 34h56v30c0 15-12 26-28 26S18 79 18 64z" fill="{{0}}"/><path d="M74 42h6a10 10 0 0 1 0 20h-7" stroke="{{0}}" stroke-width="7" fill="none"/><ellipse cx="46" cy="35" rx="28" ry="5" fill="{{1}}"/>`),
  },
  {
    id: 'rocket',
    label: 'Cohete',
    tags: 'cohete espacio lanzamiento startup',
    colors: ['#f4f4f6', '#e84a8a', '#5b6cff', '#ffc145'],
    svg: svg(`<path d="M50 96l-9-16h18z" fill="{{3}}"/><path d="M50 4c16 12 20 34 16 62H34C30 38 34 16 50 4z" fill="{{0}}"/><path d="M34 52l-14 18 2 10 14-8zM66 52l14 18-2 10-14-8z" fill="{{1}}"/><circle cx="50" cy="38" r="9" fill="{{2}}" stroke="{{1}}" stroke-width="4"/><path d="M38 66h24v8H38z" fill="{{1}}"/>`),
  },
  {
    id: 'plant',
    label: 'Planta en maceta',
    tags: 'planta maceta casa verde',
    colors: ['#3fae6b', '#ff8a3d', '#2a7a49'],
    svg: svg(`<path d="M50 62V30" stroke="{{2}}" stroke-width="4"/><path d="M50 44C36 44 24 34 22 18c16 0 28 10 28 26zM50 38c0-16 12-28 28-28 0 16-12 28-28 28zM50 56c-10-2-18-10-18-20 10 2 18 10 18 20z" fill="{{0}}"/><path d="M28 62h44l-6 32H34z" fill="{{1}}"/><rect x="24" y="58" width="52" height="9" rx="3" fill="{{1}}"/>`),
  },
  {
    id: 'bulb',
    label: 'Idea',
    tags: 'idea foco lampara creatividad',
    colors: ['#ffc145', '#4a5263'],
    svg: svg(`<path d="M50 6a30 30 0 0 0-18 54c4 3 6 8 6 12h24c0-4 2-9 6-12A30 30 0 0 0 50 6z" fill="{{0}}"/><path d="M38 78h24M40 86h20M44 94h12" stroke="{{1}}" stroke-width="5" stroke-linecap="round"/><path d="M42 40l8 10 8-10" stroke="{{1}}" stroke-width="3" fill="none"/>`),
  },
  {
    id: 'gift',
    label: 'Regalo',
    tags: 'regalo cumpleaños fiesta caja',
    colors: ['#e84a8a', '#ffc145'],
    svg: svg(`<rect x="14" y="40" width="72" height="54" rx="4" fill="{{0}}"/><rect x="8" y="28" width="84" height="16" rx="3" fill="{{0}}"/><path d="M44 28h12v66H44z" fill="{{1}}"/><path d="M50 28c-6-16-24-20-24-8 0 6 12 8 24 8zM50 28c6-16 24-20 24-8 0 6-12 8-24 8z" fill="none" stroke="{{1}}" stroke-width="5"/>`),
  },
  {
    id: 'camera',
    label: 'Cámara',
    tags: 'cámara foto fotografía',
    colors: ['#1f2430', '#8a96ff', '#ff6b4a'],
    aspect: 1.25,
    svg: svg(`<path d="M10 26h22l8-12h40l8 12h22v58H10z" fill="{{0}}" transform="translate(-5 0) scale(0.9 1)"/><circle cx="58" cy="54" r="22" fill="{{1}}" stroke="#ffffff" stroke-width="5"/><circle cx="58" cy="54" r="9" fill="{{0}}"/><circle cx="96" cy="36" r="4" fill="{{2}}"/>`, '0 0 120 96'),
  },
  {
    id: 'rainbow',
    label: 'Arcoíris',
    tags: 'arcoíris colores cielo',
    colors: ['#ff6b4a', '#ffc145', '#2bb3a3', '#5b6cff'],
    aspect: 2,
    svg: svg(`<g fill="none" stroke-width="12"><path d="M10 100a90 90 0 0 1 180 0" stroke="{{0}}"/><path d="M22 100a78 78 0 0 1 156 0" stroke="{{1}}"/><path d="M34 100a66 66 0 0 1 132 0" stroke="{{2}}"/><path d="M46 100a54 54 0 0 1 108 0" stroke="{{3}}"/></g>`, '0 0 200 100'),
  },
  {
    id: 'cactus',
    label: 'Cactus',
    tags: 'cactus planta desierto',
    colors: ['#3fae6b', '#e8b07a'],
    aspect: 0.8,
    svg: svg(`<path d="M32 70V22a8 8 0 0 1 16 0v48zM32 48H22a8 8 0 0 1-8-8V30a5 5 0 0 1 10 0v8h8M48 56h10a8 8 0 0 0 8-8V36a5 5 0 0 0-10 0v10h-8" fill="{{0}}"/><path d="M18 70h44l-6 28H24z" fill="{{1}}"/>`, '0 0 80 100'),
  },
  {
    id: 'planet',
    label: 'Planeta',
    tags: 'planeta espacio saturno',
    colors: ['#8a5cff', '#ffc145'],
    aspect: 1.4,
    svg: svg(`<circle cx="70" cy="50" r="30" fill="{{0}}"/><ellipse cx="70" cy="50" rx="62" ry="14" fill="none" stroke="{{1}}" stroke-width="6" transform="rotate(-18 70 50)"/><path d="M40 50a30 30 0 0 0 60 0" fill="{{0}}" transform="rotate(-18 70 50)"/>`, '0 0 140 100'),
  },
  {
    id: 'badge',
    label: 'Sello',
    tags: 'sello insignia oferta nuevo',
    colors: ['#ff6b4a', '#ffffff'],
    svg: svg(`<path d="${starPath(18, 48, 40)}" fill="{{0}}"/><circle cx="50" cy="50" r="30" fill="none" stroke="{{1}}" stroke-width="3" stroke-dasharray="4 4"/>`),
  },
  {
    id: 'confetti',
    label: 'Confeti',
    tags: 'confeti fiesta celebración',
    colors: ['#ff6b4a', '#5b6cff', '#ffc145', '#2bb3a3'],
    svg: svg(`<rect x="10" y="14" width="10" height="5" rx="2" fill="{{0}}" transform="rotate(30 15 16)"/><rect x="62" y="8" width="10" height="5" rx="2" fill="{{1}}" transform="rotate(-20 67 10)"/><circle cx="40" cy="30" r="4" fill="{{2}}"/><rect x="80" y="40" width="10" height="5" rx="2" fill="{{3}}" transform="rotate(50 85 42)"/><circle cx="20" cy="60" r="4" fill="{{1}}"/><rect x="45" y="62" width="10" height="5" rx="2" fill="{{0}}" transform="rotate(-40 50 64)"/><circle cx="76" cy="80" r="4" fill="{{2}}"/><rect x="18" y="84" width="10" height="5" rx="2" fill="{{3}}" transform="rotate(15 23 86)"/><path d="M60 40q5-6 10 0t10 0" stroke="{{0}}" stroke-width="3" fill="none"/>`),
  },
  {
    id: 'squiggle',
    label: 'Garabato',
    tags: 'garabato línea decoración trazo',
    colors: ['#1f2430'],
    aspect: 3,
    svg: svg(`<path d="M6 30c15-30 30 30 45 0s30-30 45 0 30 30 45 0 30-30 45 0 30 30 45 0" stroke="{{0}}" stroke-width="6" fill="none" stroke-linecap="round"/>`, '0 0 300 60'),
  },
];
const ILLUSTRATIONS: GraphicDef[] = ILLUSTRATIONS_RAW.map((g) => ({ ...g, category: 'Ilustraciones' }));

function starPath(points: number, outer: number, inner: number): string {
  return (
    Array.from({ length: points * 2 }, (_, i) => {
      const a = (-90 + (180 / points) * i) * (Math.PI / 180);
      const rad = i % 2 ? inner : outer;
      return `${i ? 'L' : 'M'}${(50 + Math.cos(a) * rad).toFixed(1)} ${(50 + Math.sin(a) * rad).toFixed(1)}`;
    }).join(' ') + 'Z'
  );
}

const grad = (id: string, label: string, colors: string[], angle: 'h' | 'v' | 'd' | 'r'): GraphicDef => {
  const stops = colors.map((_, i) => `<stop offset="${(i / (colors.length - 1)) * 100}%" stop-color="{{${i}}}"/>`).join('');
  const coords = angle === 'h' ? 'x1="0" y1="0" x2="1" y2="0"' : angle === 'v' ? 'x1="0" y1="0" x2="0" y2="1"' : 'x1="0" y1="0" x2="1" y2="1"';
  const def = angle === 'r' ? `<radialGradient id="g">${stops}</radialGradient>` : `<linearGradient id="g" ${coords}>${stops}</linearGradient>`;
  return { id, label, category: 'Degradados', tags: 'degradado fondo color', colors, svg: svg(`<defs>${def}</defs><rect width="100" height="100" fill="url(#g)"/>`) };
};

const GRADIENTS: GraphicDef[] = [
  grad('grad-sunset', 'Atardecer', ['#ff6b4a', '#ffc145'], 'd'),
  grad('grad-ocean', 'Océano', ['#2bb3a3', '#5b6cff'], 'v'),
  grad('grad-berry', 'Frutos rojos', ['#e84a8a', '#8a5cff'], 'h'),
  grad('grad-mono', 'Gris', ['#1f2430', '#ffffff'], 'v'),
  grad('grad-glow', 'Brillo', ['#ffffff', '#ffc145'], 'r'),
  grad('grad-mint', 'Menta', ['#bff0e8', '#ffffff', '#ffd6e6'], 'd'),
];

/** Íconos de trazo (24×24), un color. */
const ICON_PATHS: [string, string, string][] = [
  ['heart', 'Corazón', 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z'],
  ['star', 'Estrella', 'M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1L3.2 9.4l6.1-.8z'],
  ['check', 'Tilde', 'M5 12l5 5L20 7'],
  ['mail', 'Correo', 'M3 6h18v12H3zM3 6l9 7 9-7'],
  ['phone', 'Teléfono', 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z'],
  ['pin', 'Ubicación', 'M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
  ['calendar', 'Calendario', 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5'],
  ['clock', 'Reloj', 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2'],
  ['cart', 'Carrito', 'M3 4h2l2.5 11h11L21 8H7M10 20h.01M17 20h.01'],
  ['user', 'Persona', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0'],
  ['chat', 'Mensaje', 'M4 5h16v11H9l-5 4z'],
  ['music', 'Música', 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'],
  ['camera', 'Cámara', 'M3 8h4l2-3h6l2 3h4v11H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  ['globe', 'Mundo', 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18'],
  ['bolt', 'Rayo', 'M13 2L4 14h7l-1 8 9-12h-7z'],
  ['leaf', 'Hoja', 'M5 19C5 10 11 4 20 4c0 9-6 15-15 15zM5 19l8-8'],
  ['home', 'Casa', 'M3 11l9-7 9 7v9H3z M10 20v-5h4v5'],
  ['gift', 'Regalo', 'M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-2-4-6-4-6-1 0 1 3 1 6 1zM12 7c2-4 6-4 6-1 0 1-3 1-6 1z'],
  ['bell', 'Campana', 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0'],
  ['search', 'Buscar', 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5'],
  ['sun', 'Sol', 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5'],
  ['moon', 'Luna', 'M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z'],
  ['arrow', 'Flecha', 'M4 12h16M14 6l6 6-6 6'],
  ['sparkle', 'Destello', 'M12 3l2 7 7 2-7 2-2 7-2-7-7-2 7-2z'],
];

const ICONS: GraphicDef[] = ICON_PATHS.map(([id, label, d]) => ({
  id: `icon-${id}`,
  label,
  category: 'Íconos',
  tags: `ícono ${label.toLowerCase()}`,
  colors: ['#1f2430'],
  svg: svg(`<path d="${d}" fill="none" stroke="{{0}}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`, '0 0 24 24'),
}));

const ANIMATED: GraphicDef[] = [
  { id: 'anim-sparkle', label: 'Destello', category: 'Animados', tags: 'destello brillo animado', animation: 'spin', colors: ['#ffc145'], svg: svg(`<path d="M50 0l10 38 40 12-40 12-10 38-10-38L0 50l40-12z" fill="{{0}}"/>`) },
  { id: 'anim-heart', label: 'Corazón latiendo', category: 'Animados', tags: 'corazón amor animado', animation: 'pulse', colors: ['#e84a8a'], svg: svg(`<path d="M50 92C20 70 0 52 0 30 0 12 13 0 28 0c10 0 18 6 22 14C54 6 62 0 72 0c15 0 28 12 28 30 0 22-20 40-50 62z" fill="{{0}}"/>`) },
  { id: 'anim-arrow', label: 'Flecha que rebota', category: 'Animados', tags: 'flecha abajo animado', animation: 'bounce', colors: ['#5b6cff'], aspect: 0.7, svg: svg(`<path d="M25 0h20v60h20L35 100 5 60h20z" fill="{{0}}"/>`, '0 0 70 100') },
  {
    id: 'anim-smile',
    label: 'Cara feliz',
    category: 'Animados',
    tags: 'emoji cara feliz sonrisa animado',
    animation: 'wiggle',
    colors: ['#ffc145', '#1f2430'],
    svg: svg(`<circle cx="50" cy="50" r="46" fill="{{0}}"/><circle cx="34" cy="40" r="6" fill="{{1}}"/><circle cx="66" cy="40" r="6" fill="{{1}}"/><path d="M28 60c10 16 34 16 44 0" stroke="{{1}}" stroke-width="6" fill="none" stroke-linecap="round"/>`),
  },
  {
    id: 'anim-wow',
    label: '¡Guau!',
    category: 'Animados',
    tags: 'palabra wow guau texto animado',
    animation: 'pulse',
    colors: ['#ff6b4a', '#ffffff'],
    aspect: 1.3,
    svg: svg(`<path d="${starPath(14, 48, 36)}" fill="{{0}}" transform="scale(1.3 1)"/><text x="65" y="60" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="26" fill="{{1}}">¡GUAU!</text>`, '0 0 130 100'),
  },
  {
    id: 'anim-bell',
    label: 'Campana',
    category: 'Animados',
    tags: 'campana notificación animado',
    animation: 'wiggle',
    colors: ['#ffc145', '#ff8a3d'],
    svg: svg(`<path d="M50 10a28 28 0 0 0-28 28v24l-8 12h72l-8-12V38a28 28 0 0 0-28-28z" fill="{{0}}"/><circle cx="50" cy="84" r="9" fill="{{1}}"/><rect x="45" y="2" width="10" height="10" rx="5" fill="{{1}}"/>`),
  },
  {
    id: 'anim-note',
    label: 'Nota musical',
    category: 'Animados',
    tags: 'música nota canción animado',
    animation: 'bounce',
    colors: ['#8a5cff'],
    svg: svg(`<path d="M38 74V18l46-10v54" stroke="{{0}}" stroke-width="8" fill="none"/><ellipse cx="28" cy="76" rx="14" ry="11" fill="{{0}}"/><ellipse cx="74" cy="64" rx="14" ry="11" fill="{{0}}"/>`),
  },
  {
    id: 'anim-sun',
    label: 'Sol girando',
    category: 'Animados',
    tags: 'sol verano animado',
    animation: 'spin',
    colors: ['#ff8a3d', '#ffc145'],
    svg: svg(`<path d="${starPath(12, 48, 34)}" fill="{{0}}"/><circle cx="50" cy="50" r="28" fill="{{1}}"/>`),
  },
];

export const GRAPHICS: GraphicDef[] = [...ILLUSTRATIONS, ...GRADIENTS, ...ICONS, ...ANIMATED];
export const GRAPHIC_CATEGORIES: GraphicCategory[] = ['Ilustraciones', 'Degradados', 'Íconos', 'Animados'];

/** Sustituye los marcadores de color y devuelve un data URL listo para dibujar. */
export function graphicDataUrl(svgTemplate: string, colors: string[]): string {
  const filled = svgTemplate.replace(/\{\{(\d+)\}\}/g, (_, i) => colors[+i] ?? '#000000');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(filled)}`;
}
