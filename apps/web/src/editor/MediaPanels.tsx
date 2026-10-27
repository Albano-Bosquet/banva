import { useEffect, useRef, useState } from 'react';
import { newId, type AudioTrack, type MediaResult } from '@trazo/shared';
import { getBackend } from '../api/backend';
import { useEditor } from '../store/editorStore';
import { insertImage, insertVideo } from './insert';
import { mediaKind, useUploads } from './uploads';
import { Icon } from './icons';

const PHOTO_TOPICS = ['Naturaleza', 'Ciudad', 'Comida', 'Montañas', 'Flores', 'Texturas', 'Animales', 'Mar'];
const AUDIO_TOPICS = ['Piano', 'Ambiente', 'Guitarra', 'Lluvia', 'Electrónica', 'Pájaros'];

function useMediaSearch(type: 'image' | 'audio', initial: string) {
  const [q, setQ] = useState(initial);
  const [results, setResults] = useState<MediaResult[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');
  const run = async (query: string) => {
    setQ(query);
    setState('loading');
    try {
      const b = await getBackend();
      setResults(await b.searchMedia(type, query));
      setState('idle');
    } catch (e) {
      setError((e as Error).message);
      setResults([]);
      setState('error');
    }
  };
  useEffect(() => {
    void run(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { q, setQ, results, state, error, run };
}

function SearchBox({ q, setQ, run, placeholder, topics }: { q: string; setQ(v: string): void; run(q: string): void; placeholder: string; topics: string[] }) {
  return (
    <>
      <form
        className="search-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) run(q.trim());
        }}
      >
        <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} data-testid="media-search" />
      </form>
      <div className="chips">
        {topics.map((t) => (
          <button key={t} className="chip" onClick={() => run(t)}>
            {t}
          </button>
        ))}
      </div>
    </>
  );
}

// --------------------------------------------------------------------------- fotos

export function PhotosPanel() {
  const s = useMediaSearch('image', 'naturaleza');
  const [busy, setBusy] = useState<string | null>(null);
  const [addError, setAddError] = useState('');
  const add = async (r: MediaResult) => {
    setBusy(r.id);
    setAddError('');
    try {
      const b = await getBackend();
      const { url, credit } = await b.importMedia('image', r.id);
      await insertImage(url, { credit });
    } catch (e) {
      setAddError(`No se pudo agregar la foto: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      <SearchBox {...s} placeholder="Buscar fotos" topics={PHOTO_TOPICS} />
      <p className="kbd">Fotos con licencia libre de Openverse o Wikimedia Commons. Se guarda la atribución en cada imagen.</p>
      {s.state === 'loading' && <p className="kbd">Buscando…</p>}
      {s.state === 'error' && <p className="banner">{s.error}</p>}
      {addError && <p className="banner">{addError}</p>}
      {busy && <p className="kbd">Agregando la foto…</p>}
      <div className="masonry" data-testid="photo-results">
        {s.results.map((r) => (
          <button key={r.id} onClick={() => add(r)} disabled={busy !== null} title={`${r.title} — ${r.creator} (${r.license})`} className={busy === r.id ? 'loading' : ''}>
            <img src={r.thumbnail} alt={r.title} loading="lazy" referrerPolicy="no-referrer" />
          </button>
        ))}
      </div>
      {s.state === 'idle' && !s.results.length && <p className="kbd">Sin resultados.</p>}
    </>
  );
}

// --------------------------------------------------------------------------- videos

export function VideosPanel() {
  const { items, busy, refresh, upload } = useUploads();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const videos = items.filter((u) => mediaKind(u) === 'video');
  return (
    <>
      <button className="primary" onClick={() => input.current?.click()} disabled={busy}>
        <Icon name="upload" /> {busy ? 'Subiendo…' : 'Subir video'}
      </button>
      <input
        ref={input}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        hidden
        data-testid="video-input"
        onChange={async (e) => {
          for (const f of [...(e.target.files ?? [])]) await insertVideo(await upload(f));
          e.target.value = '';
        }}
      />
      <p className="kbd">MP4 o WebM, hasta 100 MB. Los videos se reproducen en el lienzo y en la presentación; al exportar a imagen se usa el cuadro actual.</p>
      <div className="uploads-grid">
        {videos.map((url) => (
          <button key={url} onClick={() => insertVideo(url)} title="Insertar video" className="video-thumb">
            <video src={url} muted preload="metadata" />
            <span className="badge">▶</span>
          </button>
        ))}
      </div>
      {!videos.length && <p className="kbd">Todavía no subiste videos.</p>}
    </>
  );
}

// --------------------------------------------------------------------------- audio

const fmtDuration = (ms?: number) => {
  if (!ms) return '';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Reproductor único para escuchar pistas antes de agregarlas. */
function usePreview() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => () => audio.current?.pause(), []);
  const toggle = (key: string, src: string) => {
    if (playing === key) {
      audio.current?.pause();
      setPlaying(null);
      return;
    }
    audio.current?.pause();
    audio.current = new Audio(src);
    audio.current.onended = () => setPlaying(null);
    void audio.current.play().catch(() => setPlaying(null));
    setPlaying(key);
  };
  return { playing, toggle };
}

export function addAudioTrack(track: Omit<AudioTrack, 'id' | 'volume'>) {
  useEditor.getState().commit('Agregar audio', (d) => {
    d.audio = [...(d.audio ?? []), { id: newId('a'), volume: 0.8, ...track }];
  });
}

/** Constante: un [] nuevo en cada lectura haría que el selector nunca se estabilice. */
const NO_TRACKS: AudioTrack[] = [];

export function AudioPanel() {
  const s = useMediaSearch('audio', 'piano');
  const tracks = useEditor((st) => st.doc.audio ?? NO_TRACKS);
  const preview = usePreview();
  const { items, upload, busy, refresh } = useUploads();
  const input = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [addError, setAddError] = useState('');
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addResult = async (r: MediaResult) => {
    setAdding(r.id);
    setAddError('');
    try {
      const b = await getBackend();
      const { url, title, credit } = await b.importMedia('audio', r.id);
      addAudioTrack({ src: url, title, credit });
    } catch (e) {
      setAddError(`No se pudo agregar el audio: ${(e as Error).message}`);
    } finally {
      setAdding(null);
    }
  };
  const st = useEditor.getState;

  return (
    <>
      <h3>Audio del diseño</h3>
      {tracks.length === 0 && <p className="kbd">Sin pistas. El audio suena en la presentación.</p>}
      <div className="track-list" data-testid="design-tracks">
        {tracks.map((t) => (
          <div key={t.id} className="track">
            <button className="ghost" onClick={() => preview.toggle(t.id, t.src)} title="Escuchar">
              <Icon name={preview.playing === t.id ? 'pause' : 'play'} />
            </button>
            <span className="name" title={t.credit ?? t.title}>
              {t.title}
              {t.credit && <small>{t.credit}</small>}
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(t.volume * 100)}
              title="Volumen"
              onChange={(e) =>
                st().commit('Volumen', (d) => {
                  const tr = d.audio?.find((x) => x.id === t.id);
                  if (tr) tr.volume = +e.target.value / 100;
                }, { mergeKey: `vol:${t.id}` })
              }
            />
            <button className="ghost danger" title="Quitar" onClick={() => st().commit('Quitar audio', (d) => void (d.audio = (d.audio ?? []).filter((x) => x.id !== t.id)))}>
              <Icon name="trash" />
            </button>
          </div>
        ))}
      </div>
      <button className="secondary" onClick={() => input.current?.click()} disabled={busy}>
        <Icon name="upload" /> Subir audio
      </button>
      <input
        ref={input}
        type="file"
        accept="audio/*"
        hidden
        onChange={async (e) => {
          for (const f of [...(e.target.files ?? [])]) addAudioTrack({ src: await upload(f), title: f.name.replace(/\.[^.]+$/, '') });
          e.target.value = '';
        }}
      />
      {items.filter((u) => mediaKind(u) === 'audio').map((u) => (
        <button key={u} className="chip wide" onClick={() => addAudioTrack({ src: u, title: decodeURIComponent(u.split('/').pop() ?? 'Audio') })}>
          + {u.split('/').pop()}
        </button>
      ))}
      <h3>Banco de audio abierto</h3>
      <SearchBox {...s} placeholder="Buscar música y sonidos" topics={AUDIO_TOPICS} />
      {s.state === 'loading' && <p className="kbd">Buscando…</p>}
      {s.state === 'error' && <p className="banner">{s.error}</p>}
      {addError && <p className="banner">{addError}</p>}
      {adding && <p className="kbd">Agregando la pista…</p>}
      <div className="track-list" data-testid="audio-results">
        {s.results.map((r) => (
          <div key={r.id} className="track">
            <button className="ghost" disabled={!r.preview} onClick={() => r.preview && preview.toggle(r.id, r.preview)} title="Escuchar">
              <Icon name={preview.playing === r.id ? 'pause' : 'play'} />
            </button>
            <span className="name" title={`${r.title} — ${r.creator} (${r.license})`}>
              {r.title}
              <small>
                {r.creator} · {fmtDuration(r.duration)} · {r.license}
              </small>
            </span>
            <button className="ghost" disabled={adding !== null} onClick={() => addResult(r)} title="Agregar al diseño">
              <Icon name={adding === r.id ? 'clock' : 'plus'} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
