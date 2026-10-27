import { useCallback, useEffect, useRef, useState } from 'react';
import { createImage, createShape, createText } from '@trazo/shared';
import { getBackend } from '../api/backend';
import { useEditor } from '../store/editorStore';
import { startSession } from '../sync/session';
import { CanvasArea, fitZoom } from '../canvas/CanvasArea';
import { renderPage } from '../canvas/stageRegistry';
import { loadImage } from '../canvas/useImage';
import { ContextBar } from './ContextBar';
import { SidePanel, type PanelKey } from './SidePanels';
import { TopBar } from './TopBar';
import { useUploads } from './uploads';
import { DocEditor } from '../docs/DocEditor';
import { DocExportMenu, SheetExportMenu } from './KindExport';
import { SheetEditor } from '../sheets/SheetEditor';
import { ToolPalette } from '../whiteboard/tools';
import { SiteActions } from './SiteActions';
import { Timeline } from '../video/Timeline';
import { kindThumbnail } from '../docs/thumbnail';
import { Icon } from './icons';

const RAIL: { key: PanelKey; label: string; icon: string }[] = [
  { key: 'templates', label: 'Plantillas', icon: 'templates' },
  { key: 'elements', label: 'Elementos', icon: 'shapes' },
  { key: 'text', label: 'Texto', icon: 'text' },
  { key: 'uploads', label: 'Subidos', icon: 'upload' },
  { key: 'background', label: 'Fondo', icon: 'background' },
  { key: 'position', label: 'Capas', icon: 'layers' },
];

