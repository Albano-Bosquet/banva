import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createBlock, type Block, type BlockType } from '@trazo/shared';
import { useEditor } from '../store/editorStore';
import { useUploads } from '../editor/uploads';
import { Icon } from '../editor/icons';
import { sanitizeHtml, textOf } from './sanitize';
import { MARKDOWN, insertBlockAfter, mergeWithPrevious, moveBlock, removeBlock, setBlockType, splitBlock, updateBlock, useDocFocus } from './ops';

/** Opciones del menú "/" (las mismas familias que el editor observado, sin las de IA). */
export const BLOCK_MENU: { type: BlockType; label: string; hint?: string; keys: string; email?: boolean }[] = [
  { type: 'h1', label: 'Título', hint: 'Ctrl+Alt+1', keys: 'titulo h1 encabezado' },
  { type: 'h2', label: 'Subtítulo', hint: 'Ctrl+Alt+2', keys: 'subtitulo h2' },
  { type: 'h3', label: 'Encabezado', hint: 'Ctrl+Alt+3', keys: 'encabezado h3' },
  { type: 'p', label: 'Cuerpo', hint: 'Ctrl+Alt+0', keys: 'cuerpo parrafo texto' },
  { type: 'table', label: 'Tabla', keys: 'tabla' },
  { type: 'divider', label: 'Divisor', keys: 'divisor linea separador' },
  { type: 'pagebreak', label: 'Salto de página', hint: 'Ctrl+Entrar', keys: 'salto pagina' },
  { type: 'check', label: 'Lista de control', keys: 'lista control tareas check' },
  { type: 'bullet', label: 'Lista con viñetas', keys: 'lista viñetas' },
  { type: 'number', label: 'Lista numerada', keys: 'lista numerada' },
  { type: 'columns', label: '2 columnas', keys: 'columnas' },
  { type: 'callout', label: 'Bloque destacado', keys: 'destacado nota callout' },
  { type: 'quote', label: 'Cita', keys: 'cita' },
  { type: 'image', label: 'Imagen', keys: 'imagen foto' },
  { type: 'chart', label: 'Gráfico', keys: 'grafico barras torta lineas' },
  { type: 'button', label: 'Botón', keys: 'boton enlace' },
];

const TEXTUAL: BlockType[] = ['p', 'h1', 'h2', 'h3', 'bullet', 'number', 'check', 'quote', 'callout'];
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

interface Slash {
  blockId: string;
  query: string;
  x: number;
  y: number;
  index: number;
}

