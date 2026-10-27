import { useCallback, useEffect, useRef, useState } from 'react';
import { Layer, Rect, Stage } from 'react-konva';
import type { Design, FormElement } from '@trazo/shared';
import { getBackend } from './api/backend';
import { ElementNode } from './canvas/ElementNode';
import { usePlayback } from './canvas/animation';
import { useFontsVersion } from './canvas/fonts';
import KonvaLib from 'konva';
import type Konva from 'konva';
import { startRecording, type Recorder } from './video/record';
import { readableOn, videoRegistry } from './canvas/bodies';
import { Icon } from './editor/icons';

/**
 * Vista de presentación (#/v/<id>): páginas a pantalla completa con animaciones de
 * entrada, videos, audio del diseño y formularios interactivos que guardan respuestas.
 */
export function Presenter({ designId, onExit }: { designId: string; onExit(): void }) {
  const [design, setDesign] = useState<Design | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [audioOn, setAudioOn] = useState(false);
  const audios = useRef<HTMLAudioElement[]>([]);
  const fonts = useFontsVersion();
  const stageRef = useRef<Konva.Stage>(null);
  // Video: las escenas avanzan solas según su duración.
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState<Recorder | null>(null);
  const isVideo = design?.doc.kind === 'video';

  useEffect(() => {
    getBackend()
      .then((b) => b.get(designId))
      .then(setDesign)
      .catch((e: Error) => setError(e.message));
  }, [designId]);

  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  const pages = design?.doc.pages ?? [];
  const page = pages[index];
  const go = useCallback((d: number) => setIndex((i) => Math.max(0, Math.min(pages.length - 1, i + d))), [pages.length]);

  // Un video empieza a reproducirse solo (con su audio) al abrir la vista.
  useEffect(() => {
    if (!isVideo) return;
    setPlaying(true);
    setAudioOn(true);
  }, [isVideo]);

  useEffect(() => {
    if (!isVideo || !playing || !page) return;
    const t = setTimeout(() => {
      if (index < pages.length - 1) setIndex(index + 1);
      else {
        setPlaying(false);
        setAudioOn(false);
        recording?.stop();
      }
    }, (page.duration ?? 5) * 1000);
    return () => clearTimeout(t);
  }, [isVideo, playing, page, index, pages.length, recording]);

  /** Exportar video: se graba la reproducción (con animaciones y video) y el audio en WebM. */
  const record = () => {
    if (!design || !stageRef.current) return;
    setIndex(0);
    setAudioOn(false);
    const rec = startRecording(design.doc.width, design.doc.height, () => KonvaLib.stages.find((st) => st.container().isConnected && !!st.container().closest('.presenter')) ?? null, design.doc.audio ?? [], `${design.doc.title || 'video'}.webm`, () => {
      setRecording(null);
      setPlaying(false);
    });
    setRecording(rec);
    setPlaying(true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Mientras se escribe en un campo del formulario, las teclas son del campo.
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('input, textarea, select')) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') go(1);
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1);
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onExit]);

  // Entradas animadas y videos al mostrar cada página.
  useEffect(() => {
    if (!page) return;
    const t = setTimeout(() => {
      usePlayback.getState().play(`view-${page.id}`);
      for (const el of page.elements) if (el.type === 'video') void videoRegistry.get(el.id)?.play().catch(() => {});
    }, 60);
    return () => clearTimeout(t);
  }, [page]);

  // Audio del diseño: se activa con un clic (los navegadores bloquean el sonido automático).
  useEffect(() => {
    const tracks = design?.doc.audio ?? [];
    audios.current.forEach((a) => a.pause());
    audios.current = [];
    if (!audioOn) return;
    audios.current = tracks.map((t) => {
      const a = new Audio(t.src);
      a.loop = true;
      a.volume = t.volume;
      void a.play().catch(() => setAudioOn(false));
      return a;
    });
    return () => audios.current.forEach((a) => a.pause());
  }, [audioOn, design]);

  if (error) return <div className="presenter-msg">No se pudo abrir el diseño: {error}</div>;
  if (!design || !page) return <div className="presenter-msg">Cargando…</div>;

  const { width, height } = design.doc;
  const scale = Math.min((size.w - 32) / width, (size.h - 88) / height);

  return (
    <div className="presenter" data-testid="presenter">
      <div className="stage-wrap" style={{ width: width * scale, height: height * scale }}>
        <Stage ref={stageRef} width={width * scale} height={height * scale} scaleX={scale} scaleY={scale} key={page.id}>
          <Layer listening={false} key={fonts}>
            <Rect width={width} height={height} fill={page.background} />
            {page.elements
              .filter((el) => el.type !== 'form')
              .map((el, i) => (
                <ElementNode key={el.id} el={el} readOnly pageId={`view-${page.id}`} delay={i * 120} />
              ))}
          </Layer>
        </Stage>
        {page.elements.map((el) => el.type === 'form' && el.visible && <FormHtml key={el.id} el={el} scale={scale} designId={designId} />)}
      </div>
      <footer className="presenter-bar">
        <button className="ghost" onClick={onExit} title="Salir (Esc)">
          <Icon name="close" /> Salir
        </button>
        <span className="spacer" />
        <button className="ghost" disabled={index === 0} onClick={() => go(-1)} title="Anterior" data-testid="prev-page">
          <Icon name="back" />
        </button>
        <span data-testid="present-counter">
          {index + 1} / {pages.length}
        </span>
        <button className="ghost" disabled={index === pages.length - 1} onClick={() => go(1)} title="Siguiente" data-testid="next-page">
          <Icon name="back" />
        </button>
        <span className="spacer" />
        {isVideo && (
          <>
            <button className="ghost" disabled={!!recording} onClick={() => (playing ? (setPlaying(false), setAudioOn(false)) : (setPlaying(true), setAudioOn(true)))} data-testid="video-toggle">
              <Icon name={playing ? 'pause' : 'play'} /> {playing ? 'Pausar' : 'Reproducir'}
            </button>
            <button className="ghost" disabled={!!recording} onClick={record} title="Graba la reproducción completa con audio" data-testid="video-export">
              <Icon name="download" /> {recording ? 'Grabando…' : 'Exportar video (WebM)'}
            </button>
          </>
        )}
        {!isVideo && (design.doc.audio?.length ?? 0) > 0 && (
          <button className="ghost" onClick={() => setAudioOn(!audioOn)} title="Audio del diseño">
            <Icon name={audioOn ? 'pause' : 'play'} /> {audioOn ? 'Pausar audio' : 'Reproducir audio'}
          </button>
        )}
      </footer>
    </div>
  );
}

