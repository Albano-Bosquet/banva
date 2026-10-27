import { useRef, useState } from 'react';
import type { DesignKind } from '@trazo/shared';
import { Icon } from './editor/icons';

export interface CreateRequest {
  kind: DesignKind;
  width?: number;
  height?: number;
  title?: string;
}

type Format = [label: string, width: number, height: number];

/** Formatos de Banva para cada grupo del diálogo "Crear un diseño". */
const GROUPS: Record<'redes' | 'video' | 'imprimir', { label: string; kind: DesignKind; formats: Format[] }> = {
  redes: {
    label: 'Redes sociales',
    kind: 'design',
    formats: [
      ['Post de Instagram (4:5)', 1080, 1350],
      ['Post cuadrado', 1080, 1080],
      ['Historia', 1080, 1920],
      ['Post de Facebook', 940, 788],
      ['Portada de Facebook', 820, 312],
      ['Enlace en la biografía', 1080, 1920],
      ['Post de LinkedIn', 1200, 1200],
      ['Post de X', 1600, 900],
      ['Pin de Pinterest', 1000, 1500],
      ['Miniatura de YouTube', 1280, 720],
      ['Banner', 1500, 500],
    ],
  },
  video: {
    label: 'Videos',
    kind: 'video',
    formats: [
      ['Video horizontal', 1920, 1080],
      ['Video para dispositivos móviles', 1080, 1920],
      ['Video de TikTok', 1080, 1920],
      ['Video de YouTube', 1920, 1080],
      ['YouTube Shorts', 1080, 1920],
      ['Reel de Instagram', 1080, 1920],
      ['Video cuadrado', 1080, 1080],
    ],
  },
  imprimir: {
    label: 'Imprimir',
    kind: 'design',
    formats: [
      ['Documento A4 vertical', 794, 1123],
      ['Documento A4 horizontal', 1123, 794],
      ['Documento A3 vertical', 1123, 1587],
      ['Carta (US Letter)', 816, 1056],
      ['Flyer A5', 559, 794],
      ['Cartel A2', 1587, 2245],
      ['Tarjeta de presentación', 336, 192],
      ['Invitación A6', 397, 559],
    ],
  },
};

const UNITS = { px: 1, mm: 96 / 25.4, cm: 96 / 2.54, in: 96 } as const;
type Unit = keyof typeof UNITS;

const TILES: { id: string; label: string; color: string; icon: string; kind?: DesignKind; size?: [number, number]; dialog?: keyof typeof GROUPS | 'custom'; action?: 'photo' | 'upload' }[] = [
  { id: 'presentation', label: 'Presentación', color: '#0b9447', icon: 'present', kind: 'design', size: [1920, 1080] },
  { id: 'redes', label: 'Redes', color: '#d94a74', icon: 'heart', dialog: 'redes' },
  { id: 'video', label: 'Video', color: '#6c47c9', icon: 'play', dialog: 'video' },
  { id: 'imprimir', label: 'Imprimir', color: '#2b63c6', icon: 'printer', dialog: 'imprimir' },
  { id: 'doc', label: 'Doc', color: '#0f8577', icon: 'file', kind: 'doc' },
  { id: 'whiteboard', label: 'Pizarra', color: '#b98a0c', icon: 'sticky', kind: 'whiteboard' },
  { id: 'sheet', label: 'Hoja de cálculo', color: '#1e6e37', icon: 'table', kind: 'sheet' },
  { id: 'website', label: 'Sitio web', color: '#2f7fa8', icon: 'globe', kind: 'website' },
  { id: 'email', label: 'Correo', color: '#9a3f8f', icon: 'mail', kind: 'email' },
  { id: 'photo', label: 'Editar foto', color: '#d9711c', icon: 'image', action: 'photo' },
  { id: 'sizes', label: 'Personalizar', color: '#3b5a49', icon: 'resize', dialog: 'custom' },
  { id: 'upload', label: 'Subir', color: '#3b5a49', icon: 'upload', action: 'upload' },
];

