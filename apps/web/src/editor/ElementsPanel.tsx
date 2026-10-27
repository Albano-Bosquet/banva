import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CHART_COLORS,
  DECORATION_ASPECT,
  FORM_PRESETS,
  GRID_LAYOUTS,
  createChart,
  createForm,
  createFrame,
  createGraphic,
  createGrid,
  createShape,
  createSolid,
  createTable,
  tint,
  type ChartType,
  type FormPreset,
  type FrameDecoration,
  type SolidKind,
  type TableStyle,
} from '@trazo/shared';
import { useEditor } from '../store/editorStore';
import { SHAPES, SHAPE_CATEGORIES, shapePath, type ShapeDef } from '../elements/shapeLibrary';
import { GRAPHICS, GRAPHIC_CATEGORIES, graphicDataUrl, type GraphicDef } from '../elements/graphicsLibrary';
import { SOLID_LABELS, drawSolid } from '../elements/solids';
import { DECORATIONS } from '../elements/mockups';
import { SHEET_TEMPLATES } from '../elements/sheets';
import { renderPage } from '../canvas/stageRegistry';
import { AudioPanel, PhotosPanel, VideosPanel } from './MediaPanels';
import { useUploads } from './uploads';
import { Icon } from './icons';
import type { PanelKey } from './SidePanels';

export type CategoryKey =
  | 'shapes'
  | 'graphics'
  | 'animations'
  | 'photos'
  | 'videos'
  | 'audio'
  | 'charts'
  | 'forms'
  | 'sheets'
  | 'tables'
  | 'frames'
  | 'grids'
  | 'mockups'
  | 'solids';

