import { useEffect, useRef, useState } from 'react';
import { useEditor } from '../store/editorStore';
import { usePresence } from '../sync/session';
import type { ExportFormat } from '../export/exporter';
import { Icon } from './icons';
import { Logo } from '../Logo';

const STATUS_LABEL = {
  saved: 'Se guardaron todos los cambios',
  dirty: 'Cambios sin guardar',
  saving: 'Guardando…',
  offline: 'Guardado en este navegador',
  error: 'Error al guardar, reintentando',
} as const;

/**
 * Barra superior común a todos los tipos de diseño. `exportSlot` reemplaza el menú
 * Descargar (documentos, hojas, sitios y videos tienen sus propias salidas).
 */
export function TopBar({ onHome, toast, exportSlot, extra }: { onHome(): void; toast(msg: string): void; exportSlot?: React.ReactNode; extra?: React.ReactNode }) {
  const title = useEditor((s) => s.doc.title);
  const kind = useEditor((s) => s.doc.kind ?? 'design');
  const canvasKind = kind === 'design' || kind === 'video' || kind === 'website';
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const status = useEditor((s) => s.saveStatus);
  const peers = usePresence((s) => s.peers);
  const clientId = usePresence((s) => s.clientId);
  const [draftTitle, setDraftTitle] = useState(title);
  useEffect(() => setDraftTitle(title), [title]);

  const st = useEditor.getState;
  return (
    <header className="topbar">
      <button className="ghost home-btn" onClick={onHome} title="Volver al inicio" data-testid="home">
        <Logo size={28} />
      </button>
      <span className="topbar-sep" />
      {canvasKind && <ResizeMenu toast={toast} />}
      <button className="ghost" disabled={!canUndo} onClick={() => st().undo()} title="Deshacer (Ctrl+Z)" data-testid="undo">
        <Icon name="undo" />
      </button>
      <button className="ghost" disabled={!canRedo} onClick={() => st().redo()} title="Rehacer (Ctrl+Y)" data-testid="redo">
        <Icon name="redo" />
      </button>
      <span className={`save-status ${status}`} title={STATUS_LABEL[status]} data-testid="save-status" data-status={status}>
        <span className="dot" />
        {STATUS_LABEL[status]}
      </span>
      <span className="spacer" />
      <input
        className="title-input"
        value={draftTitle}
        aria-label="Título del diseño"
        onChange={(e) => setDraftTitle(e.target.value)}
        onBlur={() => draftTitle !== title && st().setTitle(draftTitle)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      {extra}
      {(kind === 'design' || kind === 'video') && <button
        className="ghost"
        title="Presentar (pantalla completa, con animaciones, video, audio y formularios)"
        data-testid="present"
        onClick={() => {
          const id = useEditor.getState().designId;
          if (id) location.hash = `#/v/${id}`;
        }}
      >
        <Icon name="present" /> Presentar
      </button>}
      <span className="peers" title="Personas en este diseño">
        {peers.map((p) => (
          <span key={p.clientId} style={{ background: p.color }} title={p.clientId === clientId ? 'Vos' : p.name}>
            {p.clientId === clientId ? 'Yo' : p.name.slice(0, 1)}
          </span>
        ))}
      </span>
      {exportSlot ?? <ExportMenu toast={toast} />}
    </header>
  );
}

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return { open, setOpen, ref };
}

const SIZE_PRESETS: [string, number, number][] = [
  ['Post cuadrado', 1080, 1080],
  ['Historia', 1080, 1920],
  ['Presentación 16:9', 1920, 1080],
  ['A4 (96 ppp)', 794, 1123],
];

