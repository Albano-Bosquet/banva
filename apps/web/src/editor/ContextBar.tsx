import { useEffect, useState } from 'react';
import type { Draft } from 'immer';
import {
  DECORATION_ASPECT,
  tint,
  type AnimationKind,
  type DesignElement,
  type FrameElement,
  type GraphicElement,
  type GridElement,
  type Page,
  type ShapeElement,
  type SolidElement,
  type SolidKind,
  type TableElement,
  type TextElement,
  type VideoElement,
} from '@trazo/shared';
import { useEditor } from '../store/editorStore';
import { shapeDef } from '../elements/shapeLibrary';
import { SOLID_LABELS } from '../elements/solids';
import { ANIMATION_LABELS, ENTRANCE, LOOP, usePlayback } from '../canvas/animation';
import { videoRegistry } from '../canvas/bodies';
import { useCellEdit } from '../canvas/TableCellEditor';
import { STICKY_COLORS } from '../whiteboard/tools';
import type { PanelKey } from './SidePanels';
import { Icon } from './icons';

import { FONTS } from '../canvas/fonts';
export { FONTS };

type Upd = (patch: Partial<DesignElement>, key: string) => void;
type Mut<T> = (label: string, fn: (d: Draft<T>) => void, key?: string) => void;

/** Barra contextual: cambia según el tipo de elemento seleccionado (comportamiento observado). */
export function ContextBar({ onOpenPanel }: { onOpenPanel(p: PanelKey): void }) {
  const selectedIds = useEditor((s) => s.selectedIds);
  const page = useEditor((s) => s.doc.pages.find((p) => p.id === s.activePageId)!);
  const sel = page.elements.filter((e) => selectedIds.includes(e.id));

  if (!sel.length) {
    return (
      <div className="context-bar">
        <span className="hint">Seleccioná un elemento o agregá uno desde el panel lateral.</span>
        <span className="spacer" />
        <PlayButton page={page} />
      </div>
    );
  }

  const ids = sel.map((e) => e.id);
  const first = sel[0];
  const single = sel.length === 1;
  const all = (t: DesignElement['type']) => sel.every((e) => e.type === t);
  const locked = sel.every((e) => e.locked);
  const st = useEditor.getState;
  const upd: Upd = (patch, key) => st().updateElements(ids, patch, { label: 'Propiedades', mergeKey: `${key}:${ids.join(',')}` });
  function mut<T extends DesignElement>(type: T['type']): Mut<T> {
    return (label, fn, key) =>
      st().updateElements(ids, (d) => {
        if (d.type === type) fn(d as Draft<T>);
      }, { label, mergeKey: key ? `${key}:${ids.join(',')}` : undefined });
  }

  return (
    <div className="context-bar" data-testid="context-bar">
      {all('text') && <TextControls el={first as TextElement} upd={upd} disabled={locked} />}
      {all('shape') && <ShapeControls el={first as ShapeElement} upd={upd} disabled={locked} />}
      {first.type === 'image' && single && (
        <>
          <label>
            Esquinas
            <input type="number" min={0} value={first.cornerRadius} disabled={locked} onChange={(e) => upd({ cornerRadius: Math.max(0, +e.target.value) }, 'radius')} />
          </label>
          <button className="primary small" onClick={() => onOpenPanel('photo')} data-testid="edit-photo">
            <Icon name="image" /> Editar foto
          </button>
          {first.credit && (
            <span className="credit" title={first.credit}>
              {first.credit}
            </span>
          )}
        </>
      )}
      {first.type === 'graphic' && single && <GraphicControls el={first} mut={mut<GraphicElement>('graphic')} disabled={locked} />}
      {first.type === 'chart' && single && (
        <button className="primary small" onClick={() => onOpenPanel('chart')} data-testid="edit-chart">
          <Icon name="table" /> Editar datos
        </button>
      )}
      {first.type === 'table' && single && <TableControls el={first} mut={mut<TableElement>('table')} disabled={locked} />}
      {first.type === 'frame' && single && <FrameControls el={first} mut={mut<FrameElement>('frame')} disabled={locked} />}
      {first.type === 'grid' && single && <GridControls el={first} mut={mut<GridElement>('grid')} disabled={locked} />}
      {first.type === 'solid' && single && <SolidControls el={first} mut={mut<SolidElement>('solid')} disabled={locked} />}
      {first.type === 'video' && single && <VideoControls el={first} mut={mut<VideoElement>('video')} disabled={locked} />}
      {first.type === 'sticky' && <StickyControls ids={ids} el={first} disabled={locked} />}
      {first.type === 'draw' && (
        <>
          <input type="color" value={toHex(first.stroke)} disabled={locked} onChange={(e) => st().updateElements(ids, (d) => void (d.type === 'draw' && (d.stroke = e.target.value)), { label: 'Color del trazo', mergeKey: `dc:${ids.join(',')}` })} aria-label="Color del trazo" />
        </>
      )}
      {first.type === 'form' && single && (
        <button className="primary small" onClick={() => onOpenPanel('form')} data-testid="edit-form">
          <Icon name="edit" /> Editar formulario
        </button>
      )}
      <span className="sep" />
      <AnimationSelect value={first.animation ?? 'none'} disabled={locked} onChange={(a) => st().updateElements(ids, { animation: a === 'none' ? undefined : a }, { label: 'Animación' })} pageId={page.id} />
      <label title="Transparencia">
        Opacidad
        <input type="range" min={0} max={100} value={Math.round(first.opacity * 100)} disabled={locked} onChange={(e) => upd({ opacity: +e.target.value / 100 }, 'opacity')} data-testid="opacity" />
      </label>
      <span className="sep" />
      <button className="ghost" onClick={() => onOpenPanel('position')} title="Posición y capas">
        <Icon name="position" /> Posición
      </button>
      <button className="ghost" onClick={() => st().duplicateSelected()} title="Duplicar (Ctrl+D)">
        <Icon name="copy" />
      </button>
      <button className={`ghost${locked ? ' active' : ''}`} onClick={() => st().toggleLock()} title={locked ? 'Desbloquear' : 'Bloquear'} data-testid="lock">
        <Icon name={locked ? 'lock' : 'unlock'} />
      </button>
      <button className="ghost danger" onClick={() => st().deleteSelected()} title="Eliminar (Supr)" disabled={locked}>
        <Icon name="trash" />
      </button>
    </div>
  );
}