/** Íconos de categoría propios: mosaico de color con un pictograma simple. */
const CATEGORIES: { key: CategoryKey; label: string; bg: [string, string]; glyph: string }[] = [
  { key: 'shapes', label: 'Formas', bg: ['#2bb3a3', '#5b6cff'], glyph: '<rect x="6" y="20" width="12" height="12" rx="2" fill="#fff"/><path d="M27 8l8 14H19z" fill="#ffd36b"/><circle cx="29" cy="30" r="6" fill="#fff" opacity=".85"/>' },
  { key: 'graphics', label: 'Ilustraciones', bg: ['#ff8a3d', '#ff6b4a'], glyph: '<circle cx="20" cy="18" r="8" fill="#ffd36b"/><path d="M8 34c6-10 12-10 16-4 3-4 7-4 10 4z" fill="#3fae6b"/>' },
  { key: 'animations', label: 'Animaciones', bg: ['#ffc145', '#ff8a3d'], glyph: '<circle cx="20" cy="20" r="11" fill="#fff"/><circle cx="16" cy="17" r="2" fill="#1f2430"/><circle cx="24" cy="17" r="2" fill="#1f2430"/><path d="M14 23c3 4 9 4 12 0" stroke="#1f2430" stroke-width="2" fill="none"/><path d="M33 8l2 4M36 15h4M6 30l-3 2" stroke="#fff" stroke-width="2"/>' },
  { key: 'photos', label: 'Fotos', bg: ['#5b6cff', '#8a96ff'], glyph: '<rect x="7" y="9" width="26" height="22" rx="3" fill="#fff"/><path d="M9 29l8-9 6 6 4-4 4 7z" fill="#5b6cff"/><circle cx="26" cy="15" r="3" fill="#ffc145"/>' },
  { key: 'videos', label: 'Videos', bg: ['#e84a8a', '#8a5cff'], glyph: '<circle cx="20" cy="20" r="12" fill="#fff"/><path d="M17 14l9 6-9 6z" fill="#e84a8a"/>' },
  { key: 'audio', label: 'Audio', bg: ['#ff6b4a', '#e84a8a'], glyph: '<path d="M16 28V12l14-3v16" stroke="#fff" stroke-width="3" fill="none"/><circle cx="13" cy="28" r="4" fill="#fff"/><circle cx="27" cy="25" r="4" fill="#fff"/>' },
  { key: 'charts', label: 'Gráficos', bg: ['#2bb3a3', '#3fae6b'], glyph: '<rect x="8" y="20" width="6" height="12" fill="#fff"/><rect x="17" y="12" width="6" height="20" fill="#fff"/><rect x="26" y="16" width="6" height="16" fill="#ffd36b"/>' },
  { key: 'forms', label: 'Formularios', bg: ['#3fae6b', '#2bb3a3'], glyph: '<rect x="7" y="10" width="26" height="7" rx="3.5" fill="#fff"/><rect x="7" y="22" width="26" height="8" rx="4" fill="#1d6b3e"/><path d="M11 26l2 2 4-4" stroke="#fff" stroke-width="2" fill="none"/>' },
  { key: 'sheets', label: 'Hojas de cálculo', bg: ['#5b6cff', '#2bb3a3'], glyph: '<rect x="7" y="8" width="26" height="24" rx="2" fill="#fff"/><path d="M7 15h26M7 22h26M16 8v24M25 8v24" stroke="#5b6cff" stroke-width="1.5"/><text x="9" y="14" font-size="5" fill="#5b6cff" font-family="Arial">f(x)</text>' },
  { key: 'tables', label: 'Tablas', bg: ['#ff8a3d', '#ffc145'], glyph: '<rect x="7" y="9" width="26" height="22" rx="2" fill="#fff"/><rect x="7" y="9" width="26" height="6" fill="#ff6b4a"/><path d="M7 22h26M16 9v22M25 9v22" stroke="#ff8a3d" stroke-width="1.5"/>' },
  { key: 'frames', label: 'Marcos', bg: ['#3fae6b', '#8ad0a4'], glyph: '<path d="M20 6c7 0 13 6 13 14s-6 14-13 14S7 28 7 20 13 6 20 6z" fill="#dbe7f3"/><path d="M8 26c5-6 9-6 12-2 3-3 7-3 12 2-2 5-7 8-12 8s-10-3-12-8z" fill="#3fae6b"/>' },
  { key: 'grids', label: 'Cuadrículas', bg: ['#8a5cff', '#e84a8a'], glyph: '<rect x="7" y="7" width="12" height="26" rx="1.5" fill="#fff"/><rect x="21" y="7" width="12" height="12" rx="1.5" fill="#fff" opacity=".85"/><rect x="21" y="21" width="12" height="12" rx="1.5" fill="#fff" opacity=".7"/>' },
  { key: 'mockups', label: 'Mockups', bg: ['#2bb3a3', '#5b6cff'], glyph: '<path d="M13 9l-7 4 3 6 3-2v15h16V17l3 2 3-6-7-4c-1 2-3 3-7 3s-6-1-7-3z" fill="#fff"/><rect x="16" y="17" width="8" height="7" fill="#ffc145"/>' },
  { key: 'solids', label: '3D', bg: ['#8a5cff', '#5b6cff'], glyph: '<path d="M20 6l12 7v14l-12 7-12-7V13z" fill="#c9c2ff"/><path d="M20 20l12-7v14l-12 7z" fill="#8a5cff"/><path d="M20 20L8 13v14l12 7z" fill="#fff"/>' },
];

