import { create } from 'zustand';
import { createShape, createTable, createText, newId, type DesignElement, type StickyElement } from '@trazo/shared';
import { useEditor } from '../store/editorStore';
import { usePresence } from '../sync/session';
import { Icon } from '../editor/icons';

/** Herramientas de la pizarra (las observadas: seleccionar, sección, dibujo, formas, líneas, notas, texto, tablas). */
export type WbTool = 'select' | 'section' | 'draw' | 'rect' | 'ellipse' | 'line' | 'sticky' | 'text' | 'table';

/** Seis colores de nota adhesiva, como en el editor observado. */
export const STICKY_COLORS = ['#fff3a3', '#ffd19e', '#ffb3c1', '#b8dcff', '#bff0c8', '#dcc8ff'];
export const PEN_COLORS = ['#1f2430', '#e8402a', '#2f7cf6', '#2e9e5b', '#8a5cff'];

interface ToolState {
  tool: WbTool;
  stickyColor: string;
  penColor: string;
  penWidth: number;
  set(p: Partial<Omit<ToolState, 'set'>>): void;
}

export const useWbTool = create<ToolState>((set) => ({
  tool: 'select',
  stickyColor: STICKY_COLORS[0],
  penColor: PEN_COLORS[0],
  penWidth: 4,
  set: (p) => set(p),
}));

const STICKY = 220;

export function createSticky(x: number, y: number, color: string, text = ''): StickyElement {
  const me = usePresence.getState();
  const author = me.peers.find((p) => p.clientId === me.clientId)?.name;
  return { id: newId(), type: 'sticky', x, y, width: STICKY, height: STICKY, rotation: 0, opacity: 1, locked: false, visible: true, text, color, fontSize: 18, author };
}

/** Crea el elemento de la herramienta en (x, y) (coordenadas de la pizarra) y lo devuelve. */
export function placeTool(tool: WbTool, x: number, y: number): DesignElement | null {
  const st = useEditor.getState();
  const box = { width: 1000, height: 1000 };
  const t = useWbTool.getState();
  let el: DesignElement | null = null;
  if (tool === 'sticky') el = createSticky(x - STICKY / 2, y - STICKY / 2, t.stickyColor);
  if (tool === 'rect' || tool === 'ellipse') el = createShape(box, tool, { x: x - 90, y: y - 70, width: 180, height: 140, fill: '#ffffff', stroke: '#1f2430', strokeWidth: 3 });
  if (tool === 'line') el = createShape(box, 'line', { x: x - 120, y: y - 12, width: 240, height: 24, fill: '#1f2430', arrow: 'end' });
  if (tool === 'text') el = createText(box, 'body', { x: x - 150, y: y - 20, width: 300, fontSize: 28, text: 'Texto', align: 'left' });
  if (tool === 'table') el = createTable(box, 3, 3, 'header', '#5b6cff', { x: x - 210, y: y - 70, width: 420, height: 140, fontSize: 16 });
  // Sección: un área con título para agrupar ideas.
  if (tool === 'section') el = createShape(box, 'rect', { x: x - 300, y: y - 200, width: 600, height: 400, fill: '#f5f6fa', stroke: '#c9cede', strokeWidth: 2, cornerRadius: 16, name: 'Sección' });
  if (!el) return null;
  st.addElement(el);
  if (tool === 'section') st.arrange('back');
  if (el.type === 'sticky' || el.type === 'text') st.setEditingText(el.id);
  return el;
}

/** Nota contigua (el "+" de cada lado de una nota). */
export function addAdjacentSticky(from: StickyElement, dir: 'top' | 'right' | 'bottom' | 'left') {
  const gap = 24;
  const dx = dir === 'right' ? from.width + gap : dir === 'left' ? -from.width - gap : 0;
  const dy = dir === 'bottom' ? from.height + gap : dir === 'top' ? -from.height - gap : 0;
  const el = createSticky(from.x + dx, from.y + dy, from.color);
  useEditor.getState().addElement(el);
  useEditor.getState().setEditingText(el.id);
}

const TOOLS: { tool: WbTool; label: string; icon: string }[] = [
  { tool: 'select', label: 'Seleccionar', icon: 'cursor' },
  { tool: 'section', label: 'Sección', icon: 'section' },
  { tool: 'draw', label: 'Dibujo', icon: 'pen' },
  { tool: 'rect', label: 'Rectángulo', icon: 'square' },
  { tool: 'ellipse', label: 'Círculo', icon: 'circle' },
  { tool: 'line', label: 'Líneas', icon: 'arrow' },
  { tool: 'sticky', label: 'Notas adhesivas', icon: 'sticky' },
  { tool: 'text', label: 'Texto', icon: 'text' },
  { tool: 'table', label: 'Tablas', icon: 'table' },
];

/** Paleta flotante de herramientas, con las opciones de la herramienta elegida. */
export function ToolPalette() {
  const t = useWbTool();
  return (
    <div className="wb-palette" data-testid="wb-palette">
      {TOOLS.map((x) => (
        <button key={x.tool} className={t.tool === x.tool ? 'active' : ''} title={x.label} aria-label={x.label} onClick={() => t.set({ tool: x.tool })} data-testid={`wb-${x.tool}`}>
          {x.tool === 'sticky' ? <span className="sticky-chip" style={{ background: t.stickyColor }} /> : <Icon name={x.icon} />}
        </button>
      ))}
      {t.tool === 'sticky' && (
        <div className="wb-sub">
          {STICKY_COLORS.map((c) => (
            <button key={c} className={t.stickyColor === c ? 'active' : ''} onClick={() => t.set({ stickyColor: c })} aria-label={`Nota ${c}`}>
              <span className="sticky-chip" style={{ background: c }} />
            </button>
          ))}
        </div>
      )}
      {t.tool === 'draw' && (
        <div className="wb-sub">
          {PEN_COLORS.map((c) => (
            <button key={c} className={t.penColor === c ? 'active' : ''} onClick={() => t.set({ penColor: c })} aria-label={`Color ${c}`}>
              <span className="pen-dot" style={{ background: c }} />
            </button>
          ))}
          {[2, 4, 8, 16].map((w) => (
            <button key={w} className={t.penWidth === w ? 'active' : ''} onClick={() => t.set({ penWidth: w })} aria-label={`Grosor ${w}`}>
              <span className="pen-dot" style={{ width: Math.min(16, w + 2), height: Math.min(16, w + 2), background: '#4a5263' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