export function DocEditor({ kind }: { kind: 'doc' | 'email' }) {
  const blocks = useEditor((s) => s.doc.blocks ?? EMPTY);
  const width = useEditor((s) => s.doc.width);
  const [zoom, setZoom] = useState(1);
  const scroller = useRef<HTMLDivElement>(null);
  // Zoom inicial: la página entra en el ancho disponible (como "ajustar" del editor).
  useLayoutEffect(() => {
    const avail = (scroller.current?.clientWidth ?? width) - 48;
    if (avail < width) setZoom(Math.max(0.5, Math.floor((avail / width) * 20) / 20));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [slash, setSlash] = useState<Slash | null>(null);
  const [panel, setPanel] = useState<'insert' | 'outline' | null>('insert');
  const [focused, setFocused] = useState<string | null>(null);

  // El documento nunca queda sin bloques.
  useEffect(() => {
    if (!useEditor.getState().doc.blocks?.length) useEditor.getState().commit('Iniciar documento', (d) => void (d.blocks = [createBlock('p')]), { skipHistory: true });
  }, []);

  const numbering = useMemo(() => {
    const out = new Map<string, number>();
    let n = 0;
    for (const b of blocks) {
      n = b.type === 'number' ? n + 1 : 0;
      if (b.type === 'number') out.set(b.id, n);
    }
    return out;
  }, [blocks]);

  const words = useMemo(() => blocks.reduce((s, b) => s + (textOf([b.html ?? '', ...(b.rows?.flat() ?? []), ...(b.cols ?? [])].join(' ')).match(/\S+/g)?.length ?? 0), 0), [blocks]);
  const menuItems = BLOCK_MENU.filter((m) => kind === 'doc' || m.type !== 'pagebreak');
  const filtered = slash ? menuItems.filter((m) => norm(m.label + ' ' + m.keys).includes(norm(slash.query))) : [];

  const pick = (type: BlockType) => {
    if (!slash) return;
    // Se borra el "/consulta" que se escribió en el bloque.
    const b = useEditor.getState().doc.blocks?.find((x) => x.id === slash.blockId);
    if (b) updateBlock(b.id, { html: (b.html ?? '').replace(/\/[^/]*$/, '') }, { label: 'Menú /' });
    setBlockType(slash.blockId, type);
    setSlash(null);
  };

  const insertAtEnd = (type: BlockType) => {
    const list = useEditor.getState().doc.blocks ?? [];
    const target = focused && list.some((b) => b.id === focused) ? focused : list[list.length - 1]?.id ?? null;
    const cur = list.find((b) => b.id === target);
    if (cur && TEXTUAL.includes(cur.type) && !textOf(cur.html ?? '').trim() && TEXTUAL.includes(type)) return setBlockType(cur.id, type);
    if (cur && !textOf(cur.html ?? '').trim() && TEXTUAL.includes(cur.type)) return setBlockType(cur.id, type);
    const nb = createBlock(type);
    insertBlockAfter(target, nb);
    if (type === 'divider' || type === 'pagebreak') insertBlockAfter(nb.id, createBlock('p'));
  };

  return (
    <div className={`doc-editor ${kind}`} data-testid="doc-editor">
      <nav className="rail">
        <button className={panel === 'insert' ? 'active' : ''} onClick={() => setPanel(panel === 'insert' ? null : 'insert')} data-testid="doc-rail-insert">
          <Icon name="plus" />
          Insertar
        </button>
        <button className={panel === 'outline' ? 'active' : ''} onClick={() => setPanel(panel === 'outline' ? null : 'outline')} data-testid="doc-rail-outline">
          <Icon name="alignLeft" />
          Esquema
        </button>
      </nav>
      {panel && (
        <aside className="panel">
          {panel === 'insert' ? (
            <>
              <h3>Insertar bloque</h3>
              <div className="block-palette">
                {menuItems.map((m) => (
                  <button key={m.type + m.label} onMouseDown={(e) => e.preventDefault()} onClick={() => insertAtEnd(m.type)} data-testid={`insert-${m.type}`}>
                    <BlockIcon type={m.type} />
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="kbd">También podés escribir "/" en un párrafo vacío, o usar atajos: "# " título, "- " lista, "1. " numerada, "[] " tareas, "&gt; " cita.</p>
            </>
          ) : (
            <Outline blocks={blocks} />
          )}
        </aside>
      )}
      <main className="doc-workspace">
        <FormatBar focused={focused} />
        <div className="doc-scroller" ref={scroller}>
          <article className="doc-page" style={{ width, zoom }} data-testid="doc-page">
            {blocks.map((b, i) => (
              <BlockView key={b.id} block={b} index={i} number={numbering.get(b.id)} onSlash={setSlash} slashOpen={slash?.blockId === b.id} onFocus={setFocused} kind={kind} />
            ))}
            <div className="doc-tail" onClick={() => {
              const last = blocks[blocks.length - 1];
              if (last && TEXTUAL.includes(last.type) && !textOf(last.html ?? '').trim()) useDocFocus.getState().request(last.id, 'end');
              else insertBlockAfter(last?.id ?? null, createBlock('p'));
            }} />
          </article>
        </div>
        <footer className="bottombar">
          <span data-testid="word-count">{words} {words === 1 ? 'palabra' : 'palabras'}</span>
          <span className="spacer" />
          <button className="ghost" onClick={() => setZoom(Math.max(0.5, +(zoom - 0.1).toFixed(2)))} title="Alejar">
            <Icon name="minus" size={14} />
          </button>
          <span style={{ width: 44, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
          <button className="ghost" onClick={() => setZoom(Math.min(2, +(zoom + 0.1).toFixed(2)))} title="Acercar">
            <Icon name="plus" size={14} />
          </button>
        </footer>
      </main>
      {slash && (
        <SlashMenu
          slash={slash}
          items={filtered}
          onPick={pick}
          onClose={() => setSlash(null)}
          onMove={(d) => setSlash({ ...slash, index: (slash.index + d + Math.max(1, filtered.length)) % Math.max(1, filtered.length) })}
        />
      )}
    </div>
  );
}

const EMPTY: Block[] = [];

// --------------------------------------------------------------------------- bloques

interface BlockProps {
  block: Block;
  index: number;
  number?: number;
  kind: 'doc' | 'email';
  slashOpen: boolean;
  onSlash(s: Slash | null): void;
  onFocus(id: string): void;
}

const BlockView = memo(function BlockView(p: BlockProps) {
  const { block } = p;
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      className={`block-row${dragOver ? ' drop' : ''}`}
      data-block-id={block.id}
      data-type={block.type}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('text/x-trazo-block')) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        const id = e.dataTransfer.getData('text/x-trazo-block');
        setDragOver(false);
        if (id && id !== block.id) moveBlock(id, p.index);
      }}
    >
      <div className="block-handle">
        <button className="ghost" title="Agregar un bloque debajo" onClick={() => insertBlockAfter(block.id, createBlock('p'))} tabIndex={-1}>
          <Icon name="plus" size={14} />
        </button>
        <span className="grip" draggable onDragStart={(e) => e.dataTransfer.setData('text/x-trazo-block', block.id)} title="Arrastrar para mover">
          <Icon name="grip" size={14} />
        </span>
      </div>
      <div className="block-body">
        <BlockBody {...p} />
      </div>
      {!TEXTUAL.includes(block.type) && (
        <button className="ghost block-delete" title="Eliminar bloque" onClick={() => removeBlock(block.id)}>
          <Icon name="trash" size={14} />
        </button>
      )}
    </div>
  );
});

function BlockBody(p: BlockProps) {
  const { block } = p;
  switch (block.type) {
    case 'divider':
      return <hr className="doc-divider" />;
    case 'pagebreak':
      return <div className="doc-pagebreak">Salto de página</div>;
    case 'table':
      return <TableBlock block={block} />;
    case 'image':
      return <ImageBlock block={block} />;
    case 'chart':
      return <ChartBlock block={block} />;
    case 'button':
      return <ButtonBlock block={block} onFocus={p.onFocus} />;
    case 'columns':
      return (
        <div className="doc-columns" style={{ gridTemplateColumns: `repeat(${block.cols?.length ?? 2}, 1fr)` }}>
          {(block.cols ?? []).map((html, i) => (
            <RichText
              key={i}
              blockId={`${block.id}:${i}`}
              html={html}
              className="doc-col"
              placeholder="Escribí en esta columna"
              onChange={(v) => {
                const cols = [...(block.cols ?? [])];
                cols[i] = v;
                updateBlock(block.id, { cols }, { mergeKey: `col:${block.id}:${i}` });
              }}
              onFocus={() => p.onFocus(block.id)}
            />
          ))}
        </div>
      );
    default:
      return <TextBlock {...p} />;
  }
}

const PLACEHOLDER: Partial<Record<BlockType, string>> = {
  h1: 'Título',
  h2: 'Subtítulo',
  h3: 'Encabezado',
  p: 'Empezá a escribir o presioná "/" para insertar',
  bullet: 'Elemento de la lista',
  number: 'Elemento de la lista',
  check: 'Tarea',
  quote: 'Cita',
  callout: 'Texto destacado',
};

function TextBlock({ block, number, onSlash, slashOpen, onFocus }: BlockProps) {
  const ref = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = ref.current!;
    if (slashOpen && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) return; // los maneja el menú
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.altKey && ['0', '1', '2', '3'].includes(e.key)) {
      e.preventDefault();
      return setBlockType(block.id, (['p', 'h1', 'h2', 'h3'] as const)[+e.key]);
    }
    if (mod && e.key === 'Enter') {
      e.preventDefault();
      return insertBlockAfter(block.id, createBlock('pagebreak'), false), insertBlockAfter(block.id, createBlock('p'));
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const [before, after] = splitAtCaret(el);
      return splitBlock(block.id, before, after);
    }
    if (e.key === 'Backspace' && caretAtStart(el)) {
      e.preventDefault();
      if (block.type !== 'p') return updateBlock(block.id, { type: 'p' }, { label: 'Quitar estilo' });
      if (!textOf(block.html ?? '').trim() && !(block.html ?? '').includes('<img')) return removeBlock(block.id);
      return mergeWithPrevious(block.id);
    }
    if ((e.key === 'ArrowUp' && caretAtStart(el)) || (e.key === 'ArrowDown' && caretAtEnd(el))) {
      const list = useEditor.getState().doc.blocks ?? [];
      const i = list.findIndex((b) => b.id === block.id);
      const target = list[i + (e.key === 'ArrowUp' ? -1 : 1)];
      if (target) {
        e.preventDefault();
        useDocFocus.getState().request(target.id, e.key === 'ArrowUp' ? 'end' : 'start');
      }
    }
  };

  const onInput = (html: string) => {
    const text = textOf(html);
    // Atajos tipo Markdown al principio de un párrafo.
    if (block.type === 'p') {
      for (const [re, type] of MARKDOWN) {
        if (re.test(text)) {
          updateBlock(block.id, { html: '' }, { label: 'Atajo' });
          return setBlockType(block.id, type);
        }
      }
    }
    // Menú "/": se abre al escribir "/" en un bloque vacío y filtra mientras se escribe.
    const m = /^\/([^\s/]*)$/.exec(text);
    if (m) {
      const r = ref.current!.getBoundingClientRect();
      onSlash({ blockId: block.id, query: m[1], x: r.left, y: r.bottom + 4, index: 0 });
    } else if (slashOpen) onSlash(null);
    updateBlock(block.id, { html }, { label: 'Escribir', mergeKey: `type:${block.id}` });
  };

  return (
    <div className={`doc-text ${block.type}${block.checked ? ' done' : ''}`} style={{ textAlign: block.align, background: block.type === 'callout' ? block.color : undefined }}>
      {block.type === 'bullet' && <span className="marker">•</span>}
      {block.type === 'number' && <span className="marker">{number}.</span>}
      {block.type === 'check' && (
        <input type="checkbox" className="marker" checked={!!block.checked} onChange={(e) => updateBlock(block.id, { checked: e.target.checked }, { label: 'Marcar tarea' })} aria-label="Completada" />
      )}
      <RichText elRef={ref} blockId={block.id} html={block.html ?? ''} className="doc-rich" placeholder={PLACEHOLDER[block.type] ?? ''} onChange={onInput} onKeyDown={onKeyDown} onFocus={() => onFocus(block.id)} />
    </div>
  );
}

interface RichProps {
  blockId: string;
  html: string;
  className: string;
  placeholder: string;
  onChange(html: string): void;
  onKeyDown?(e: React.KeyboardEvent<HTMLDivElement>): void;
  onFocus?(): void;
  elRef?: React.RefObject<HTMLDivElement | null>;
}

/**
 * Texto con formato editable. El DOM es la fuente de verdad mientras se escribe:
 * el html del modelo solo se vuelve a volcar cuando el bloque no tiene foco (cambios
 * remotos) o cuando se deshace/rehace, para no mover el cursor.
 */
const RichText = memo(function RichText({ blockId, html, className, placeholder, onChange, onKeyDown, onFocus, elRef }: RichProps) {
  const own = useRef<HTMLDivElement>(null);
  const ref = elRef ?? own;
  const lastSent = useRef<string | null>(null);
  const focusReq = useDocFocus((s) => (s.id === blockId ? s.seq : 0));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const clean = sanitizeHtml(html);
    const editingHere = document.activeElement === el && lastSent.current === html;
    if (!editingHere && el.innerHTML !== clean) el.innerHTML = clean;
  }, [html]);

  useLayoutEffect(() => {
    if (!focusReq || !ref.current) return;
    const el = ref.current;
    el.focus();
    placeCaret(el, useDocFocus.getState().at);
  }, [focusReq]);

  return (
    <div
      ref={ref}
      className={className}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      data-rich={blockId}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onInput={(e) => {
        const v = sanitizeHtml((e.target as HTMLDivElement).innerHTML);
        lastSent.current = v;
        onChange(v);
      }}
      onPaste={(e) => {
        // Se pega como html saneado (o texto) en lugar del html crudo del portapapeles.
        e.preventDefault();
        const rich = e.clipboardData.getData('text/html');
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertHTML', false, rich ? sanitizeHtml(rich) : escapeHtml(text).replace(/\n/g, '<br>'));
      }}
    />
  );
});

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// --------------------------------------------------------------------------- cursor

