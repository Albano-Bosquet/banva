import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { colName, evaluateCells, formatNumber, parseRef, toNumber, type CellStyle, type Sheet } from '@trazo/shared';
import { useEditor } from '../store/editorStore';
import { Icon } from '../editor/icons';

type Pos = { r: number; c: number };
const ref = (p: Pos) => `${colName(p.c)}${p.r + 1}`;
const DEFAULT_W = 110;
const ROW_H = 28;

/** Celdas en un rango normalizado. */
function rangeOf(a: Pos, b: Pos) {
  return { r0: Math.min(a.r, b.r), r1: Math.max(a.r, b.r), c0: Math.min(a.c, b.c), c1: Math.max(a.c, b.c) };
}

function commitSheet(label: string, fn: (s: Sheet) => void, mergeKey?: string) {
  useEditor.getState().commit(label, (d) => {
    if (d.sheet) fn(d.sheet as Sheet);
  }, { mergeKey });
}

/** Valor a mostrar con el formato de la celda (número, moneda, porcentaje). */
export function formatValue(v: number | string, style?: CellStyle): string {
  if (typeof v !== 'number') return v;
  const dec = style?.decimals;
  const opts = (min?: number) => ({ minimumFractionDigits: dec ?? min, maximumFractionDigits: dec ?? 2 });
  switch (style?.format) {
    case 'currency':
      return `$ ${v.toLocaleString('es-AR', opts(2))}`;
    case 'percent':
      return `${(v * 100).toLocaleString('es-AR', opts())} %`;
    case 'number':
      return v.toLocaleString('es-AR', opts());
    default:
      return dec !== undefined ? v.toLocaleString('es-AR', opts()) : formatNumber(v);
  }
}

/** Grilla densa con el contenido usado (el motor de fórmulas trabaja con matrices). */
export function sheetGrid(sheet: Sheet): string[][] {
  let rows = 0;
  let cols = 0;
  for (const k of Object.keys(sheet.cells)) {
    const p = parseRef(k);
    if (p) (rows = Math.max(rows, p.row + 1)), (cols = Math.max(cols, p.col + 1));
  }
  return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => sheet.cells[`${colName(c)}${r + 1}`] ?? ''));
}

