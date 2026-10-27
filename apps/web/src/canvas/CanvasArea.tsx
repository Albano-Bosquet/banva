import { useEffect, useRef, useState } from 'react';
import Konva from 'konva';
import { setTextMeasurer, useEditor } from '../store/editorStore';
import { PageStage } from './PageStage';
import { preloadFonts } from './fonts';
import { mediaKind, useUploads } from '../editor/uploads';
import { insertImage, insertVideo } from '../editor/insert';
import { Icon } from '../editor/icons';

const probe = new Konva.Text();
setTextMeasurer((el) => {
  probe.setAttrs({
    text: el.text || ' ',
    width: el.width,
    fontFamily: el.fontFamily,
    fontSize: el.fontSize,
    fontStyle: el.fontStyle,
    lineHeight: el.lineHeight,
    letterSpacing: el.letterSpacing,
    wrap: 'word',
  });
  return probe.height();
});

/** Zoom que hace entrar la página en el área visible (el "ajustar" del editor observado). */
export function fitZoom(container: HTMLElement | null, w: number, h: number): number {
  if (!container) return 0.5;
  const availW = container.clientWidth - 96;
  const availH = container.clientHeight - 110;
  return Math.max(0.05, Math.min(availW / w, availH / h, 2));
}

export function CanvasArea({ scrollerRef }: { scrollerRef: React.RefObject<HTMLDivElement | null> }) {
  const doc = useEditor((s) => s.doc);
  const zoom = useEditor((s) => s.zoom);
  const activePageId = useEditor((s) => s.activePageId);
  const designId = useEditor((s) => s.designId);
  // La pizarra es una sola superficie: sin encabezados de página ni "Agregar página".
  const whiteboard = useEditor((s) => s.doc.kind === 'whiteboard');
  // Sitios web: secciones; videos: escenas (los nombres del editor observado).
  const noun = useEditor((s) => (s.doc.kind === 'website' ? 'Sección' : s.doc.kind === 'video' ? 'Escena' : 'Página'));
  const [fontsVersion, setFontsVersion] = useState(0);
  const fitted = useRef<string | null>(null);

  // Ajustar al abrir cada diseño.
  useEffect(() => {
    if (fitted.current === designId) return;
    fitted.current = designId;
    // La pizarra empieza cerca (no se ve entera, como una superficie sin bordes).
    useEditor.getState().setZoom(whiteboard ? 0.6 : fitZoom(scrollerRef.current, doc.width, doc.height));
  }, [designId, doc.width, doc.height, scrollerRef]);

  // Al terminar de cargar una web font hay que volver a medir y dibujar los textos.
  useEffect(() => {
    const bump = () => {
      setFontsVersion((v) => v + 1);
      const st = useEditor.getState();
      // Recalcula alturas guardadas sin ensuciar el historial si nada cambia.
      st.commit('Ajustar texto', () => {}, { skipHistory: true });
    };
    document.fonts.ready.then(bump);
    void preloadFonts().then(bump);
    document.fonts.addEventListener('loadingdone', bump);
    return () => document.fonts.removeEventListener('loadingdone', bump);
  }, []);

  // Mantener visible la página activa (p. ej. al agregar o duplicar una página).
  useEffect(() => {
    scrollerRef.current?.querySelector(`[data-page-id="${activePageId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activePageId, scrollerRef]);

  // Ctrl + rueda = zoom.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const st = useEditor.getState();
      st.setZoom(st.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [scrollerRef]);

  const upload = useUploads((s) => s.upload);
  const [dragOver, setDragOver] = useState(false);

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const pageEl = (e.target as HTMLElement).closest<HTMLElement>('[data-page-id]');
    const pageId = pageEl?.dataset.pageId;
    const st = useEditor.getState();
    let at: { x: number; y: number } | undefined;
    if (pageEl) {
      const r = pageEl.getBoundingClientRect();
      at = { x: (e.clientX - r.left) / st.zoom, y: (e.clientY - r.top) / st.zoom };
    }
    const dragged = e.dataTransfer.getData('text/x-trazo-image');
    const files = [...e.dataTransfer.files].filter((f) => /^(image|video)\//.test(f.type));
    const urls = dragged ? [dragged] : await Promise.all(files.map((f) => upload(f)));
    for (const url of urls) {
      // Soltar sobre un marco o una celda de cuadrícula la rellena (lo resuelve insertImage).
      if (mediaKind(url) === 'video') await insertVideo(url, { pageId, at });
      else await insertImage(url, { pageId, at });
    }
  };

  return (
    <div
      className="scroller"
      ref={scrollerRef}
      onDragOver={(e) => {
        e.preventDefault();
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onMouseDown={(e) => {
        // Clic en el área gris fuera de las páginas: deseleccionar.
        if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('pages')) useEditor.getState().clearSelection();
      }}
    >
      <div className="pages">
        {doc.pages.map((page, i) => (
          <div className="page-wrap" key={page.id}>
            {!whiteboard && <PageHeader index={i} total={doc.pages.length} pageId={page.id} title={page.title} noun={noun} />}
            <PageStage page={page} width={doc.width} height={doc.height} zoom={zoom} active={page.id === activePageId} fontsVersion={fontsVersion} />
          </div>
        ))}
        {!whiteboard && <button className="add-page" style={{ width: doc.width * zoom }} onClick={() => useEditor.getState().addPage()} data-testid="add-page">
          <Icon name="plus" /> {noun === 'Sección' ? 'Agregar una sección' : noun === 'Escena' ? 'Agregar una escena' : 'Agregar página'}
        </button>}
      </div>
    </div>
  );
}

function PageHeader({ index, total, pageId, title, noun }: { index: number; total: number; pageId: string; title: string; noun: string }) {
  const st = useEditor.getState;
  return (
    <div className="page-head">
      <strong>
        {noun} {index + 1}
      </strong>
      <input value={title} placeholder="Agregar título de página" onChange={(e) => st().renamePage(pageId, e.target.value)} aria-label={`Título de la página ${index + 1}`} />
      <span className="spacer" />
      <button className="ghost" title="Subir página" disabled={index === 0} onClick={() => st().movePage(pageId, -1)}>
        <Icon name="up" />
      </button>
      <button className="ghost" title="Bajar página" disabled={index === total - 1} onClick={() => st().movePage(pageId, 1)}>
        <Icon name="down" />
      </button>
      <button className="ghost" title="Duplicar página" onClick={() => st().duplicatePage(pageId)}>
        <Icon name="copy" />
      </button>
      <button className="ghost" title="Eliminar página" disabled={total === 1} onClick={() => st().deletePage(pageId)}>
        <Icon name="trash" />
      </button>
      <button className="ghost" title="Agregar página debajo" onClick={() => st().addPage(pageId)}>
        <Icon name="plus" />
      </button>
    </div>
  );
}
