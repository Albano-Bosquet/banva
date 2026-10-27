import { useEffect, useState } from 'react';
import { Layer, Rect, Stage } from 'react-konva';
import type { Design } from '@trazo/shared';
import { getBackend } from './api/backend';
import { ElementNode } from './canvas/ElementNode';
import { usePlayback } from './canvas/animation';
import { videoRegistry } from './canvas/bodies';
import { useFontsVersion } from './canvas/fonts';
import { FormHtml } from './Presenter';

/**
 * Visor de sitios web (#/w/<id>): las secciones apiladas, escaladas al ancho de la
 * ventana, con formularios interactivos y videos en reproducción. Es la "Vista previa"
 * y también la página publicada.
 */
export function SiteView({ designId }: { designId: string }) {
  const [design, setDesign] = useState<Design | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [w, setW] = useState(window.innerWidth);
  const fonts = useFontsVersion();

  useEffect(() => {
    getBackend()
      .then((b) => b.get(designId))
      .then((d) => {
        setDesign(d);
        document.title = d.doc.title;
      })
      .catch((e: Error) => setError(e.message));
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [designId]);

  // Animaciones de entrada y videos al cargar.
  useEffect(() => {
    if (!design) return;
    const t = setTimeout(() => {
      for (const p of design.doc.pages) {
        usePlayback.getState().play(`site-${p.id}`);
        for (const el of p.elements) if (el.type === 'video') void videoRegistry.get(el.id)?.play().catch(() => {});
      }
    }, 80);
    return () => clearTimeout(t);
  }, [design]);

  if (error) return <div className="presenter-msg">No se encontró el sitio: {error}</div>;
  if (!design) return <div className="presenter-msg">Cargando…</div>;
  const { width, height } = design.doc;
  const scale = w / width;

  return (
    <div className="site-view" data-testid="site-view">
      {!design.doc.published && <div className="site-banner">Vista previa · este sitio todavía no está publicado</div>}
      {design.doc.pages.map((page) => (
        <section key={page.id} className="site-section" style={{ width: width * scale, height: height * scale }}>
          <Stage width={width * scale} height={height * scale} scaleX={scale} scaleY={scale}>
            <Layer listening={false} key={fonts}>
              <Rect width={width} height={height} fill={page.background} />
              {page.elements
                .filter((el) => el.type !== 'form')
                .map((el, i) => (
                  <ElementNode key={el.id} el={el} readOnly pageId={`site-${page.id}`} delay={i * 100} />
                ))}
            </Layer>
          </Stage>
          {page.elements.map((el) => el.type === 'form' && el.visible && <FormHtml key={el.id} el={el} scale={scale} designId={designId} />)}
        </section>
      ))}
      <footer className="site-footer">Hecho con Banva</footer>
    </div>
  );
}