export function Editor({ designId, onHome }: { designId: string; onHome(): void }) {
  const [panel, setPanel] = useState<PanelKey | null>('elements');
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout((toast as unknown as { t?: number }).t);
    (toast as unknown as { t?: number }).t = window.setTimeout(() => setToastMsg(null), 3500);
  }, []);

  // Carga + sesión de sincronización.
  useEffect(() => {
    let stop: (() => void) | undefined;
    let alive = true;
    (async () => {
      try {
        const backend = await getBackend();
        const design = await backend.get(designId);
        if (!alive) return;
        useEditor.getState().load(design.id, design.doc, design.revision);
        setLoaded(true);
        stop = startSession(design.id, backend, () => {
          const d = useEditor.getState().doc;
          // Documentos y hojas no tienen lienzo: su miniatura se dibuja aparte.
          if (d.kind === 'doc' || d.kind === 'email' || d.kind === 'sheet') return kindThumbnail(d);
          const first = d.pages[0];
          return first ? renderPage(first.id, { scale: 320 / Math.max(d.width, d.height), mime: 'image/jpeg', quality: 0.8 }) : null;
        });
        const want = sessionStorage.getItem('trazo:openPanel');
        if (want) {
          sessionStorage.removeItem('trazo:openPanel');
          setPanel(want as PanelKey);
        }
      } catch (e) {
        setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
      stop?.();
    };
  }, [designId]);

  const kind = useEditor((s) => (loaded ? s.doc.kind ?? 'design' : 'design'));
  const canvasKind = kind === 'design' || kind === 'whiteboard' || kind === 'website' || kind === 'video';
  useShortcuts(toast, canvasKind);

  if (error) {
    return (
      <div className="home">
        <div className="banner">No se pudo abrir el diseño: {error}</div>
        <button onClick={onHome}>Volver al inicio</button>
      </div>
    );
  }
  if (!loaded) return <div className="home">Cargando…</div>;

  if (kind === 'sheet') {
    return (
      <div className="editor">
        <TopBar onHome={onHome} toast={toast} exportSlot={<SheetExportMenu />} />
        <SheetEditor />
        {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
      </div>
    );
  }

  if (kind === 'doc' || kind === 'email') {
    return (
      <div className="editor">
        <TopBar onHome={onHome} toast={toast} exportSlot={<DocExportMenu toast={toast} />} />
        <DocEditor kind={kind} />
        {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
      </div>
    );
  }

  return (
    <div className="editor">
      <TopBar onHome={onHome} toast={toast} extra={kind === 'website' ? <SiteActions toast={toast} /> : undefined} exportSlot={kind === 'website' ? <span /> : undefined} />
      <div className="body" style={{ gridTemplateColumns: panel ? '72px 300px 1fr' : '72px 1fr' }}>
        <nav className="rail">
          {RAIL.map((r) => (
            <button key={r.key} className={panel === r.key ? 'active' : ''} onClick={() => setPanel(panel === r.key ? null : r.key)} data-testid={`rail-${r.key}`}>
              <Icon name={r.icon} />
              {r.label}
            </button>
          ))}
        </nav>
        {panel && <SidePanel panel={panel} openPanel={setPanel} />}
        <main className="workspace">
          <ContextBar onOpenPanel={setPanel} />
          <CanvasArea scrollerRef={scrollerRef} />
          {kind === 'whiteboard' && <ToolPalette />}
          {kind === 'video' ? <Timeline /> : <BottomBar scrollerRef={scrollerRef} />}
        </main>
      </div>
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  );
}

function BottomBar({ scrollerRef }: { scrollerRef: React.RefObject<HTMLDivElement | null> }) {
  const zoom = useEditor((s) => s.zoom);
  const pages = useEditor((s) => s.doc.pages);
  const activePageId = useEditor((s) => s.activePageId);
  const doc = useEditor((s) => s.doc);
  const index = pages.findIndex((p) => p.id === activePageId) + 1;
  const st = useEditor.getState;
  return (
    <footer className="bottombar">
      <span className="kbd">Supr eliminar · Ctrl+D duplicar · Flechas mover · Ctrl+rueda zoom</span>
      <span className="spacer" />
      <button className="ghost" title="Alejar" onClick={() => st().setZoom(zoom / 1.2)}>
        <Icon name="minus" size={14} />
      </button>
      <input type="range" min={10} max={400} value={Math.round(zoom * 100)} onChange={(e) => st().setZoom(+e.target.value / 100)} aria-label="Zoom" />
      <button className="ghost" title="Acercar" onClick={() => st().setZoom(zoom * 1.2)}>
        <Icon name="plus" size={14} />
      </button>
      <span style={{ width: 44, textAlign: 'right' }} data-testid="zoom">{Math.round(zoom * 100)}%</span>
      <button className="ghost" title="Ajustar a la ventana" onClick={() => st().setZoom(fitZoom(scrollerRef.current, doc.width, doc.height))}>
        <Icon name="fit" size={14} />
      </button>
      <span data-testid="page-counter">Página {index} de {pages.length}</span>
    </footer>
  );
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

function useShortcuts(toast: (m: string) => void, canvasKind: boolean) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const st = useEditor.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      // En documentos y hojas solo aplican deshacer y rehacer: el resto es del lienzo.
      if (!canvasKind) {
        if (mod && key === 'z' && !e.shiftKey) return e.preventDefault(), st.undo();
        if (mod && (key === 'y' || (key === 'z' && e.shiftKey))) return e.preventDefault(), st.redo();
        return;
      }
      const sel = st.selectedIds.length > 0;
      const handled = () => e.preventDefault();

      if (mod && key === 'z' && !e.shiftKey) return handled(), st.undo();
      if (mod && (key === 'y' || (key === 'z' && e.shiftKey))) return handled(), st.redo();
      if (mod && key === 'a') return handled(), st.selectAll();
      if (mod && key === 'c' && sel) return handled(), st.copy();
      if (mod && key === 'x' && sel) return handled(), st.cut();
      if (mod && key === 'd' && sel) return handled(), st.duplicateSelected();
      if (mod && (key === '+' || key === '=')) return handled(), st.setZoom(st.zoom * 1.2);
      if (mod && key === '-') return handled(), st.setZoom(st.zoom / 1.2);
      if (mod && ['b', 'i', 'u'].includes(key) && sel) {
        handled();
        st.updateElements(st.selectedIds, (el) => {
          if (el.type !== 'text') return;
          if (key === 'u') el.textDecoration = el.textDecoration ? '' : 'underline';
          else {
            const b = el.fontStyle.includes('bold') !== (key === 'b');
            const i = el.fontStyle.includes('italic') !== (key === 'i');
            el.fontStyle = b && i ? 'bold italic' : b ? 'bold' : i ? 'italic' : 'normal';
          }
        }, { label: 'Estilo de texto' });
        return;
      }
      if (mod) return;
      if ((key === 'delete' || key === 'backspace') && sel) return handled(), st.deleteSelected();
      if (key === 'escape') return st.clearSelection();
      if (key.startsWith('arrow') && sel) {
        handled();
        const step = e.shiftKey ? 10 : 1;
        const d = { arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, -step], arrowdown: [0, step] }[key]!;
        return st.nudge(d[0], d[1]);
      }
      if (key === 'enter' && st.selectedIds.length === 1) {
        const el = st.doc.pages.flatMap((p) => p.elements).find((x) => x.id === st.selectedIds[0]);
        if (el?.type === 'text') return handled(), st.setEditingText(el.id);
      }
      if (key === 't') {
        const el = createText(st.doc, 'body');
        st.addElement(el);
        return handled(), st.setEditingText(el.id);
      }
      const shape = ({ r: 'rect', c: 'ellipse', l: 'line' } as const)[key as 'r' | 'c' | 'l'];
      if (shape) return handled(), st.addElement(createShape(st.doc, shape));
    };

    // Pegar: imágenes del portapapeles del sistema o elementos copiados en el editor.
    const onPaste = async (e: ClipboardEvent) => {
      if (!canvasKind) return;
      if (isTyping(e.target)) return;
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
      const st = useEditor.getState();
      if (files.length) {
        e.preventDefault();
        for (const f of files) {
          const url = await useUploads.getState().upload(f);
          const img = await loadImage(url);
          st.addElement(createImage(st.doc, url, img.naturalWidth, img.naturalHeight));
        }
        toast('Imagen pegada');
        return;
      }
      const text = e.clipboardData?.getData('text/plain');
      if (st.clipboard.length) {
        e.preventDefault();
        st.paste();
      } else if (text) {
        e.preventDefault();
        st.addElement(createText(st.doc, 'body', { text }));
      }
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste);
    };
  }, [toast, canvasKind]);
}