function ResizeMenu({ toast }: { toast(msg: string): void }) {
  const { open, setOpen, ref } = usePopover();
  const doc = useEditor((s) => s.doc);
  const [w, setW] = useState(doc.width);
  const [h, setH] = useState(doc.height);
  const [scale, setScale] = useState(true);
  useEffect(() => {
    setW(doc.width);
    setH(doc.height);
  }, [doc.width, doc.height, open]);
  const apply = () => {
    if (w > 0 && h > 0 && w <= 10000 && h <= 10000) {
      useEditor.getState().resizeDesign(Math.round(w), Math.round(h), scale);
      setOpen(false);
      toast(`Diseño redimensionado a ${Math.round(w)} × ${Math.round(h)} px`);
    }
  };
  return (
    <div className="popover-anchor" ref={ref}>
      <button className="ghost" onClick={() => setOpen(!open)} data-testid="resize">
        <Icon name="resize" /> Redimensionar
      </button>
      {open && (
        <div className="popover" style={{ left: 0, right: 'auto' }}>
          <h4>Redimensionar</h4>
          <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {SIZE_PRESETS.map(([label, pw, ph]) => (
              <button key={label} onClick={() => (setW(pw), setH(ph))} className={w === pw && h === ph ? 'active' : ''}>
                {label} <small style={{ marginLeft: 'auto', opacity: 0.6 }}>{pw} × {ph}</small>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <label className="field">Ancho<input type="number" value={w} onChange={(e) => setW(+e.target.value)} /></label>
            <label className="field">Alto<input type="number" value={h} onChange={(e) => setH(+e.target.value)} /></label>
          </div>
          <label className="check">
            <input type="checkbox" checked={scale} onChange={(e) => setScale(e.target.checked)} /> Escalar el contenido
          </label>
          <button className="primary" onClick={apply}>Aplicar</button>
        </div>
      )}
    </div>
  );
}

function ExportMenu({ toast }: { toast(msg: string): void }) {
  const { open, setOpen, ref } = usePopover();
  const doc = useEditor((s) => s.doc);
  const activePageId = useEditor((s) => s.activePageId);
  const [format, setFormat] = useState<ExportFormat>('png');
  const [scale, setScale] = useState(1);
  const [which, setWhich] = useState<'all' | 'current'>('all');
  const [transparent, setTransparent] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      useEditor.getState().clearSelection();
      // Un frame para que desaparezcan selección y guías antes de rasterizar.
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      // pdf-lib se carga solo al exportar.
      const { exportDesign, downloadFiles } = await import('../export/exporter');
      const files = await exportDesign(doc, {
        format,
        scale,
        transparent,
        quality: 0.92,
        pageIds: which === 'all' ? doc.pages.map((p) => p.id) : [activePageId],
      });
      downloadFiles(files);
      toast(`Exportado: ${files.map((f) => f.name).join(', ')}`);
      setOpen(false);
    } catch (e) {
      toast(`No se pudo exportar: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="popover-anchor" ref={ref}>
      <button className="primary" onClick={() => setOpen(!open)} data-testid="export-open">
        <Icon name="download" /> Descargar
      </button>
      {open && (
        <div className="popover" data-testid="export-menu">
          <h4>Descargar</h4>
          <div className="field">
            Tipo de archivo
            <div className="seg">
              {(['png', 'jpg', 'pdf'] as const).map((f) => (
                <button key={f} className={format === f ? 'active' : ''} onClick={() => setFormat(f)} data-testid={`format-${f}`}>
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            Tamaño ×{scale} · {Math.round(doc.width * scale)} × {Math.round(doc.height * scale)} px
            <input type="range" min={0.5} max={3} step={0.5} value={scale} onChange={(e) => setScale(+e.target.value)} />
          </label>
          {format === 'png' && (
            <label className="check">
              <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} /> Fondo transparente
            </label>
          )}
          <div className="field">
            Páginas
            <div className="seg">
              <button className={which === 'all' ? 'active' : ''} onClick={() => setWhich('all')}>Todas ({doc.pages.length})</button>
              <button className={which === 'current' ? 'active' : ''} onClick={() => setWhich('current')}>Esta página</button>
            </div>
          </div>
          <button className="primary" onClick={run} disabled={busy} data-testid="export-run">
            {busy ? 'Generando…' : 'Descargar'}
          </button>
        </div>
      )}
    </div>
  );
}