/** Barra "¿Qué vamos a diseñar hoy?": tipos de diseño y diálogo de formatos. */
export function CreateBar({ onCreate, onPhoto, onUpload }: { onCreate(r: CreateRequest): void; onPhoto(file: File): void; onUpload(files: File[]): void }) {
  const [dialog, setDialog] = useState<keyof typeof GROUPS | 'custom' | null>(null);
  const photo = useRef<HTMLInputElement>(null);
  const upload = useRef<HTMLInputElement>(null);

  return (
    <>
      <div className="create-bar" data-testid="create-bar">
        {TILES.map((t) => (
          <button
            key={t.id}
            className="create-tile"
            data-testid={`create-${t.id}`}
            onClick={() => {
              if (t.dialog) return setDialog(t.dialog);
              if (t.action === 'photo') return photo.current?.click();
              if (t.action === 'upload') return upload.current?.click();
              onCreate({ kind: t.kind!, width: t.size?.[0], height: t.size?.[1] });
            }}
          >
            <span className="create-icon" style={{ background: t.color }}>
              <Icon name={t.icon} size={22} />
            </span>
            {t.label}
          </button>
        ))}
      </div>
      <input ref={photo} type="file" accept="image/*" hidden data-testid="photo-input" onChange={(e) => e.target.files?.[0] && onPhoto(e.target.files[0])} />
      <input ref={upload} type="file" accept="image/*,video/*,audio/*" multiple hidden data-testid="upload-files" onChange={(e) => e.target.files && onUpload([...e.target.files])} />
      {dialog && <CreateDialog initial={dialog} onClose={() => setDialog(null)} onCreate={onCreate} />}
    </>
  );
}

function CreateDialog({ initial, onClose, onCreate }: { initial: keyof typeof GROUPS | 'custom'; onClose(): void; onCreate(r: CreateRequest): void }) {
  const [tab, setTab] = useState(initial);
  const [w, setW] = useState(1200);
  const [h, setH] = useState(800);
  const [unit, setUnit] = useState<Unit>('px');
  const toPx = (v: number) => Math.round(v * UNITS[unit]);
  const valid = toPx(w) > 0 && toPx(h) > 0 && toPx(w) <= 10000 && toPx(h) <= 10000;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal create-dialog" role="dialog" aria-label="Crear un diseño" data-testid="create-dialog">
        <nav>
          <h3>Crear un diseño</h3>
          {(Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((k) => (
            <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
              {GROUPS[k].label}
            </button>
          ))}
          <button className={tab === 'custom' ? 'active' : ''} onClick={() => setTab('custom')}>
            Elegir el tamaño
          </button>
        </nav>
        <section>
          <button className="ghost close" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" />
          </button>
          {tab === 'custom' ? (
            <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h3>Elegir el tamaño</h3>
              <div className="row" style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <label className="field">
                  Ancho
                  <input type="number" min={1} step="any" value={w} onChange={(e) => setW(+e.target.value)} data-testid="custom-w" />
                </label>
                <label className="field">
                  Alto
                  <input type="number" min={1} step="any" value={h} onChange={(e) => setH(+e.target.value)} data-testid="custom-h" />
                </label>
                <label className="field">
                  Unidades
                  <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)} data-testid="custom-unit">
                    {Object.keys(UNITS).map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </label>
              </div>
              {unit !== 'px' && <small className="kbd">= {toPx(w)} × {toPx(h)} px (96 ppp)</small>}
              <button className="primary" disabled={!valid} onClick={() => onCreate({ kind: 'design', width: toPx(w), height: toPx(h) })} data-testid="custom-create">
                Crear un diseño
              </button>
              <h3>Layouts populares</h3>
              <div className="format-list">
                {GROUPS.imprimir.formats.slice(0, 4).map(([label, fw, fh]) => (
                  <button key={label} onClick={() => onCreate({ kind: 'design', width: fw, height: fh, title: label })}>
                    <strong>{label}</strong>
                    <small>
                      {fw} × {fh} px
                    </small>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <h3>{GROUPS[tab].label}</h3>
              <div className="format-list">
                {GROUPS[tab].formats.map(([label, fw, fh]) => (
                  <button key={label} onClick={() => onCreate({ kind: GROUPS[tab].kind, width: fw, height: fh })} data-testid={`format-${fw}x${fh}`}>
                    <FormatShape w={fw} h={fh} />
                    <strong>{label}</strong>
                    <small>
                      {fw} × {fh} px
                    </small>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/** Rectángulo proporcional al formato, como icono. */
function FormatShape({ w, h }: { w: number; h: number }) {
  const k = 28 / Math.max(w, h);
  return <span className="format-shape" style={{ width: w * k, height: h * k }} />;
}