const tile = (c: (typeof CATEGORIES)[number]) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.bg[0]}"/><stop offset="1" stop-color="${c.bg[1]}"/></linearGradient></defs><rect width="40" height="40" rx="10" fill="url(#g)"/>${c.glyph}</svg>`;

export function ElementsPanel({ openPanel }: { openPanel(p: PanelKey): void }) {
  const [cat, setCat] = useState<CategoryKey | null>(null);
  const [q, setQ] = useState('');
  const current = CATEGORIES.find((c) => c.key === cat);

  return (
    <div className="elements-panel" data-testid="elements-panel">
      <div className="panel-head">
        {cat && (
          <button className="ghost" onClick={() => setCat(null)} title="Volver a las categorías" data-testid="elements-back">
            <Icon name="back" />
          </button>
        )}
        {cat ? <h3>{current?.label}</h3> : <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar elementos" aria-label="Buscar elementos" data-testid="elements-search" />}
      </div>
      {!cat && !q.trim() && (
        <>
          <h3>Explorá las categorías</h3>
          <div className="category-grid">
            {CATEGORIES.map((c) => (
              <button key={c.key} className="category" onClick={() => setCat(c.key)} data-testid={`cat-${c.key}`}>
                <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(tile(c))}`} alt="" />
                <span>{c.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {!cat && q.trim() && <SearchResults q={q.trim()} onCategory={setCat} />}
      {cat === 'shapes' && <ShapesCategory />}
      {cat === 'graphics' && <GraphicsCategory only={['Ilustraciones', 'Degradados', 'Íconos']} />}
      {cat === 'animations' && <GraphicsCategory only={['Animados']} />}
      {cat === 'photos' && <PhotosPanel />}
      {cat === 'videos' && <VideosPanel />}
      {cat === 'audio' && <AudioPanel />}
      {cat === 'charts' && <ChartsCategory onEdit={() => openPanel('chart')} />}
      {cat === 'forms' && <FormsCategory />}
      {cat === 'sheets' && <SheetsCategory />}
      {cat === 'tables' && <TablesCategory />}
      {cat === 'frames' && <FramesCategory />}
      {cat === 'grids' && <GridsCategory />}
      {cat === 'mockups' && <MockupsCategory />}
      {cat === 'solids' && <SolidsCategory />}
    </div>
  );
}

const add = (el: Parameters<ReturnType<typeof useEditor.getState>['addElement']>[0]) => useEditor.getState().addElement(el);
const doc = () => useEditor.getState().doc;

// --------------------------------------------------------------------------- búsqueda

function matches(q: string, ...texts: string[]) {
  const n = q.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  return texts.some((t) => t.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').includes(n));
}

function SearchResults({ q, onCategory }: { q: string; onCategory(c: CategoryKey): void }) {
  const shapes = SHAPES.filter((s) => matches(q, s.label, s.category));
  const graphics = GRAPHICS.filter((g) => matches(q, g.label, g.tags, g.category));
  const cats = CATEGORIES.filter((c) => matches(q, c.label));
  return (
    <>
      {cats.length > 0 && (
        <div className="chips">
          {cats.map((c) => (
            <button key={c.key} className="chip" onClick={() => onCategory(c.key)}>
              {c.label}
            </button>
          ))}
        </div>
      )}
      {shapes.length > 0 && (
        <>
          <h3>Formas</h3>
          <ShapeTiles items={shapes} />
        </>
      )}
      {graphics.length > 0 && (
        <>
          <h3>Ilustraciones e íconos</h3>
          <GraphicTiles items={graphics} />
        </>
      )}
      {!shapes.length && !graphics.length && <p className="kbd">No hay elementos para "{q}".</p>}
      <button className="chip wide" onClick={() => onCategory('photos')}>
        Buscar fotos en el banco abierto →
      </button>
    </>
  );
}

// --------------------------------------------------------------------------- formas

function ShapeTiles({ items }: { items: ShapeDef[] }) {
  return (
    <div className="tile-grid">
      {items.map((s, i) => (
        <button
          key={`${s.key}-${i}`}
          className="tile"
          title={s.label}
          aria-label={s.label}
          data-testid={`shape-${s.key}${s.preset ? `-${Object.values(s.preset).join('-')}` : ''}`}
          onClick={() => add(createShape(doc(), s.key, s.preset as never))}
        >
          <ShapeIcon def={s} />
        </button>
      ))}
    </div>
  );
}

function ShapeIcon({ def }: { def: ShapeDef }) {
  if (def.render === 'line') {
    const p = (def.preset ?? {}) as { arrow?: string; dash?: string };
    return (
      <svg viewBox="0 0 100 100">
        <line x1="10" y1="50" x2={p.arrow ? 78 : 90} y2="50" stroke="#1f2430" strokeWidth="6" strokeDasharray={p.dash === 'dashed' ? '14 9' : p.dash === 'dotted' ? '0.1 12' : undefined} strokeLinecap={p.dash === 'dotted' ? 'round' : 'butt'} />
        {p.arrow && <path d="M76 38 L94 50 L76 62 Z" fill="#1f2430" />}
        {p.arrow === 'both' && <path d="M24 38 L6 50 L24 62 Z" fill="#1f2430" />}
      </svg>
    );
  }
  const radius = (def.preset?.cornerRadius as number | undefined) ? 18 : 0;
  return (
    <svg viewBox="-6 -6 112 112">
      {def.render === 'rect' ? <rect width="100" height="100" rx={radius} fill="#2bb3a3" /> : <path d={shapePath(def.key)} fill="#2bb3a3" />}
    </svg>
  );
}

function ShapesCategory() {
  return (
    <>
      {SHAPE_CATEGORIES.map((c) => (
        <section key={c}>
          <h3>{c}</h3>
          <ShapeTiles items={SHAPES.filter((s) => s.category === c)} />
        </section>
      ))}
      <p className="kbd">Atajos: R rectángulo · C círculo · L línea</p>
    </>
  );
}

// --------------------------------------------------------------------------- ilustraciones / animados

function GraphicTiles({ items }: { items: GraphicDef[] }) {
  return (
    <div className="tile-grid">
      {items.map((g) => (
        <button
          key={g.id}
          className={`tile${g.animation ? ' animated' : ''}`}
          title={g.label}
          aria-label={g.label}
          data-testid={`graphic-${g.id}`}
          onClick={() => add(createGraphic(doc(), g.svg, g.colors, g.aspect ?? 1, g.animation ? { animation: g.animation } : {}))}
        >
          <img src={graphicDataUrl(g.svg, g.colors)} alt="" className={g.animation ? `anim-${g.animation}` : undefined} />
        </button>
      ))}
    </div>
  );
}

function GraphicsCategory({ only }: { only: GraphicDef['category'][] }) {
  return (
    <>
      {GRAPHIC_CATEGORIES.filter((c) => only.includes(c)).map((c) => (
        <section key={c}>
          <h3>{c}</h3>
          <GraphicTiles items={GRAPHICS.filter((g) => g.category === c)} />
        </section>
      ))}
      {only.includes('Animados') && <p className="kbd">Cualquier elemento puede animarse con el selector de animación (✦) de la barra superior.</p>}
    </>
  );
}

// --------------------------------------------------------------------------- gráficos de datos

const CHARTS: { type: ChartType; label: string; svg: string }[] = [
  { type: 'bar', label: 'Barras verticales', svg: '<rect x="12" y="50" width="16" height="40" fill="#5b6cff"/><rect x="36" y="25" width="16" height="65" fill="#5b6cff"/><rect x="60" y="40" width="16" height="50" fill="#5b6cff"/>' },
  { type: 'hbar', label: 'Barras horizontales', svg: '<rect x="10" y="14" width="60" height="16" fill="#5b6cff"/><rect x="10" y="40" width="80" height="16" fill="#5b6cff"/><rect x="10" y="66" width="44" height="16" fill="#5b6cff"/>' },
  { type: 'stacked', label: 'Barras apiladas', svg: '<rect x="14" y="40" width="18" height="50" fill="#5b6cff"/><rect x="14" y="20" width="18" height="20" fill="#ff6b4a"/><rect x="42" y="50" width="18" height="40" fill="#5b6cff"/><rect x="42" y="30" width="18" height="20" fill="#ff6b4a"/><rect x="70" y="35" width="18" height="55" fill="#5b6cff"/><rect x="70" y="15" width="18" height="20" fill="#ff6b4a"/>' },
  { type: 'line', label: 'Líneas', svg: '<polyline points="8,80 32,50 56,62 92,20" fill="none" stroke="#5b6cff" stroke-width="6"/><polyline points="8,88 32,74 56,48 92,58" fill="none" stroke="#ff6b4a" stroke-width="6"/>' },
  { type: 'area', label: 'Área', svg: '<path d="M8 90 L8 70 L32 40 L56 55 L92 20 L92 90 Z" fill="#5b6cff" opacity=".6"/><path d="M8 90 L8 80 L32 70 L56 60 L92 65 L92 90 Z" fill="#ff6b4a" opacity=".6"/>' },
  { type: 'pie', label: 'Torta', svg: '<circle cx="50" cy="50" r="40" fill="#5b6cff"/><path d="M50 50 L50 10 A40 40 0 0 1 88 62 Z" fill="#ff6b4a"/><path d="M50 50 L88 62 A40 40 0 0 1 40 89 Z" fill="#2bb3a3"/>' },
  { type: 'donut', label: 'Anillo', svg: '<circle cx="50" cy="50" r="32" fill="none" stroke="#5b6cff" stroke-width="16"/><path d="M50 18 A32 32 0 0 1 80 60" fill="none" stroke="#ffc145" stroke-width="16"/>' },
];

function ChartsCategory({ onEdit }: { onEdit(): void }) {
  const insert = (type: ChartType, edit = false) => {
    const el = createChart(doc(), type);
    add(el);
    if (edit) onEdit();
  };
  return (
    <>
      <button className="primary" onClick={() => insert('bar', true)} data-testid="chart-own-data">
        <Icon name="table" /> Crear con mis datos
      </button>
      <div className="tile-grid labeled">
        {CHARTS.map((c) => (
          <button key={c.type} className="tile" title={c.label} onClick={() => insert(c.type)} data-testid={`chart-${c.type}`}>
            <svg viewBox="0 0 100 100" dangerouslySetInnerHTML={{ __html: c.svg }} />
            <span>{c.label}</span>
          </button>
        ))}
      </div>
      <p className="kbd">Seleccioná un gráfico y tocá "Editar datos" para cambiar valores, series y estilo.</p>
    </>
  );
}

// --------------------------------------------------------------------------- formularios

function FormsCategory() {
  return (
    <>
      <div className="stack">
        {(Object.keys(FORM_PRESETS) as FormPreset[]).map((k) => {
          const p = FORM_PRESETS[k];
          return (
            <button key={k} className="form-preview" style={{ background: p.background, color: p.textColor }} onClick={() => add(createForm(doc(), k))} data-testid={`form-${k}`}>
              <strong>{p.title}</strong>
              {p.fields.map((f) => (
                <span key={f.id} className="fp-field">
                  {f.kind === 'rating' ? '★★★★☆' : f.kind === 'choice' ? (f.options ?? []).map((o) => `○ ${o}`).join('  ') : f.label}
                </span>
              ))}
              <span className="fp-btn" style={{ background: p.accent }}>
                {p.submitLabel}
              </span>
            </button>
          );
        })}
      </div>
      <p className="kbd">Los formularios se completan en la vista "Presentar"; las respuestas se ven desde la barra superior del elemento.</p>
    </>
  );
}

// --------------------------------------------------------------------------- hojas de cálculo y tablas

function SheetsCategory() {
  return (
    <>
      <div className="stack">
        {SHEET_TEMPLATES.map((t) => (
          <button
            key={t.id}
            className="sheet-preview"
            onClick={() => {
              const el = createTable(doc(), t.cells.length, t.cells[0].length, 'banded', t.accent, { cells: structuredClone(t.cells), colWidths: t.colWidths ?? t.cells[0].map(() => 1 / t.cells[0].length) });
              add(el);
            }}
            data-testid={`sheet-${t.id}`}
          >
            <span className="sp-title" style={{ background: t.accent }}>
              {t.label}
            </span>
            <span className="sp-desc">{t.description}</span>
          </button>
        ))}
      </div>
      <p className="kbd">Fórmulas: =SUMA(B2:B5), =PROMEDIO(…), =MIN, =MAX, =CONTAR, =REDONDEAR, + − × ÷. Doble clic en una celda para editarla; Tab y Enter avanzan.</p>
    </>
  );
}

const TABLE_COLORS = ['#4a5263', '#ff6b4a', '#ffc145', '#5b6cff', '#8a5cff'];
const TABLE_STYLES: TableStyle[] = ['plain', 'header', 'banded'];

function TablePreview({ style, color }: { style: TableStyle; color: string }) {
  return (
    <span className={`table-preview ${style}`} style={{ ['--c' as string]: color, ['--band' as string]: tint(color, 0.75) }}>
      {Array.from({ length: 12 }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}

function TablesCategory() {
  return (
    <>
      <div className="tile-grid">
        {TABLE_COLORS.flatMap((color) =>
          TABLE_STYLES.map((style) => (
            <button key={`${color}-${style}`} className="tile" title="Insertar tabla" onClick={() => add(createTable(doc(), 4, 3, style, color))} data-testid={`table-${style}-${color.slice(1)}`}>
              <TablePreview style={style} color={color} />
            </button>
          )),
        )}
      </div>
      <p className="kbd">Doble clic en una celda para escribir. Las celdas que empiezan con "=" calculan fórmulas.</p>
    </>
  );
}

// --------------------------------------------------------------------------- marcos, cuadrículas y mockups

const FRAME_MASKS: { mask: string; label: string }[] = [
  { mask: 'rect', label: 'Cuadrado' },
  { mask: 'squircle', label: 'Redondeado' },
  { mask: 'ellipse', label: 'Círculo' },
  { mask: 'arch', label: 'Arco' },
  { mask: 'heart', label: 'Corazón' },
  { mask: 'star', label: 'Estrella' },
  { mask: 'hexagon', label: 'Hexágono' },
  { mask: 'diamond', label: 'Rombo' },
  { mask: 'blob', label: 'Orgánico' },
  { mask: 'blob2', label: 'Orgánico 2' },
  { mask: 'flower', label: 'Flor' },
  { mask: 'cloud', label: 'Nube' },
  { mask: 'drop', label: 'Gota' },
  { mask: 'burst', label: 'Explosión' },
  { mask: 'bubble-round', label: 'Globo' },
];

const LANDSCAPE = '<rect width="100" height="100" fill="#dbe7f3"/><circle cx="72" cy="30" r="9" fill="#fff"/><path d="M0 100 L32 55 L55 80 L75 62 L100 100 Z" fill="#9cc58a"/>';

function FrameIcon({ mask }: { mask: string }) {
  const id = `m-${mask}`;
  return (
    <svg viewBox="-4 -4 108 108">
      <defs>
        <clipPath id={id}>
          <path d={shapePath(mask)} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`} dangerouslySetInnerHTML={{ __html: LANDSCAPE }} />
    </svg>
  );
}

function FramesCategory() {
  return (
    <>
      <h3>Formas</h3>
      <div className="tile-grid">
        {FRAME_MASKS.map((m) => (
          <button key={m.mask} className="tile" title={m.label} onClick={() => add(createFrame(doc(), m.mask))} data-testid={`frame-${m.mask}`}>
            <FrameIcon mask={m.mask} />
          </button>
        ))}
      </div>
      <h3>Foto y película</h3>
      <DecorationTiles items={['polaroid', 'film', 'poster']} />
      <h3>Dispositivos</h3>
      <DecorationTiles items={['phone', 'tablet', 'laptop', 'monitor']} />
      <p className="kbd">Arrastrá una imagen o una foto sobre el marco, o seleccioná el marco y elegí la imagen.</p>
    </>
  );
}

/** Miniatura de una decoración dibujada con el mismo código que el lienzo. */
function DecorationIcon({ deco }: { deco: FrameDecoration }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    const aspect = DECORATION_ASPECT[deco];
    const W = 72;
    const H = 72;
    const w = aspect >= 1 ? W : W * aspect;
    const h = aspect >= 1 ? H / aspect : H;
    c.clearRect(0, 0, W, H);
    c.save();
    c.translate((W - w) / 2, (H - h) / 2);
    const d = DECORATIONS[deco];
    const tintColor = deco === 'tshirt' || deco === 'mug' ? '#f4f4f6' : '#1f2430';
    d.under?.(c, w, h, tintColor);
    c.fillStyle = '#dbe7f3';
    const s = d.screen;
    c.beginPath();
    c.roundRect(s.x * w, s.y * h, s.w * w, s.h * h, s.r * w);
    c.fill();
    c.fillStyle = '#9cc58a';
    c.beginPath();
    c.moveTo(s.x * w, (s.y + s.h) * h);
    c.lineTo((s.x + s.w * 0.35) * w, (s.y + s.h * 0.55) * h);
    c.lineTo((s.x + s.w) * w, (s.y + s.h) * h);
    c.fill();
    d.over?.(c, w, h, tintColor);
    c.restore();
  }, [deco]);
  return <canvas ref={ref} width={72} height={72} />;
}

function DecorationTiles({ items, page }: { items: FrameDecoration[]; page?: string | null }) {
  const insert = async (deco: FrameDecoration) => {
    const el = createFrame(doc(), 'rect', deco);
    if (page) el.src = await pageImage(page);
    add(el);
  };
  return (
    <div className="tile-grid labeled">
      {items.map((d) => (
        <button key={d} className="tile" title={DECORATIONS[d].label} onClick={() => insert(d)} data-testid={`mockup-${d}`}>
          <DecorationIcon deco={d} />
          <span>{DECORATIONS[d].label}</span>
        </button>
      ))}
    </div>
  );
}

/** Imagen de una página del diseño, subida como archivo para no inflar el documento. */
const pageImages = new WeakMap<object, Promise<string | null>>();
function pageImage(pageId: string): Promise<string | null> {
  // Immer conserva el mismo objeto mientras la página no cambie: se reutiliza la imagen subida.
  const page = doc().pages.find((p) => p.id === pageId);
  if (!page) return Promise.resolve(null);
  let pending = pageImages.get(page);
  if (!pending) {
    pending = renderAndUpload(pageId);
    pageImages.set(page, pending);
  }
  return pending;
}

async function renderAndUpload(pageId: string): Promise<string | null> {
  const url = renderPage(pageId, { scale: Math.min(1, 1600 / Math.max(doc().width, doc().height)), mime: 'image/png' });
  if (!url) return null;
  const blob = await (await fetch(url)).blob();
  return useUploads.getState().upload(blob, 'pagina.png');
}

function GridsCategory() {
  return (
    <>
      <div className="tile-grid">
        {GRID_LAYOUTS.map((l) => (
          <button key={l.id} className="tile grid-preview" title={`Cuadrícula de ${l.cells.length}`} onClick={() => add(createGrid(doc(), l.id))} data-testid={`grid-${l.id}`}>
            {l.cells.map(([x, y, w, h], i) => (
              <i key={i} style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }} />
            ))}
          </button>
        ))}
      </div>
      <p className="kbd">Las cuadrículas ocupan toda la página. Soltá imágenes en cada celda.</p>
    </>
  );
}

function MockupsCategory() {
  const pages = useEditor((s) => s.doc.pages);
  const [page, setPage] = useState<string | null>(null);
  return (
    <>
      <label className="field">
        Rellenar con
        <select value={page ?? ''} onChange={(e) => setPage(e.target.value || null)} data-testid="mockup-source">
          <option value="">Imagen de ejemplo (después soltá la tuya)</option>
          {pages.map((p, i) => (
            <option key={p.id} value={p.id}>
              Página {i + 1} de este diseño
            </option>
          ))}
        </select>
      </label>
      <h3>Dispositivos</h3>
      <DecorationTiles items={['phone', 'tablet', 'laptop', 'monitor']} page={page} />
      <h3>Productos e impresos</h3>
      <DecorationTiles items={['tshirt', 'mug', 'poster', 'polaroid']} page={page} />
    </>
  );
}

// --------------------------------------------------------------------------- 3D

const SOLID_COLORS = ['#5b6cff', '#ff6b4a', '#2bb3a3', '#ffc145', '#e84a8a', '#8a5cff', '#f4f4f6', '#3fae6b'];

function SolidIcon({ kind, color }: { kind: SolidKind; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    c.clearRect(0, 0, 72, 72);
    drawSolid(c, kind, color, 35, 25, 72, 72);
  }, [kind, color]);
  return <canvas ref={ref} width={72} height={72} />;
}

function SolidsCategory() {
  const kinds = Object.keys(SOLID_LABELS) as SolidKind[];
  const [color, setColor] = useState(SOLID_COLORS[0]);
  const items = useMemo(() => kinds.map((k) => ({ k, label: SOLID_LABELS[k] })), [kinds]);
  return (
    <>
      <div className="swatches">
        {SOLID_COLORS.map((c) => (
          <button key={c} style={{ background: c }} className={c === color ? 'active' : ''} onClick={() => setColor(c)} aria-label={`Color ${c}`} />
        ))}
      </div>
      <div className="tile-grid labeled">
        {items.map(({ k, label }) => (
          <button key={k} className="tile" title={label} onClick={() => add(createSolid(doc(), k, color))} data-testid={`solid-${k}`}>
            <SolidIcon kind={k} color={color} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <p className="kbd">Girá el objeto con los controles de la barra superior. La animación "Girar" lo rota sobre su eje.</p>
    </>
  );
}

export { CHART_COLORS };
