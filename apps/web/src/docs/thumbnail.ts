import { colName, displayCells, type DesignDoc } from '@trazo/shared';
import { textOf } from './sanitize';

/**
 * Miniatura de documentos, correos y hojas (no tienen lienzo de Konva): una hoja con
 * los primeros bloques o la grilla con las primeras celdas.
 */
export function kindThumbnail(doc: DesignDoc): string | null {
  const W = 240;
  const H = doc.kind === 'sheet' ? 150 : Math.round(W * Math.min(1.42, Math.max(0.6, doc.height / doc.width)));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) return null;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);

  if (doc.kind === 'sheet' && doc.sheet) {
    const s = doc.sheet;
    const rows = 8;
    const cols = 5;
    const grid: string[][] = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, ci) => s.cells[`${colName(ci)}${r + 1}`] ?? ''));
    const shown = displayCells(grid);
    const cw = W / cols;
    const rh = H / rows;
    g.strokeStyle = '#d7dbe4';
    g.font = '10px Inter, Arial';
    for (let r = 0; r < rows; r++)
      for (let ci = 0; ci < cols; ci++) {
        g.strokeRect(ci * cw, r * rh, cw, rh);
        g.fillStyle = '#1f2430';
        g.fillText(shown[r][ci].slice(0, 10), ci * cw + 4, r * rh + rh * 0.65, cw - 8);
      }
    return c.toDataURL('image/jpeg', 0.8);
  }

  let y = 18;
  for (const b of doc.blocks ?? []) {
    if (y > H - 10) break;
    const text = textOf(b.html ?? '').trim();
    const size = b.type === 'h1' ? 16 : b.type === 'h2' ? 13 : b.type === 'h3' ? 11 : 8;
    if (b.type === 'divider') {
      g.fillStyle = '#d7dbe4';
      g.fillRect(16, y, W - 32, 1);
      y += 10;
      continue;
    }
    if (b.type === 'table' || b.type === 'chart' || b.type === 'image') {
      g.fillStyle = '#eef0f5';
      g.fillRect(16, y, W - 32, 36);
      y += 44;
      continue;
    }
    if (!text) continue;
    g.fillStyle = b.type.startsWith('h') ? '#1f2430' : '#6b7385';
    g.font = `${b.type.startsWith('h') ? 'bold ' : ''}${size}px Inter, Arial`;
    g.fillText(text.slice(0, 48), 16, y + size, W - 32);
    y += size * 1.7;
  }
  return c.toDataURL('image/jpeg', 0.8);
}
