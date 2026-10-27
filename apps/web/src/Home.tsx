import { useEffect, useState } from 'react';
import { KIND_LABEL, KIND_SIZE, createDoc, createImage, type DesignDoc, type DesignSummary } from '@trazo/shared';
import { getBackend, type Backend } from './api/backend';
import { Icon } from './editor/icons';
import { TemplateGallery } from './templates/TemplateGallery';
import { CreateBar, type CreateRequest } from './CreateBar';
import { loadImage } from './canvas/useImage';
import { Logo } from './Logo';

const PRESETS: [string, number, number][] = [
  ['Post cuadrado', 1080, 1080],
  ['Historia', 1080, 1920],
  ['Presentación', 1920, 1080],
  ['Póster A4', 794, 1123],
  ['Banner web', 1500, 500],
  ['Tarjeta', 1050, 600],
];

export function Home({ onOpen }: { onOpen(id: string): void }) {
  const [backend, setBackend] = useState<Backend | null>(null);
  const [designs, setDesigns] = useState<DesignSummary[] | null>(null);
  const [w, setW] = useState(1200);
  const [h, setH] = useState(800);
  const [error, setError] = useState<string | null>(null);

  const refresh = async (b: Backend) => setDesigns(await b.list());

  useEffect(() => {
    getBackend().then((b) => {
      setBackend(b);
      refresh(b).catch((e) => setError((e as Error).message));
    });
  }, []);

  const create = async (width: number, height: number) => {
    if (!backend || width <= 0 || height <= 0) return;
    const d = await backend.create({ width, height });
    onOpen(d.id);
  };

  const createKind = async (r: CreateRequest) => {
    if (!backend) return;
    const size = r.kind === 'design' ? { width: r.width ?? 1080, height: r.height ?? 1080 } : { ...KIND_SIZE[r.kind], ...(r.width ? { width: r.width, height: r.height! } : {}) };
    const d = await backend.create({ ...size, kind: r.kind, title: r.title });
    onOpen(d.id);
  };

  /** "Editar foto": un diseño del tamaño de la imagen con la foto a página completa. */
  const createFromPhoto = async (file: File) => {
    if (!backend) return;
    const url = await backend.upload(file, file.name);
    const img = await loadImage(url);
    const k = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k));
    const h = Math.max(1, Math.round(img.naturalHeight * k));
    const doc = createDoc(w, h, file.name.replace(/\.[^.]+$/, ''));
    doc.pages[0].elements.push(createImage(doc, url, img.naturalWidth, img.naturalHeight, { x: 0, y: 0, width: w, height: h, name: 'Foto' }));
    const d = await backend.create({ width: w, height: h, title: doc.title, doc });
    sessionStorage.setItem('trazo:openPanel', 'photo');
    onOpen(d.id);
  };

  const [uploaded, setUploaded] = useState<number | null>(null);
  const uploadFiles = async (files: File[]) => {
    if (!backend) return;
    for (const f of files) await backend.upload(f, f.name);
    setUploaded(files.length);
  };

  const createFromTemplate = async (doc: DesignDoc) => {
    if (!backend) return;
    const d = await backend.create({ width: doc.width, height: doc.height, title: doc.title, doc });
    onOpen(d.id);
  };

  return (
    <div className="home">
      <header className="home-head">
        <Logo size={36} wordmark />
        <span className={`conn ${backend?.kind ?? 'pending'}`}>{backend ? (backend.kind === 'remote' ? 'Conectado al servidor' : 'Modo local, sin servidor') : 'Conectando…'}</span>
      </header>
      {backend?.kind === 'local' && <div className="banner">No se encontró la API: los diseños se guardan solo en este navegador. Iniciá <code>npm run dev</code> en la raíz para usar el servidor y la colaboración.</div>}
      {error && <div className="banner">{error}</div>}
      <section className="hero">
        <h1>¿Qué vas a diseñar hoy?</h1>
        <CreateBar onCreate={createKind} onPhoto={createFromPhoto} onUpload={uploadFiles} />
        {uploaded !== null && <p className="hero-note">Se subieron {uploaded} archivo(s). Los encontrás en "Subidos" dentro del editor.</p>}
        <div className="presets">
          {PRESETS.map(([label, pw, ph]) => (
            <button key={label} onClick={() => create(pw, ph)} data-testid={`preset-${pw}x${ph}`}>
              <strong>{label}</strong>
              <small>{pw} × {ph} px</small>
            </button>
          ))}
        </div>
        <div className="custom-size">
          <span>Medida propia</span>
          <input type="number" value={w} min={1} max={10000} onChange={(e) => setW(+e.target.value)} aria-label="Ancho" />
          ×
          <input type="number" value={h} min={1} max={10000} onChange={(e) => setH(+e.target.value)} aria-label="Alto" />
          <button className="primary" onClick={() => create(w, h)} data-testid="create-custom">
            Crear diseño
          </button>
        </div>
      </section>
      <section className="home-section">
        <h2>Tus diseños{designs && designs.length > 0 && <small>{designs.length}</small>}</h2>
        {designs && designs.length === 0 && <p className="empty">Todavía no hay diseños. Elegí un formato arriba o partí de una plantilla.</p>}
        <div className="grid" data-testid="designs">
          {designs?.map((d) => {
            const thumb = backend?.thumbnailUrl(d.id, d.updatedAt);
            return (
              <div className="card" key={d.id} onClick={() => onOpen(d.id)} data-testid="design-card">
                <div className="thumb">{thumb ? <img src={thumb} alt="" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} /> : <Icon name="file" size={40} />}</div>
                <div className="meta">
                  <div>
                    <strong>{d.title}</strong>
                    <small>
                      {d.kind && d.kind !== 'design' ? `${KIND_LABEL[d.kind]} · ` : ''}
                      {d.width} × {d.height} · {d.pageCount} pág.
                    </small>
                  </div>
                  <button
                    className="ghost"
                    title="Duplicar"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await backend!.duplicate(d.id);
                      void refresh(backend!);
                    }}
                  >
                    <Icon name="copy" />
                  </button>
                  <button
                    className="ghost danger"
                    title="Eliminar"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm(`¿Eliminar "${d.title}"?`)) return;
                      await backend!.remove(d.id);
                      void refresh(backend!);
                    }}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="home-section">
        <h2>Plantillas</h2>
        <TemplateGallery onPick={(t) => createFromTemplate(t.build())} />
      </section>
    </div>
  );
}
