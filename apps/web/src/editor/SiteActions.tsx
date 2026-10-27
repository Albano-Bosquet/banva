import { useEffect, useRef, useState } from 'react';
import { useEditor } from '../store/editorStore';
import { Icon } from './icons';

/** Sitio web: "Vista previa" y "Publicar el sitio web" (como en el editor observado). */
export function SiteActions({ toast }: { toast(msg: string): void }) {
  const id = useEditor((s) => s.designId);
  const published = useEditor((s) => !!s.doc.published);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const url = `${location.origin}${location.pathname}#/w/${id}`;
  const setPublished = (v: boolean) => useEditor.getState().commit(v ? 'Publicar sitio' : 'Despublicar sitio', (d) => void (d.published = v));

  return (
    <>
      <button className="ghost" onClick={() => window.open(url, '_blank')} data-testid="site-preview">
        <Icon name="eye" /> Vista previa
      </button>
      <div className="popover-anchor" ref={ref}>
        <button className="primary" onClick={() => setOpen(!open)} data-testid="site-publish">
          <Icon name="globe" /> {published ? 'Publicado' : 'Publicar el sitio web'}
        </button>
        {open && (
          <div className="popover" data-testid="publish-menu">
            <h4>{published ? 'Tu sitio está publicado' : 'Publicar el sitio web'}</h4>
            <p className="kbd">Cualquier persona con el enlace puede verlo. Los cambios que hagas se publican al guardarse.</p>
            <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Enlace del sitio" data-testid="site-url" />
            <div style={{ display: 'flex', gap: 6 }}>
              {published ? (
                <button onClick={() => setPublished(false)}>Despublicar</button>
              ) : (
                <button className="primary" onClick={() => setPublished(true)} data-testid="site-publish-confirm">
                  Publicar
                </button>
              )}
              <button
                onClick={() =>
                  navigator.clipboard.writeText(url).then(
                    () => toast('Enlace copiado'),
                    () => toast('No se pudo copiar el enlace'),
                  )
                }
              >
                Copiar enlace
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