export function SheetEditor() {
  const sheet = useEditor((s) => s.doc.sheet)!;
  const [active, setActive] = useState<Pos>({ r: 0, c: 0 });
  const [anchor, setAnchor] = useState<Pos>({ r: 0, c: 0 });
  const [editing, setEditing] = useState<{ value: string; fromBar: boolean } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  /**
   * Un único campo, siempre enfocado sobre la celda activa, recibe el teclado: así
   * ninguna tecla se pierde al empezar a escribir (aunque se escriba rápido).
   */
  const inputRef = useRef<HTMLInputElement>(null);
  const focusInput = () => inputRef.current?.focus({ preventScroll: true });
  const dragging = useRef(false);

  const values = useMemo(() => evaluateCells(sheetGrid(sheet)), [sheet]);
  const valueAt = (r: number, c: number) => values[r]?.[c] ?? '';
  const raw = (p: Pos) => sheet.cells[ref(p)] ?? '';
  const sel = rangeOf(anchor, active);
  const widths = useMemo(() => Array.from({ length: sheet.cols }, (_, c) => sheet.colWidths[colName(c)] ?? DEFAULT_W), [sheet.cols, sheet.colWidths]);
  const lefts = useMemo(() => widths.reduce<number[]>((acc, _w, i) => (acc.push(i ? acc[i - 1] + widths[i - 1] : 0), acc), []), [widths]);

  const setCell = (p: Pos, value: string) =>
    commitSheet('Editar celda', (s) => {
      if (value === '') delete s.cells[ref(p)];
      else s.cells[ref(p)] = value;
    });

  const move = useCallback(
    (dr: number, dc: number, extend = false) => {
      const next = { r: Math.max(0, Math.min(sheet.rows - 1, active.r + dr)), c: Math.max(0, Math.min(sheet.cols - 1, active.c + dc)) };
      setActive(next);
      if (!extend) setAnchor(next);
      // Mantener visible la celda activa.
      requestAnimationFrame(() => gridRef.current?.querySelector(`[data-cell="${ref(next)}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
    },
    [active, sheet.rows, sheet.cols],
  );

  const finishEdit = (save: boolean, dr = 0, dc = 0) => {
    if (editing && save && editing.value !== raw(active)) setCell(active, editing.value);
    setEditing(null);
    focusInput();
    if (dr || dc) move(dr, dc);
  };

  const clearSelection = () =>
    commitSheet('Borrar celdas', (s) => {
      for (let r = sel.r0; r <= sel.r1; r++) for (let c = sel.c0; c <= sel.c1; c++) delete s.cells[ref({ r, c })];
    });

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (editing && !editing.fromBar) {
      if (e.key === 'Enter') return e.preventDefault(), finishEdit(true, e.shiftKey ? -1 : 1, 0);
      if (e.key === 'Tab') return e.preventDefault(), finishEdit(true, 0, e.shiftKey ? -1 : 1);
      if (e.key === 'Escape') return e.preventDefault(), finishEdit(false);
      return;
    }
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    if (k === 'ArrowUp') return e.preventDefault(), move(-1, 0, e.shiftKey);
    if (k === 'ArrowDown') return e.preventDefault(), move(1, 0, e.shiftKey);
    if (k === 'ArrowLeft') return e.preventDefault(), move(0, -1, e.shiftKey);
    if (k === 'ArrowRight') return e.preventDefault(), move(0, 1, e.shiftKey);
    if (k === 'Tab') return e.preventDefault(), move(0, e.shiftKey ? -1 : 1);
    if (k === 'Enter' || k === 'F2') return e.preventDefault(), setEditing({ value: raw(active), fromBar: false });
    if (k === 'Escape') return;
    if (k === 'Delete' || k === 'Backspace') return e.preventDefault(), clearSelection();
    if (mod && k.toLowerCase() === 'b') return e.preventDefault(), toggleStyle('bold');
    if (mod && k.toLowerCase() === 'i') return e.preventDefault(), toggleStyle('italic');
    if (mod && k.toLowerCase() === 'a') {
      e.preventDefault();
      setAnchor({ r: 0, c: 0 });
      return setActive({ r: sheet.rows - 1, c: sheet.cols - 1 });
    }
    // El resto de las teclas escribe en el campo: onChange empieza la edición
    // reemplazando el contenido de la celda (como en las planillas).
  };

  // Copiar y pegar rangos como texto separado por tabulaciones (compatible con otras planillas).
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const onCopy = (e: ClipboardEvent) => {
      if (editing) return;
      const rows: string[] = [];
      for (let r = sel.r0; r <= sel.r1; r++) {
        const cells: string[] = [];
        for (let c = sel.c0; c <= sel.c1; c++) cells.push(String(sheet.cells[ref({ r, c })] ?? ''));
        rows.push(cells.join('\t'));
      }
      e.clipboardData?.setData('text/plain', rows.join('\n'));
      e.preventDefault();
    };
    const onPaste = (e: ClipboardEvent) => {
      if (editing) return;
      const text = e.clipboardData?.getData('text/plain');
      if (!text) return;
      e.preventDefault();
      const rows = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map((l) => l.split('\t'));
      commitSheet('Pegar', (s) => {
        rows.forEach((row, dr) =>
          row.forEach((v, dc) => {
            const p = { r: active.r + dr, c: active.c + dc };
            if (p.r >= s.rows || p.c >= s.cols) return;
            if (v === '') delete s.cells[ref(p)];
            else s.cells[ref(p)] = v;
          }),
        );
      });
      setAnchor(active);
      setActive({ r: Math.min(sheet.rows - 1, active.r + rows.length - 1), c: Math.min(sheet.cols - 1, active.c + Math.max(...rows.map((r) => r.length)) - 1) });
    };
    el.addEventListener('copy', onCopy);
    el.addEventListener('paste', onPaste);
    return () => {
      el.removeEventListener('copy', onCopy);
      el.removeEventListener('paste', onPaste);
    };
  });

  useEffect(() => focusInput(), []);

  const activeStyle = sheet.styles[ref(active)] ?? {};
  function setStyle(patch: Partial<CellStyle>, label = 'Formato') {
    commitSheet(label, (s) => {
      for (let r = sel.r0; r <= sel.r1; r++)
        for (let c = sel.c0; c <= sel.c1; c++) {
          const k = ref({ r, c });
          s.styles[k] = { ...(s.styles[k] ?? {}), ...patch };
        }
    });
  }
  function toggleStyle(key: 'bold' | 'italic') {
    setStyle({ [key]: !activeStyle[key] });
  }

  /** Ordena las filas del rango seleccionado (o de todos los datos) por la columna activa. */
  const sortBy = (dir: 1 | -1) => {
    const grid = sheetGrid(sheet);
    const r0 = sel.r0 === sel.r1 ? 0 : sel.r0;
    const r1 = sel.r0 === sel.r1 ? grid.length - 1 : sel.r1;
    if (r1 <= r0) return;
    const rows = grid.slice(r0, r1 + 1);
    const key = active.c;
    rows.sort((a, b) => {
      const x = a[key] ?? '';
      const y = b[key] ?? '';
      const nx = toNumber(x);
      const ny = toNumber(y);
      if (nx !== null && ny !== null) return (nx - ny) * dir;
      if (!x) return 1;
      if (!y) return -1;
      return x.localeCompare(y, 'es') * dir;
    });
    commitSheet(dir === 1 ? 'Ordenar A → Z' : 'Ordenar Z → A', (s) => {
      rows.forEach((row, i) =>
        row.forEach((v, c) => {
          const k = ref({ r: r0 + i, c });
          if (v) s.cells[k] = v;
          else delete s.cells[k];
        }),
      );
    });
  };

  const resizeCol = (c: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const start = e.clientX;
    const w0 = widths[c];
    const onMove = (ev: MouseEvent) => {
      const w = Math.max(40, Math.round(w0 + ev.clientX - start));
      commitSheet('Ancho de columna', (s) => void (s.colWidths[colName(c)] = w), `colw:${c}`);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const totalW = lefts[sheet.cols - 1] + widths[sheet.cols - 1];
  const font = sheet.fontFamily ?? 'Inter';
  const activeValue = valueAt(active.r, active.c);
  const nums: number[] = [];
  for (let r = sel.r0; r <= sel.r1; r++) for (let c = sel.c0; c <= sel.c1; c++) typeof valueAt(r, c) === 'number' && nums.push(valueAt(r, c) as number);

  return (
    <main className="sheet-workspace" data-testid="sheet-editor">
      <div className="context-bar sheet-toolbar">
        <button className={`ghost${activeStyle.bold ? ' active' : ''}`} onClick={() => toggleStyle('bold')} title="Negrita (Ctrl+B)" data-testid="sheet-bold">
          <Icon name="bold" />
        </button>
        <button className={`ghost${activeStyle.italic ? ' active' : ''}`} onClick={() => toggleStyle('italic')} title="Cursiva (Ctrl+I)">
          <Icon name="italic" />
        </button>
        <label title="Color del texto">
          A<input type="color" value={activeStyle.color ?? '#1f2430'} onChange={(e) => setStyle({ color: e.target.value })} />
        </label>
        <label title="Color de relleno">
          ▧<input type="color" value={activeStyle.bg ?? '#ffffff'} onChange={(e) => setStyle({ bg: e.target.value })} />
        </label>
        <span className="sep" />
        {(['left', 'center', 'right'] as const).map((a) => (
          <button key={a} className={`ghost${activeStyle.align === a ? ' active' : ''}`} onClick={() => setStyle({ align: a })} title={`Alinear ${a}`}>
            <Icon name={a === 'left' ? 'alignLeft' : a === 'center' ? 'alignCenter' : 'alignRight'} />
          </button>
        ))}
        <span className="sep" />
        <select value={activeStyle.format ?? 'general'} onChange={(e) => setStyle({ format: e.target.value as CellStyle['format'] })} aria-label="Formato numérico" data-testid="sheet-format">
          <option value="general">General</option>
          <option value="number">Número</option>
          <option value="currency">Moneda</option>
          <option value="percent">Porcentaje</option>
        </select>
        <button className="ghost" onClick={() => setStyle({ decimals: Math.max(0, (activeStyle.decimals ?? 2) - 1) })} title="Menos decimales">
          .0
        </button>
        <button className="ghost" onClick={() => setStyle({ decimals: Math.min(6, (activeStyle.decimals ?? 2) + 1) })} title="Más decimales">
          .00
        </button>
        <span className="sep" />
        <button className="ghost" onClick={() => sortBy(1)} title="Ordenar por la columna activa (A → Z)" data-testid="sheet-sort-asc">
          A→Z
        </button>
        <button className="ghost" onClick={() => sortBy(-1)} title="Ordenar por la columna activa (Z → A)">
          Z→A
        </button>
        <span className="sep" />
        <select value={font} onChange={(e) => commitSheet('Tipografía', (s) => void (s.fontFamily = e.target.value))} aria-label="Tipografía">
          {['Inter', 'Montserrat', 'Roboto Mono', 'Georgia', 'Arial'].map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        <button className="ghost" onClick={() => commitSheet('Agregar filas', (s) => void (s.rows = Math.min(1000, s.rows + 50)))} title="Agregar 50 filas">
          + Filas
        </button>
        <button className="ghost" disabled={sheet.cols >= 52} onClick={() => commitSheet('Agregar columna', (s) => void (s.cols = Math.min(52, s.cols + 1)))} title="Agregar una columna">
          + Columna
        </button>
      </div>
      <div className="formula-bar">
        <span className="cell-name" data-testid="cell-name">
          {ref(anchor) === ref(active) ? ref(active) : `${ref({ r: sel.r0, c: sel.c0 })}:${ref({ r: sel.r1, c: sel.c1 })}`}
        </span>
        <span className="fx">f(x)</span>
        <input
          value={editing ? editing.value : raw(active)}
          onFocus={() => !editing && setEditing({ value: raw(active), fromBar: true })}
          onChange={(e) => setEditing({ value: e.target.value, fromBar: true })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') finishEdit(true, 1, 0);
            if (e.key === 'Escape') finishEdit(false);
          }}
          onBlur={() => editing?.fromBar && finishEdit(true)}
          aria-label="Barra de fórmulas"
          data-testid="formula-bar"
        />
      </div>
      <div className="sheet-scroller" ref={gridRef} data-testid="sheet-grid" style={{ fontFamily: font }}>
        <div className="sheet-grid" style={{ width: totalW + 46, height: (sheet.rows + 1) * ROW_H }}>
          <div className="sheet-headrow" style={{ width: totalW + 46 }}>
            <div className="sheet-corner" onClick={() => (setAnchor({ r: 0, c: 0 }), setActive({ r: sheet.rows - 1, c: sheet.cols - 1 }))} />
            {widths.map((w, c) => (
              <div
                key={c}
                className={`sheet-colhead${c >= sel.c0 && c <= sel.c1 ? ' on' : ''}`}
                style={{ left: 46 + lefts[c], width: w }}
                onMouseDown={() => (setAnchor({ r: 0, c }), setActive({ r: sheet.rows - 1, c }), focusInput())}
              >
                {colName(c)}
                <span className="col-resizer" onMouseDown={(e) => resizeCol(c, e)} />
              </div>
            ))}
          </div>
          <input
            ref={inputRef}
            className={`cell-input${editing && !editing.fromBar ? ' on' : ''}`}
            style={{ left: 46 + lefts[active.c], top: (active.r + 1) * ROW_H, width: widths[active.c], fontWeight: activeStyle.bold ? 700 : undefined }}
            value={editing && !editing.fromBar ? editing.value : ''}
            onChange={(e) => setEditing({ value: e.target.value, fromBar: false })}
            onKeyDown={onKeyDown}
            onBlur={() => editing && !editing.fromBar && finishEdit(true)}
            aria-label={`Celda ${ref(active)}`}
            data-testid="cell-input"
          />
          {Array.from({ length: sheet.rows }, (_, r) => (
            <div key={r} className="sheet-row" style={{ top: (r + 1) * ROW_H }}>
              <div className={`sheet-rowhead${r >= sel.r0 && r <= sel.r1 ? ' on' : ''}`} onMouseDown={() => (setAnchor({ r, c: 0 }), setActive({ r, c: sheet.cols - 1 }), focusInput())}>
                {r + 1}
              </div>
              {widths.map((w, c) => {
                const k = `${colName(c)}${r + 1}`;
                const st = sheet.styles[k];
                const v = valueAt(r, c);
                const isErr = typeof v === 'string' && v.startsWith('#');
                const inSel = r >= sel.r0 && r <= sel.r1 && c >= sel.c0 && c <= sel.c1;
                const isActive = r === active.r && c === active.c;
                return (
                  <div
                    key={c}
                    data-cell={k}
                    className={`sheet-cell${inSel ? ' sel' : ''}${isActive ? ' active' : ''}${isErr ? ' err' : ''}`}
                    style={{
                      left: 46 + lefts[c],
                      width: w,
                      fontWeight: st?.bold ? 700 : undefined,
                      fontStyle: st?.italic ? 'italic' : undefined,
                      color: st?.color,
                      background: st?.bg,
                      textAlign: st?.align ?? (typeof v === 'number' ? 'right' : 'left'),
                    }}
                    title={isErr ? errorHelp(v as string) : undefined}
                    onMouseDown={(e) => {
                      if (editing) finishEdit(true);
                      dragging.current = true;
                      e.preventDefault();
                      if (e.shiftKey) setActive({ r, c });
                      else (setAnchor({ r, c }), setActive({ r, c }));
                      focusInput();
                    }}
                    onMouseEnter={() => dragging.current && setActive({ r, c })}
                    onMouseUp={() => (dragging.current = false)}
                    onDoubleClick={() => (setEditing({ value: raw({ r, c }), fromBar: false }), focusInput())}
                  >
                    {isActive && editing && !editing.fromBar ? null : isErr ? (
                      <span className="err-badge">✕ {v}</span>
                    ) : (
                      formatValue(v, st)
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <footer className="bottombar">
        <span className="kbd">Escribí sobre una celda para reemplazarla · Enter/F2 editar · Mayús+flechas seleccionar · Ctrl+C/V copiar y pegar</span>
        <span className="spacer" />
        {nums.length > 1 && (
          <span data-testid="sheet-stats">
            Suma: {formatNumber(nums.reduce((s, x) => s + x, 0))} · Promedio: {formatNumber(nums.reduce((s, x) => s + x, 0) / nums.length)} · Recuento: {nums.length}
          </span>
        )}
        {nums.length <= 1 && typeof activeValue === 'number' && <span>{formatNumber(activeValue)}</span>}
      </footer>
    </main>
  );
}

function errorHelp(code: string): string {
  return (
    {
      '#CICLO': 'Referencia circular: la fórmula depende de sí misma.',
      '#DIV/0': 'División por cero.',
      '#NOMBRE': 'Función desconocida.',
      '#REF': 'Referencia inválida.',
    }[code] ?? 'La fórmula tiene un error.'
  );
}

/** CSV con valores calculados (separador ";" para planillas en español). */
export function sheetToCsv(sheet: Sheet): string {
  const grid = sheetGrid(sheet);
  const vals = evaluateCells(grid);
  return vals.map((row) => row.map((v) => {
    const s = typeof v === 'number' ? String(v).replace('.', ',') : v;
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(';')).join('\r\n');
}