/** Formulario como HTML real sobre el lienzo, con la misma grilla (ancho / 18) que en el editor. */
export function FormHtml({ el, scale, designId }: { el: FormElement; scale: number; designId: string }) {
  const [values, setValues] = useState<Record<string, string | number>>({});
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const u = el.width / 18;
  const field = el.textColor === '#ffffff' ? 'rgba(255,255,255,0.18)' : '#ffffff';
  const border = el.textColor === '#ffffff' ? 'rgba(255,255,255,0.35)' : '#cfd4df';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    try {
      await (await getBackend()).submitResponse(designId, el.id, values);
      setState('sent');
    } catch (err) {
      setMsg((err as Error).message);
      setState('error');
    }
  };

  const inputStyle: React.CSSProperties = { background: field, border: `${u * 0.06}px solid ${border}`, borderRadius: u * 0.3, color: el.textColor, font: 'inherit', padding: `0 ${u * 0.4}px`, width: '100%' };

  return (
    <form
      className="form-html"
      data-testid="form-html"
      onSubmit={submit}
      style={{
        left: el.x * scale,
        top: el.y * scale,
        width: el.width,
        height: el.height,
        transform: `scale(${scale}) rotate(${el.rotation}deg)`,
        background: el.background,
        color: el.textColor,
        fontFamily: el.fontFamily,
        fontSize: u * 0.78,
        borderRadius: u * 0.8,
        padding: `${u * 1.1}px ${u}px`,
        opacity: el.opacity,
      }}
    >
      {state === 'sent' ? (
        <div className="form-thanks" style={{ fontSize: u * 1.1 }}>
          ¡Gracias! Recibimos tu respuesta.
        </div>
      ) : (
        <>
          <div style={{ fontSize: u * 1.17, fontWeight: 700, height: u * 2.3 }}>{el.title}</div>
          {el.fields.map((f) => (
            <label key={f.id} style={{ display: 'block', marginBottom: u * 0.4 }}>
              <span style={{ opacity: 0.85 }}>
                {f.label}
                {f.required ? ' *' : ''}
              </span>
              {(f.kind === 'text' || f.kind === 'email') && (
                <input type={f.kind} required={f.required} style={{ ...inputStyle, height: u * 1.4, marginTop: u * 0.25 }} value={String(values[f.id] ?? '')} onChange={(e) => setValues({ ...values, [f.id]: e.target.value })} name={f.id} />
              )}
              {f.kind === 'textarea' && (
                <textarea required={f.required} style={{ ...inputStyle, height: u * 2.8, marginTop: u * 0.25, resize: 'none', padding: u * 0.3 }} value={String(values[f.id] ?? '')} onChange={(e) => setValues({ ...values, [f.id]: e.target.value })} name={f.id} />
              )}
              {f.kind === 'rating' && (
                <span style={{ display: 'flex', gap: u * 0.3, marginTop: u * 0.3 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-label={`${n} estrellas`}
                      onClick={() => setValues({ ...values, [f.id]: n })}
                      style={{ fontSize: u * 1.4, lineHeight: 1, color: el.accent, opacity: Number(values[f.id] ?? 0) >= n ? 1 : 0.35, background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
                    >
                      ★
                    </button>
                  ))}
                </span>
              )}
              {f.kind === 'choice' &&
                (f.options ?? []).map((o) => (
                  <span key={o} style={{ display: 'flex', alignItems: 'center', gap: u * 0.4, height: u * 1.7 }}>
                    <input type="radio" name={f.id} required={f.required} checked={values[f.id] === o} onChange={() => setValues({ ...values, [f.id]: o })} style={{ accentColor: el.accent, width: u * 0.9, height: u * 0.9, margin: 0 }} />
                    {o}
                  </span>
                ))}
            </label>
          ))}
          <button type="submit" disabled={state === 'sending'} style={{ width: '100%', justifyContent: 'center', height: u * 2.2, marginTop: u * 0.4, background: el.accent, color: readableOn(el.accent), border: 0, borderRadius: u * 0.4, font: 'inherit', fontWeight: 700, cursor: 'pointer' }}>
            {state === 'sending' ? 'Enviando…' : el.submitLabel}
          </button>
          {state === 'error' && <div style={{ marginTop: u * 0.3, color: '#ff8a8a' }}>{msg}</div>}
        </>
      )}
    </form>
  );
}