function placeCaret(el: HTMLElement, at: 'start' | 'end') {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(at === 'start');
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function caretOffsets(el: HTMLElement): { before: Range; after: Range } | null {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const r = sel.getRangeAt(0);
  if (!el.contains(r.startContainer)) return null;
  const before = document.createRange();
  before.selectNodeContents(el);
  before.setEnd(r.startContainer, r.startOffset);
  const after = document.createRange();
  after.selectNodeContents(el);
  after.setStart(r.endContainer, r.endOffset);
  return { before, after };
}

function caretAtStart(el: HTMLElement) {
  const o = caretOffsets(el);
  return !!o && o.before.toString().length === 0 && !o.before.cloneContents().querySelector('br');
}

function caretAtEnd(el: HTMLElement) {
  const o = caretOffsets(el);
  return !!o && o.after.toString().length === 0;
}

/** html antes y después del cursor (para dividir el bloque con Enter). */
function splitAtCaret(el: HTMLElement): [string, string] {
  const o = caretOffsets(el);
  if (!o) return [el.innerHTML, ''];
  const wrap = (r: Range) => {
    const d = document.createElement('div');
    d.appendChild(r.cloneContents());
    return sanitizeHtml(d.innerHTML);
  };
  return [wrap(o.before), wrap(o.after)];
}

// --------------------------------------------------------------------------- bloques especiales

function TableBlock({ block }: { block: Block }) {
  const rows = block.rows ?? [['']];
  const set = (fn: (rows: string[][]) => void, label: string, mergeKey?: string) => {
    const next = rows.map((r) => [...r]);
    fn(next);
    updateBlock(block.id, { rows: next }, { label, mergeKey });
  };
  return (
    <div className="doc-table-wrap">
      <table className="doc-table" data-testid="doc-table">
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((cell, ci) => (
                <td key={ci}>
                  <RichText
                    blockId={`${block.id}:${ri}:${ci}`}
                    html={cell}
                    className="doc-cell"
                    placeholder=""
                    onChange={(v) => set((x) => void (x[ri][ci] = v), 'Editar celda', `cell:${block.id}:${ri}:${ci}`)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Tab') return;
                      e.preventDefault();
                      const cols = r.length;
                      let n = ri * cols + ci + (e.shiftKey ? -1 : 1);
                      if (n >= rows.length * cols) {
                        set((x) => void x.push(Array.from({ length: cols }, () => '')), 'Agregar fila');
                      }
                      n = Math.max(0, n);
                      useDocFocus.getState().request(`${block.id}:${Math.floor(n / cols)}:${n % cols}`, 'end');
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="doc-table-tools">
        <button className="ghost" onClick={() => set((x) => void x.push(Array.from({ length: rows[0].length }, () => '')), 'Agregar fila')} data-testid="doc-table-add-row">
          + Fila
        </button>
        <button className="ghost" onClick={() => set((x) => x.forEach((row) => row.push('')), 'Agregar columna')}>
          + Columna
        </button>
        <button className="ghost" disabled={rows.length <= 1} onClick={() => set((x) => void x.pop(), 'Quitar fila')}>
          − Fila
        </button>
        <button className="ghost" disabled={rows[0].length <= 1} onClick={() => set((x) => x.forEach((row) => row.pop()), 'Quitar columna')}>
          − Columna
        </button>
      </div>
    </div>
  );
}

function ImageBlock({ block }: { block: Block }) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploads((s) => s.upload);
  const pick = async (f?: File) => {
    if (!f) return;
    updateBlock(block.id, { src: await upload(f, f.name) }, { label: 'Imagen' });
  };
  return (
    <div
      className="doc-image"
      onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void pick([...e.dataTransfer.files].find((f) => f.type.startsWith('image/')));
      }}
    >
      {block.src ? <img src={block.src} alt="" /> : <div className="doc-image-empty">Soltá una imagen o elegila</div>}
      <button className="ghost small" onClick={() => input.current?.click()}>
        <Icon name="image" size={14} /> {block.src ? 'Reemplazar' : 'Elegir imagen'}
      </button>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}

function ChartBlock({ block }: { block: Block }) {
  const c = block.chart!;
  const [text, setText] = useState(c.labels.map((l, i) => `${l}: ${c.values[i] ?? 0}`).join(', '));
  const max = Math.max(...c.values, 1);
  const total = c.values.reduce((s, v) => s + Math.max(0, v), 0) || 1;
  const W = 520;
  const H = 220;
  const commitText = () => {
    const pairs = text.split(',').map((x) => x.split(':').map((y) => y.trim())).filter((p) => p[0]);
    updateBlock(block.id, { chart: { ...c, labels: pairs.map((p) => p[0]), values: pairs.map((p) => Number(p[1]) || 0) } }, { label: 'Datos del gráfico' });
  };
  let angle = -Math.PI / 2;
  return (
    <div className="doc-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gráfico">
        {c.chartType === 'pie'
          ? c.values.map((v, i) => {
              const a0 = angle;
              const a1 = (angle += (Math.max(0, v) / total) * Math.PI * 2);
              const large = a1 - a0 > Math.PI ? 1 : 0;
              const r = 95;
              const cx = W / 2;
              const cy = H / 2;
              const d = `M${cx} ${cy} L${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} Z`;
              return <path key={i} d={d} fill={c.color} opacity={1 - (i % 5) * 0.16} stroke="#fff" />;
            })
          : c.chartType === 'line'
            ? <polyline fill="none" stroke={c.color} strokeWidth={4} points={c.values.map((v, i) => `${40 + (i * (W - 80)) / Math.max(1, c.values.length - 1)},${H - 30 - (v / max) * (H - 60)}`).join(' ')} />
            : c.values.map((v, i) => {
                const bw = (W - 80) / c.values.length;
                const h = (v / max) * (H - 60);
                return <rect key={i} x={40 + i * bw + bw * 0.15} y={H - 30 - h} width={bw * 0.7} height={h} rx={4} fill={c.color} />;
              })}
        {c.chartType !== 'pie' &&
          c.labels.map((l, i) => {
            const n = c.labels.length;
            const x = c.chartType === 'line' ? 40 + (i * (W - 80)) / Math.max(1, n - 1) : 40 + ((W - 80) / n) * (i + 0.5);
            return (
              <text key={i} x={x} y={H - 8} textAnchor="middle" fontSize={13} fill="#4a5263">
                {l}
              </text>
            );
          })}
      </svg>
      <div className="row doc-chart-tools">
        <select value={c.chartType} onChange={(e) => updateBlock(block.id, { chart: { ...c, chartType: e.target.value as 'bar' } }, { label: 'Tipo de gráfico' })} aria-label="Tipo de gráfico">
          <option value="bar">Barras</option>
          <option value="line">Líneas</option>
          <option value="pie">Torta</option>
        </select>
        <input type="color" value={c.color} onChange={(e) => updateBlock(block.id, { chart: { ...c, color: e.target.value } }, { mergeKey: `chc:${block.id}` })} aria-label="Color" />
        <input value={text} onChange={(e) => setText(e.target.value)} onBlur={commitText} onKeyDown={(e) => e.key === 'Enter' && commitText()} aria-label="Datos (etiqueta: valor, …)" placeholder="Ene: 12, Feb: 19" />
      </div>
    </div>
  );
}

function ButtonBlock({ block, onFocus }: { block: Block; onFocus(id: string): void }) {
  return (
    <div className="doc-button-row" style={{ textAlign: block.align ?? 'left' }}>
      <span className="doc-button" style={{ background: block.color ?? '#5b6cff' }}>
        <RichText blockId={block.id} html={block.html ?? ''} className="doc-button-label" placeholder="Texto del botón" onChange={(v) => updateBlock(block.id, { html: v }, { mergeKey: `btn:${block.id}` })} onFocus={() => onFocus(block.id)} />
      </span>
      <input className="doc-button-url" value={block.url ?? ''} onChange={(e) => updateBlock(block.id, { url: e.target.value }, { mergeKey: `url:${block.id}` })} aria-label="Enlace del botón" placeholder="https://" />
      <input type="color" value={block.color ?? '#5b6cff'} onChange={(e) => updateBlock(block.id, { color: e.target.value }, { mergeKey: `btnc:${block.id}` })} aria-label="Color del botón" />
    </div>
  );
}

// --------------------------------------------------------------------------- menú "/", formato y esquema

function SlashMenu({ slash, items, onPick, onClose, onMove }: { slash: Slash; items: typeof BLOCK_MENU; onPick(t: BlockType): void; onClose(): void; onMove(d: number): void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        onMove(e.key === 'ArrowDown' ? 1 : -1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[slash.index]) onPick(items[slash.index].type);
      } else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [slash, items, onPick, onClose, onMove]);
  return (
    <div className="slash-menu" style={{ left: slash.x, top: Math.min(slash.y, window.innerHeight - 320) }} role="listbox" data-testid="slash-menu">
      <small>Acciones</small>
      {items.length === 0 && <div className="kbd" style={{ padding: 8 }}>Sin resultados</div>}
      {items.map((m, i) => (
        <button key={m.type + m.label} role="option" aria-selected={i === slash.index} className={i === slash.index ? 'active' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(m.type)}>
          <BlockIcon type={m.type} />
          <span>{m.label}</span>
          {m.hint && <kbd>{m.hint}</kbd>}
        </button>
      ))}
    </div>
  );
}

const BLOCK_ICON: Partial<Record<BlockType, string>> = {
  h1: 'H1',
  h2: 'H2',
  h3: 'H3',
  p: '¶',
  table: '▦',
  divider: '—',
  pagebreak: '⤓',
  check: '☑',
  bullet: '•',
  number: '1.',
  columns: '▥',
  callout: '!',
  quote: '“',
  image: '▣',
  chart: '▮',
  button: '⬭',
};

function BlockIcon({ type }: { type: BlockType }) {
  return <span className="block-icon">{BLOCK_ICON[type]}</span>;
}

const COLORS = ['#1f2430', '#e8402a', '#ff8a3d', '#2e9e5b', '#2f7cf6', '#8a5cff', '#e84a8a'];
const HIGHLIGHTS = ['transparent', '#fff3a3', '#c9f2d8', '#d6e6ff', '#ffd6e7'];

/** Barra de formato: estilo del bloque con foco y formato en línea sobre la selección. */
function FormatBar({ focused }: { focused: string | null }) {
  const block = useEditor((s) => s.doc.blocks?.find((b) => b.id === focused) ?? null);
  const exec = (cmd: string, value?: string) => {
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(cmd, false, value);
    // execCommand no dispara "input" en todos los navegadores: se propaga el cambio a mano.
    const el = document.activeElement as HTMLElement | null;
    if (el?.dataset.rich) el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const keep = (e: React.MouseEvent) => e.preventDefault(); // no perder la selección
  const textual = block && TEXTUAL.includes(block.type);
  return (
    <div className="context-bar doc-format" data-testid="doc-format">
      <select
        value={textual ? block!.type : ''}
        disabled={!textual}
        onChange={(e) => block && setBlockType(block.id, e.target.value as BlockType)}
        aria-label="Estilo del bloque"
        data-testid="block-type"
      >
        {!textual && <option value="">—</option>}
        <option value="h1">Título</option>
        <option value="h2">Subtítulo</option>
        <option value="h3">Encabezado</option>
        <option value="p">Cuerpo</option>
        <option value="bullet">Lista con viñetas</option>
        <option value="number">Lista numerada</option>
        <option value="check">Lista de control</option>
        <option value="quote">Cita</option>
        <option value="callout">Destacado</option>
      </select>
      <span className="sep" />
      <button className="ghost" onMouseDown={keep} onClick={() => exec('bold')} title="Negrita (Ctrl+B)" data-testid="doc-bold">
        <Icon name="bold" />
      </button>
      <button className="ghost" onMouseDown={keep} onClick={() => exec('italic')} title="Cursiva (Ctrl+I)">
        <Icon name="italic" />
      </button>
      <button className="ghost" onMouseDown={keep} onClick={() => exec('underline')} title="Subrayado (Ctrl+U)">
        <Icon name="underline" />
      </button>
      <button className="ghost" onMouseDown={keep} onClick={() => exec('strikeThrough')} title="Tachado">
        <s>S</s>
      </button>
      <span className="sep" />
      <div className="mini-swatches" title="Color del texto">
        {COLORS.map((c) => (
          <button key={c} style={{ background: c }} onMouseDown={keep} onClick={() => exec('foreColor', c)} aria-label={`Color ${c}`} />
        ))}
      </div>
      <div className="mini-swatches" title="Resaltado">
        {HIGHLIGHTS.map((c) => (
          <button key={c} style={{ background: c === 'transparent' ? '#fff' : c, outline: c === 'transparent' ? '1px dashed #c9cede' : undefined }} onMouseDown={keep} onClick={() => exec('hiliteColor', c)} aria-label={`Resaltar ${c}`} />
        ))}
      </div>
      <span className="sep" />
      {(['left', 'center', 'right', 'justify'] as const).map((a) => (
        <button key={a} className={`ghost${block?.align === a ? ' active' : ''}`} disabled={!block} onMouseDown={keep} onClick={() => block && updateBlock(block.id, { align: a }, { label: 'Alinear' })} title={`Alinear: ${a}`}>
          <Icon name={a === 'left' ? 'alignLeft' : a === 'center' ? 'alignCenter' : a === 'right' ? 'alignRight' : 'alignLeft'} />
        </button>
      ))}
      <span className="sep" />
      <button
        className="ghost"
        onMouseDown={keep}
        onClick={() => {
          const url = prompt('Dirección del enlace (https://…)');
          if (url && /^(https?:|mailto:)/i.test(url)) exec('createLink', url);
        }}
        title="Enlace"
      >
        🔗
      </button>
      <button className="ghost" onMouseDown={keep} onClick={() => exec('removeFormat')} title="Quitar formato">
        Tx
      </button>
    </div>
  );
}

function Outline({ blocks }: { blocks: Block[] }) {
  const heads = blocks.filter((b) => b.type === 'h1' || b.type === 'h2' || b.type === 'h3');
  return (
    <div className="outline" data-testid="outline">
      <h3>Esquema</h3>
      {heads.length === 0 && <p className="kbd">Agregá títulos para ver el esquema del documento.</p>}
      {heads.map((b) => (
        <button key={b.id} className={`outline-item ${b.type}`} onClick={() => document.querySelector(`[data-block-id="${b.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
          {textOf(b.html ?? '') || 'Sin título'}
        </button>
      ))}
    </div>
  );
}
