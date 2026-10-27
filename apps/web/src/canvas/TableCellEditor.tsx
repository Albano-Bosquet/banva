import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import type { TableElement } from '@trazo/shared';
import { useEditor } from '../store/editorStore';
import { colOffsets } from './bodies';

interface CellEditState {
  cell: { id: string; row: number; col: number } | null;
  edit(id: string, row: number, col: number): void;
  close(): void;
}

/** Celda de tabla en edición (doble clic). Tab / Mayús+Tab y Enter navegan entre celdas. */
export const useCellEdit = create<CellEditState>((set) => ({
  cell: null,
  edit: (id, row, col) => set({ cell: { id, row, col } }),
  close: () => set({ cell: null }),
}));

/** Celda bajo un punto en coordenadas locales del elemento. */
export function cellAt(el: TableElement, x: number, y: number): { row: number; col: number } {
  const xs = colOffsets(el);
  const rowH = el.height / el.cells.length;
  const row = Math.max(0, Math.min(el.cells.length - 1, Math.floor(y / rowH)));
  let col = xs.findIndex((cx, i) => i < xs.length - 1 && x >= cx && x < xs[i + 1]);
  if (col < 0) col = x < 0 ? 0 : el.colWidths.length - 1;
  return { row, col };
}

export function TableCellEditor({ el, zoom }: { el: TableElement; zoom: number }) {
  const cell = useCellEdit((s) => (s.cell?.id === el.id ? s.cell : null));
  if (!cell || cell.row >= el.cells.length || cell.col >= el.cells[0].length) return null;
  return <CellInput key={`${cell.row}:${cell.col}`} el={el} zoom={zoom} row={cell.row} col={cell.col} />;
}

function CellInput({ el, zoom, row, col }: { el: TableElement; zoom: number; row: number; col: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(el.cells[row][col]);
  const done = useRef(false);
  const xs = colOffsets(el);
  const rowH = el.height / el.cells.length;

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const save = () => {
    if (done.current) return;
    done.current = true;
    if (value !== el.cells[row][col]) {
      useEditor.getState().updateElements([el.id], (d) => {
        if (d.type === 'table') d.cells[row][col] = value;
      }, { label: 'Editar celda' });
    }
  };
  const move = (dr: number, dc: number) => {
    save();
    const rows = el.cells.length;
    const cols = el.cells[0].length;
    let r = row;
    let c = col + dc;
    if (c >= cols) (c = 0), (r += 1);
    if (c < 0) (c = cols - 1), (r -= 1);
    r += dr;
    if (r < 0 || r >= rows) return useCellEdit.getState().close();
    useCellEdit.getState().edit(el.id, r, c);
  };

  // La celda se ubica en coordenadas del elemento y se aplica la misma rotación.
  const rad = (el.rotation * Math.PI) / 180;
  const lx = xs[col];
  const ly = row * rowH;
  const left = el.x + lx * Math.cos(rad) - ly * Math.sin(rad);
  const top = el.y + lx * Math.sin(rad) + ly * Math.cos(rad);

  return (
    <textarea
      ref={ref}
      className="cell-editor"
      data-testid="cell-editor"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        save();
        if (useCellEdit.getState().cell?.row === row && useCellEdit.getState().cell?.col === col) useCellEdit.getState().close();
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') return useCellEdit.getState().close();
        if (e.key === 'Tab') return e.preventDefault(), move(0, e.shiftKey ? -1 : 1);
        if (e.key === 'Enter' && !e.shiftKey) return e.preventDefault(), move(1, 0);
      }}
      style={{
        left: left * zoom,
        top: top * zoom,
        width: xs[col + 1] - xs[col],
        height: rowH,
        transform: `scale(${zoom}) rotate(${el.rotation}deg)`,
        fontFamily: el.fontFamily,
        fontSize: el.fontSize,
        padding: el.fontSize * 0.5,
        color: el.textColor,
        textAlign: el.align,
      }}
    />
  );
}