function PlayButton({ page }: { page: Page }) {
  // Sin entradas el botón no tendría nada que mostrar: se deshabilita y explica cómo agregarlas.
  const has = page.elements.some((e) => e.visible && e.animation && ENTRANCE.includes(e.animation));
  const title = has
    ? 'Reproducir las animaciones de entrada de esta página'
    : 'Esta página no tiene animaciones de entrada: seleccioná un elemento y elegí una en Animación (Aparecer, Elevar, Saltar o Deslizar)';
  return (
    <span title={title}>
      <button className="ghost" disabled={!has} onClick={() => usePlayback.getState().play(page.id)} data-testid="play-animations">
        <Icon name="play" /> Reproducir
      </button>
    </span>
  );
}

function AnimationSelect({ value, onChange, disabled, pageId }: { value: AnimationKind; onChange(a: AnimationKind): void; disabled: boolean; pageId: string }) {
  return (
    <label title="Animación">
      <Icon name="sparkle" size={16} />
      <select
        value={value}
        disabled={disabled}
        data-testid="animation"
        onChange={(e) => {
          const a = e.target.value as AnimationKind;
          onChange(a);
          // Vista previa inmediata de las entradas.
          if (ENTRANCE.includes(a)) setTimeout(() => usePlayback.getState().play(pageId), 30);
        }}
      >
        <option value="none">Sin animación</option>
        <optgroup label="Entrada">
          {ENTRANCE.map((a) => (
            <option key={a} value={a}>
              {ANIMATION_LABELS[a]}
            </option>
          ))}
        </optgroup>
        <optgroup label="En bucle">
          {LOOP.map((a) => (
            <option key={a} value={a}>
              {ANIMATION_LABELS[a]}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}

function TextControls({ el, upd, disabled }: { el: TextElement; upd: Upd; disabled: boolean }) {
  const bold = el.fontStyle.includes('bold');
  const italic = el.fontStyle.includes('italic');
  const style = (b: boolean, i: boolean): TextElement['fontStyle'] => (b && i ? 'bold italic' : b ? 'bold' : i ? 'italic' : 'normal');
  return (
    <>
      <FontSelect value={el.fontFamily} disabled={disabled} onChange={(f) => upd({ fontFamily: f }, 'font')} />
      <button className="ghost" disabled={disabled} onClick={() => upd({ fontSize: Math.max(4, el.fontSize - 2) }, 'size')} title="Reducir tamaño">
        <Icon name="minus" size={14} />
      </button>
      <input type="number" min={4} value={Math.round(el.fontSize)} disabled={disabled} onChange={(e) => +e.target.value > 0 && upd({ fontSize: +e.target.value }, 'size')} aria-label="Tamaño de letra" data-testid="font-size" />
      <button className="ghost" disabled={disabled} onClick={() => upd({ fontSize: el.fontSize + 2 }, 'size')} title="Aumentar tamaño">
        <Icon name="plus" size={14} />
      </button>
      <input type="color" value={toHex(el.fill)} disabled={disabled} onChange={(e) => upd({ fill: e.target.value }, 'fill')} title="Color del texto" aria-label="Color del texto" />
      <span className="sep" />
      <button className={`ghost${bold ? ' active' : ''}`} disabled={disabled} onClick={() => upd({ fontStyle: style(!bold, italic) }, 'style')} title="Negrita (Ctrl+B)" data-testid="bold">
        <Icon name="bold" />
      </button>
      <button className={`ghost${italic ? ' active' : ''}`} disabled={disabled} onClick={() => upd({ fontStyle: style(bold, !italic) }, 'style')} title="Cursiva (Ctrl+I)">
        <Icon name="italic" />
      </button>
      <button className={`ghost${el.textDecoration ? ' active' : ''}`} disabled={disabled} onClick={() => upd({ textDecoration: el.textDecoration ? '' : 'underline' }, 'deco')} title="Subrayado (Ctrl+U)">
        <Icon name="underline" />
      </button>
      <button className="ghost" disabled={disabled} title="Alineación" onClick={() => upd({ align: el.align === 'left' ? 'center' : el.align === 'center' ? 'right' : 'left' }, 'align')}>
        <Icon name={el.align === 'left' ? 'alignLeft' : el.align === 'center' ? 'alignCenter' : 'alignRight'} />
      </button>
      <label title="Interlineado">
        Interl.
        <input type="number" step={0.1} min={0.5} max={4} value={el.lineHeight} disabled={disabled} onChange={(e) => +e.target.value > 0 && upd({ lineHeight: +e.target.value }, 'lh')} style={{ width: 56 }} />
      </label>
      <label title="Espaciado entre letras">
        Esp.
        <input type="number" step={0.5} value={el.letterSpacing} disabled={disabled} onChange={(e) => upd({ letterSpacing: +e.target.value || 0 }, 'ls')} style={{ width: 56 }} />
      </label>
    </>
  );
}

function FontSelect({ value, onChange, disabled }: { value: string; onChange(f: string): void; disabled: boolean }) {
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} aria-label="Tipografía" style={{ fontFamily: value }}>
      {FONTS.map((f) => (
        <option key={f} value={f} style={{ fontFamily: f }}>
          {f}
        </option>
      ))}
    </select>
  );
}

function ShapeControls({ el, upd, disabled }: { el: ShapeElement; upd: Upd; disabled: boolean }) {
  const def = shapeDef(el.shape);
  if (def.render === 'line') {
    return (
      <>
        <input type="color" value={toHex(el.fill)} disabled={disabled} onChange={(e) => upd({ fill: e.target.value }, 'fill')} aria-label="Color de línea" data-testid="fill" />
        <select value={el.dash ?? 'solid'} disabled={disabled} onChange={(e) => upd({ dash: e.target.value as ShapeElement['dash'] }, 'dash')} aria-label="Estilo de línea">
          <option value="solid">Continua</option>
          <option value="dashed">Guiones</option>
          <option value="dotted">Puntos</option>
        </select>
        <select
          value={el.arrow ?? 'none'}
          disabled={disabled}
          aria-label="Flechas"
          onChange={(e) => {
            const arrow = e.target.value as NonNullable<ShapeElement['arrow']>;
            const had = (el.arrow ?? 'none') !== 'none';
            const has = arrow !== 'none';
            // El grosor visible se conserva: con flecha la caja es 5 veces más alta.
            const height = had === has ? el.height : has ? el.height * 5 : el.height / 5;
            useEditor.getState().updateElements([el.id], { arrow, height, y: el.y + (el.height - height) / 2 }, { label: 'Flechas' });
          }}
        >
          <option value="none">Sin flechas</option>
          <option value="end">Flecha al final</option>
          <option value="both">Flechas en ambos extremos</option>
        </select>
      </>
    );
  }
  return (
    <>
      <label title="Relleno">
        <input type="color" value={toHex(el.fill)} disabled={disabled} onChange={(e) => upd({ fill: e.target.value }, 'fill')} aria-label="Color de relleno" data-testid="fill" />
      </label>
      <button className="ghost" disabled={disabled} onClick={() => upd({ fill: 'transparent' }, 'fill')} title="Sin relleno">
        Sin relleno
      </button>
      <span className="sep" />
      <label title="Borde">
        Borde
        <input type="color" value={toHex(el.stroke)} disabled={disabled} onChange={(e) => upd({ stroke: e.target.value }, 'stroke')} aria-label="Color de borde" />
        <input type="number" min={0} value={el.strokeWidth} disabled={disabled} onChange={(e) => upd({ strokeWidth: Math.max(0, +e.target.value) }, 'sw')} aria-label="Grosor del borde" />
      </label>
      {def.render === 'rect' && (
        <label title="Redondeo de esquinas">
          Esquinas
          <input type="number" min={0} value={el.cornerRadius} disabled={disabled} onChange={(e) => upd({ cornerRadius: Math.max(0, +e.target.value) }, 'radius')} />
        </label>
      )}
    </>
  );
}

/** Una muestra por cada color del SVG, como en el editor observado. */
function GraphicControls({ el, mut, disabled }: { el: GraphicElement; mut: Mut<GraphicElement>; disabled: boolean }) {
  return (
    <>
      {el.colors.map((c, i) => (
        <input key={i} type="color" value={toHex(c)} disabled={disabled} onChange={(e) => mut('Color', (d) => void (d.colors[i] = e.target.value), `gc${i}`)} title={`Color ${i + 1}`} aria-label={`Color ${i + 1}`} data-testid={`graphic-color-${i}`} />
      ))}
    </>
  );
}

const TABLE_ACCENTS = ['#4a5263', '#ff6b4a', '#ffc145', '#5b6cff', '#8a5cff', '#2bb3a3'];

function TableControls({ el, mut, disabled }: { el: TableElement; mut: Mut<TableElement>; disabled: boolean }) {
  const cell = useCellEdit((s) => (s.cell?.id === el.id ? s.cell : null));
  const rows = el.cells.length;
  const cols = el.cells[0].length;
  // Filas/columnas nuevas se insertan después de la celda en edición (o al final).
  const r = cell?.row ?? rows - 1;
  const c = cell?.col ?? cols - 1;
  const rowH = el.height / rows;
  return (
    <>
      <button className="ghost" disabled={disabled} title="Agregar fila" data-testid="table-add-row" onClick={() => mut('Agregar fila', (d) => {
        d.cells.splice(r + 1, 0, Array.from({ length: cols }, () => ''));
        d.height += rowH;
      })}>
        + Fila
      </button>
      <button className="ghost" disabled={disabled || rows <= 1} title="Quitar fila" onClick={() => mut('Quitar fila', (d) => {
        d.cells.splice(r, 1);
        d.height -= rowH;
        useCellEdit.getState().close();
      })}>
        − Fila
      </button>
      <button className="ghost" disabled={disabled} title="Agregar columna" data-testid="table-add-col" onClick={() => mut('Agregar columna', (d) => {
        const w = d.colWidths[c] ?? 1 / cols;
        for (const row of d.cells) row.splice(c + 1, 0, '');
        // Los anchos son proporciones: la columna nueva copia la actual y el resto se reparte.
        d.colWidths.splice(c + 1, 0, w);
      })}>
        + Col.
      </button>
      <button className="ghost" disabled={disabled || cols <= 1} title="Quitar columna" onClick={() => mut('Quitar columna', (d) => {
        for (const row of d.cells) row.splice(c, 1);
        d.colWidths.splice(c, 1);
        useCellEdit.getState().close();
      })}>
        − Col.
      </button>
      <span className="sep" />
      <div className="mini-swatches">
        {TABLE_ACCENTS.map((a) => (
          <button key={a} style={{ background: a }} disabled={disabled} title="Color" onClick={() => mut('Color de tabla', (d) => {
            d.accent = a;
            d.bandFill = tint(a, 0.82);
            if (d.borderColor !== '#ffffff') d.borderColor = a;
          })} />
        ))}
      </div>
      <label className="switch">
        <input type="checkbox" checked={el.headerRow} disabled={disabled} onChange={(e) => mut('Encabezado', (d) => void (d.headerRow = e.target.checked))} />
        Encabezado
      </label>
      <label className="switch">
        <input type="checkbox" checked={el.banded} disabled={disabled} onChange={(e) => mut('Bandas', (d) => void (d.banded = e.target.checked))} />
        Bandas
      </label>
      <label title="Tamaño de letra">
        Letra
        <input type="number" min={6} value={Math.round(el.fontSize)} disabled={disabled} onChange={(e) => +e.target.value > 0 && mut('Tamaño', (d) => void (d.fontSize = +e.target.value), 'tfs')} />
      </label>
      <label title="Bordes">
        Bordes
        <input type="color" value={toHex(el.borderColor)} disabled={disabled} onChange={(e) => mut('Color de bordes', (d) => void (d.borderColor = e.target.value), 'tbc')} />
        <input type="number" min={0} step={0.5} value={el.borderWidth} disabled={disabled} onChange={(e) => mut('Grosor de bordes', (d) => void (d.borderWidth = Math.max(0, +e.target.value)), 'tbw')} />
      </label>
      <button className="ghost" disabled={disabled} title="Alineación" onClick={() => mut('Alineación', (d) => void (d.align = d.align === 'left' ? 'center' : d.align === 'center' ? 'right' : 'left'))}>
        <Icon name={el.align === 'left' ? 'alignLeft' : el.align === 'center' ? 'alignCenter' : 'alignRight'} />
      </button>
    </>
  );
}

function CropControls({ zoom, offsetX, offsetY, onChange, disabled }: { zoom: number; offsetX: number; offsetY: number; onChange(p: { zoom?: number; offsetX?: number; offsetY?: number }, key: string): void; disabled: boolean }) {
  return (
    <>
      <label title="Acercar la imagen dentro del marco">
        Zoom
        <input type="range" min={100} max={300} value={Math.round(zoom * 100)} disabled={disabled} onChange={(e) => onChange({ zoom: +e.target.value / 100 }, 'fz')} data-testid="frame-zoom" />
      </label>
      <label title="Encuadre horizontal">
        ↔
        <input type="range" min={-100} max={100} value={Math.round(offsetX * 100)} disabled={disabled} onChange={(e) => onChange({ offsetX: +e.target.value / 100 }, 'fx')} />
      </label>
      <label title="Encuadre vertical">
        ↕
        <input type="range" min={-100} max={100} value={Math.round(offsetY * 100)} disabled={disabled} onChange={(e) => onChange({ offsetY: +e.target.value / 100 }, 'fy')} />
      </label>
    </>
  );
}

function FrameControls({ el, mut, disabled }: { el: FrameElement; mut: Mut<FrameElement>; disabled: boolean }) {
  return (
    <>
      {el.src ? (
        <>
          <CropControls {...el} disabled={disabled} onChange={(p, key) => mut('Encuadre', (d) => void Object.assign(d, p), key)} />
          <button className="ghost" disabled={disabled} onClick={() => mut('Quitar imagen', (d) => void (d.src = null))} title="Quitar la imagen del marco">
            Quitar imagen
          </button>
        </>
      ) : (
        <span className="hint">Soltá una imagen sobre el marco o elegila con el marco seleccionado.</span>
      )}
      {el.decoration === 'none' && el.mask === 'rect' && (
        <label>
          Esquinas
          <input type="number" min={0} value={el.cornerRadius} disabled={disabled} onChange={(e) => mut('Esquinas', (d) => void (d.cornerRadius = Math.max(0, +e.target.value)), 'fr')} />
        </label>
      )}
      {el.decoration !== 'none' && el.decoration !== 'poster' && el.decoration !== 'polaroid' && (
        <label title="Color del objeto">
          Color
          <input type="color" value={toHex(el.tint)} disabled={disabled} onChange={(e) => mut('Color del mockup', (d) => void (d.tint = e.target.value), 'ft')} />
        </label>
      )}
      {el.decoration !== 'none' && Math.abs(el.width / el.height - DECORATION_ASPECT[el.decoration]) > 0.02 && (
        <button className="ghost" disabled={disabled} onClick={() => mut('Proporción', (d) => void (d.height = d.width / DECORATION_ASPECT[d.decoration]))}>
          Restaurar proporción
        </button>
      )}
    </>
  );
}

function GridControls({ el, mut, disabled }: { el: GridElement; mut: Mut<GridElement>; disabled: boolean }) {
  const [cellIndex, setCellIndex] = useState(0);
  useEffect(() => setCellIndex(0), [el.id]);
  const filled = el.cells.map((c, i) => ({ c, i })).filter((x) => x.c.src);
  const cell = el.cells[cellIndex];
  return (
    <>
      <label title="Separación entre celdas">
        Separación
        <input type="range" min={0} max={Math.round(Math.min(el.width, el.height) * 0.06)} value={el.gap} disabled={disabled} onChange={(e) => mut('Separación', (d) => void (d.gap = +e.target.value), 'gg')} data-testid="grid-gap" />
      </label>
      <label>
        Esquinas
        <input type="number" min={0} value={el.cornerRadius} disabled={disabled} onChange={(e) => mut('Esquinas', (d) => void (d.cornerRadius = Math.max(0, +e.target.value)), 'gr')} />
      </label>
      {filled.length > 0 && (
        <>
          <span className="sep" />
          <select value={cellIndex} onChange={(e) => setCellIndex(+e.target.value)} aria-label="Celda">
            {el.cells.map((_, i) => (
              <option key={i} value={i}>
                Celda {i + 1}
              </option>
            ))}
          </select>
          {cell?.src && (
            <>
              <CropControls {...cell} disabled={disabled} onChange={(p, key) => mut('Encuadre', (d) => void Object.assign(d.cells[cellIndex], p), `${key}${cellIndex}`)} />
              <button className="ghost" disabled={disabled} onClick={() => mut('Vaciar celda', (d) => void (d.cells[cellIndex].src = null))}>
                Vaciar
              </button>
            </>
          )}
        </>
      )}
    </>
  );
}

function SolidControls({ el, mut, disabled }: { el: SolidElement; mut: Mut<SolidElement>; disabled: boolean }) {
  return (
    <>
      <select value={el.solid} disabled={disabled} onChange={(e) => mut('Forma 3D', (d) => void (d.solid = e.target.value as SolidKind))} aria-label="Forma 3D">
        {(Object.keys(SOLID_LABELS) as SolidKind[]).map((k) => (
          <option key={k} value={k}>
            {SOLID_LABELS[k]}
          </option>
        ))}
      </select>
      <input type="color" value={toHex(el.color)} disabled={disabled} onChange={(e) => mut('Color', (d) => void (d.color = e.target.value), 'sc')} aria-label="Color" />
      <label title="Girar horizontalmente">
        Giro
        <input type="range" min={-180} max={180} value={Math.round(el.yaw)} disabled={disabled} onChange={(e) => mut('Girar 3D', (d) => void (d.yaw = +e.target.value), 'sy')} data-testid="solid-yaw" />
      </label>
      <label title="Inclinar">
        Inclinación
        <input type="range" min={-80} max={80} value={Math.round(el.pitch)} disabled={disabled} onChange={(e) => mut('Inclinar 3D', (d) => void (d.pitch = +e.target.value), 'sp')} />
      </label>
    </>
  );
}

function VideoControls({ el, mut, disabled }: { el: VideoElement; mut: Mut<VideoElement>; disabled: boolean }) {
  const [, force] = useState(0);
  const video = videoRegistry.get(el.id);
  useEffect(() => {
    if (!video) return;
    const bump = () => force((n) => n + 1);
    video.addEventListener('play', bump);
    video.addEventListener('pause', bump);
    return () => {
      video.removeEventListener('play', bump);
      video.removeEventListener('pause', bump);
    };
  }, [video]);
  const playing = video && !video.paused;
  return (
    <>
      <button className="ghost" onClick={() => (playing ? video?.pause() : void video?.play())} title={playing ? 'Pausar' : 'Reproducir'} data-testid="video-play">
        <Icon name={playing ? 'pause' : 'play'} /> {playing ? 'Pausar' : 'Reproducir'}
      </button>
      <label className="switch">
        <input type="checkbox" checked={!el.muted} disabled={disabled} onChange={(e) => mut('Sonido', (d) => void (d.muted = !e.target.checked))} />
        Sonido
      </label>
      <label className="switch">
        <input type="checkbox" checked={el.loop} disabled={disabled} onChange={(e) => mut('Repetir', (d) => void (d.loop = e.target.checked))} />
        Repetir
      </label>
      <label>
        Esquinas
        <input type="number" min={0} value={el.cornerRadius} disabled={disabled} onChange={(e) => mut('Esquinas', (d) => void (d.cornerRadius = Math.max(0, +e.target.value)), 'vr')} />
      </label>
    </>
  );
}

function toHex(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : '#ffffff';
}

function StickyControls({ ids, el, disabled }: { ids: string[]; el: Extract<DesignElement, { type: 'sticky' }>; disabled: boolean }) {
  const st = useEditor.getState;
  const upd = (label: string, fn: (d: Draft<Extract<DesignElement, { type: 'sticky' }>>) => void, key?: string) =>
    st().updateElements(ids, (d) => {
      if (d.type === 'sticky') fn(d);
    }, { label, mergeKey: key ? `${key}:${ids.join(',')}` : undefined });
  return (
    <>
      <div className="mini-swatches" title="Color de la nota">
        {STICKY_COLORS.map((c) => (
          <button key={c} style={{ background: c, outline: el.color === c ? '2px solid #3d5afe' : undefined }} disabled={disabled} onClick={() => upd('Color de la nota', (d) => void (d.color = c))} aria-label={`Nota ${c}`} data-testid="sticky-color" />
        ))}
      </div>
      <button className="ghost" disabled={disabled} onClick={() => upd('Tamaño', (d) => void (d.fontSize = Math.max(8, d.fontSize - 2)), 'sfs')} title="Letra más chica">
        <Icon name="minus" size={14} />
      </button>
      <span style={{ minWidth: 22, textAlign: 'center' }}>{el.fontSize}</span>
      <button className="ghost" disabled={disabled} onClick={() => upd('Tamaño', (d) => void (d.fontSize = Math.min(72, d.fontSize + 2)), 'sfs')} title="Letra más grande">
        <Icon name="plus" size={14} />
      </button>
      <button className="ghost" disabled={disabled} onClick={() => st().setEditingText(el.id)} title="Editar texto (doble clic)">
        <Icon name="edit" /> Editar
      </button>
    </>
  );
}
