import { useEffect, useMemo, useRef, useState } from 'react';
import { createText, type DesignElement, type TextPreset } from '@trazo/shared';
import { useEditor } from '../store/editorStore';
import { shapeDef } from '../elements/shapeLibrary';
import { graphicDataUrl } from '../elements/graphicsLibrary';
import { SOLID_LABELS } from '../elements/solids';
import { DECORATIONS } from '../elements/mockups';
import { ElementsPanel } from './ElementsPanel';
import { TemplateGallery } from '../templates/TemplateGallery';
import { PhotoPanel } from './PhotoPanel';
import { ChartPanel, FormPanel } from './DataPanels';
import { insertImage, insertVideo } from './insert';
import { mediaKind, useUploads } from './uploads';
import { addAudioTrack } from './MediaPanels';
import { Icon } from './icons';

export type PanelKey = 'photo' | 'templates' | 'elements' | 'text' | 'uploads' | 'background' | 'position' | 'chart' | 'form';

export const PALETTE = ['#1f2430', '#ffffff', '#ff6b4a', '#2bb3a3', '#ffc145', '#5b6cff', '#e84a8a', '#8a93a6', '#2e7d32', '#f4e9d8', '#0b3d91', '#c2185b'];

export function SidePanel({ panel, openPanel }: { panel: PanelKey; openPanel(p: PanelKey): void }) {
  return (
    <aside className="panel" data-testid={`panel-${panel}`}>
      {panel === 'templates' && <TemplatesPanel />}
      {panel === 'photo' && <PhotoPanel />}
      {panel === 'text' && <TextPanel />}
      {panel === 'elements' && <ElementsPanel openPanel={openPanel} />}
      {panel === 'chart' && <ChartPanel />}
      {panel === 'form' && <FormPanel />}
      {panel === 'uploads' && <UploadsPanel />}
      {panel === 'background' && <BackgroundPanel />}
      {panel === 'position' && <PositionPanel />}
    </aside>
  );
}

function TemplatesPanel() {
  const width = useEditor((s) => s.doc.width);
  const height = useEditor((s) => s.doc.height);
  const current = useMemo(() => ({ width, height }), [width, height]);
  return (
    <>
      <TemplateGallery compact current={current} onPick={(t) => useEditor.getState().applyTemplate(t.build())} />
      <p className="kbd">Si la página está vacía se reemplaza; si no, la plantilla se agrega a continuación. Las de otro tamaño se ajustan al formato del diseño.</p>
    </>
  );
}

function TextPanel() {
  const add = (preset: TextPreset) => {
    const st = useEditor.getState();
    const el = createText(st.doc, preset);
    st.addElement(el);
    st.setEditingText(el.id);
  };
  return (
    <>
      <button className="primary" onClick={() => add('body')} data-testid="add-textbox">
        <Icon name="text" /> Agregar cuadro de texto
      </button>
      <h3>Estilos predeterminados</h3>
      <div className="stack">
        <button className="text-preset" onClick={() => add('heading')} style={{ fontSize: 24, fontWeight: 700 }}>
          Agregar un título
        </button>
        <button className="text-preset" onClick={() => add('subheading')} style={{ fontSize: 17, fontWeight: 600 }}>
          Agregar un subtítulo
        </button>
        <button className="text-preset" onClick={() => add('body')} style={{ fontSize: 13 }}>
          Agregar texto de cuerpo
        </button>
      </div>
      <h3>Combinaciones</h3>
      <div className="stack">
        {COMBOS.map((c) => (
          <button key={c.label} className="text-preset" style={{ fontFamily: c.title, flexDirection: 'column', alignItems: 'flex-start' }} onClick={() => addCombo(c)}>
            <span style={{ fontSize: 20, fontWeight: 700 }}>{c.label}</span>
            <span style={{ fontFamily: c.body, fontSize: 12, color: 'var(--ink-2)' }}>con texto de apoyo</span>
          </button>
        ))}
      </div>
      <p className="kbd">Atajo: T inserta un cuadro de texto · doble clic para editar</p>
    </>
  );
}

const COMBOS = [
  { label: 'Elegante', title: 'Playfair Display', body: 'Inter', color: '#1f2430' },
  { label: 'Moderno', title: 'Space Grotesk', body: 'Inter', color: '#5b6cff' },
  { label: 'A mano', title: 'Caveat', body: 'Inter', color: '#e84a8a' },
  { label: 'Retro', title: 'Lobster', body: 'Roboto Mono', color: '#ff6b4a' },
];

function addCombo(c: (typeof COMBOS)[number]) {
  const st = useEditor.getState();
  const title = createText(st.doc, 'heading', { text: c.label, fontFamily: c.title, fill: c.color });
  const body = createText(st.doc, 'body', { text: 'con texto de apoyo', fontFamily: c.body, fill: '#4a5263' });
  body.y = title.y + title.height + st.doc.height * 0.01;
  st.addElement(title);
  st.addElement(body);
  st.select([title.id, body.id]);
}

function UploadsPanel() {
  const { items, busy, refresh, upload } = useUploads();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const insert = async (url: string) => {
    const kind = mediaKind(url);
    if (kind === 'video') return insertVideo(url);
    if (kind === 'audio') return addAudioTrack({ src: url, title: decodeURIComponent(url.split('/').pop() ?? 'Audio') });
    return insertImage(url);
  };
  const handleFiles = async (files: FileList | File[]) => {
    for (const f of [...files].filter((x) => /^(image|video|audio)\//.test(x.type))) await insert(await upload(f));
  };

  return (
    <>
      <button className="primary" onClick={() => input.current?.click()} disabled={busy}>
        <Icon name="upload" /> {busy ? 'Subiendo…' : 'Subir archivos'}
      </button>
      <input ref={input} type="file" accept="image/*,video/*,audio/*" multiple hidden data-testid="upload-input" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
      <div
        className={`dropzone${over ? ' over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
      >
        Soltá imágenes, videos o audio acá, o directamente sobre una página o un marco. También podés pegar imágenes con Ctrl+V.
      </div>
      <div className="uploads-grid">
        {items.map((url) => {
          const kind = mediaKind(url);
          return (
            <button key={url} onClick={() => insert(url)} draggable={kind !== 'audio'} onDragStart={(e) => e.dataTransfer.setData('text/x-trazo-image', url)} title="Insertar" className={kind !== 'image' ? 'video-thumb' : undefined}>
              {kind === 'image' && <img src={url} alt="" />}
              {kind === 'video' && <video src={url} muted preload="metadata" />}
              {kind === 'audio' && <span className="audio-file">♪ {decodeURIComponent(url.split('/').pop() ?? '')}</span>}
              {kind === 'video' && <span className="badge">▶</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}

function BackgroundPanel() {
  const pageId = useEditor((s) => s.activePageId);
  const bg = useEditor((s) => s.doc.pages.find((p) => p.id === s.activePageId)?.background ?? '#ffffff');
  const set = (c: string) => useEditor.getState().setPageBackground(pageId, c);
  return (
    <>
      <h3>Color de fondo de la página</h3>
      <div className="swatches">
        {PALETTE.map((c) => (
          <button key={c} style={{ background: c }} title={c} aria-label={`Fondo ${c}`} onClick={() => set(c)} className={bg === c ? 'active' : ''} />
        ))}
      </div>
      <label className="field">
        Personalizado
        <input type="color" value={bg.startsWith('#') && bg.length === 7 ? bg : '#ffffff'} onChange={(e) => set(e.target.value)} />
      </label>
    </>
  );
}

function PositionPanel() {
  const [tab, setTab] = useState<'arrange' | 'layers'>('arrange');
  return (
    <>
      <div className="tabs">
        <button className={tab === 'arrange' ? 'active' : ''} onClick={() => setTab('arrange')}>
          Organizar
        </button>
        <button className={tab === 'layers' ? 'active' : ''} onClick={() => setTab('layers')} data-testid="tab-layers">
          Capas
        </button>
      </div>
      {tab === 'arrange' ? <ArrangeTab /> : <LayersTab />}
    </>
  );
}

function ArrangeTab() {
  const selectedIds = useEditor((s) => s.selectedIds);
  const page = useEditor((s) => s.doc.pages.find((p) => p.id === s.activePageId)!);
  const st = useEditor.getState;
  const sel = page.elements.filter((e) => selectedIds.includes(e.id));
  const idx = sel.map((e) => page.elements.indexOf(e));
  const atFront = idx.length > 0 && Math.min(...idx) >= page.elements.length - sel.length;
  const atBack = idx.length > 0 && Math.max(...idx) < sel.length;
  const none = sel.length === 0;
  const single = sel.length === 1 ? sel[0] : null;

  return (
    <>
      <div className="tile-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <button disabled={none || atFront} onClick={() => st().arrange('forward')}>Adelante</button>
        <button disabled={none || atBack} onClick={() => st().arrange('backward')}>Atrás</button>
        <button disabled={none || atFront} onClick={() => st().arrange('front')}>Al frente</button>
        <button disabled={none || atBack} onClick={() => st().arrange('back')}>Al fondo</button>
      </div>
      <h3>{sel.length > 1 ? 'Alinear elementos' : 'Alinear a la página'}</h3>
      <div className="tile-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {(
          [
            ['top', 'Arriba'],
            ['left', 'Izquierda'],
            ['middle', 'En el medio'],
            ['center', 'Centro'],
            ['bottom', 'Abajo'],
            ['right', 'Derecha'],
          ] as const
        ).map(([edge, label]) => (
          <button key={edge} disabled={none} onClick={() => st().align(edge)} data-testid={`align-${edge}`}>
            {label}
          </button>
        ))}
      </div>
      {single && <NumericFields el={single} />}
      {none && <p className="kbd">Seleccioná un elemento para organizarlo.</p>}
    </>
  );
}

function NumericFields({ el }: { el: DesignElement }) {
  const upd = (patch: Partial<DesignElement>) => useEditor.getState().updateElements([el.id], patch, { label: 'Editar medidas', mergeKey: `num:${el.id}` });
  const ratio = el.width / el.height;
  const [lockRatio, setLockRatio] = useState(true);
  const num = (label: string, value: number, onChange: (v: number) => void, testId?: string) => (
    <label className="field">
      {label}
      <input
        type="number"
        value={Math.round(value * 10) / 10}
        data-testid={testId}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
      />
    </label>
  );
  return (
    <>
      <h3>Avanzado</h3>
      <div className="row">
        {num('Ancho', el.width, (v) => v > 0 && upd(lockRatio && el.type !== 'text' ? { width: v, height: v / ratio } : { width: v }), 'num-width')}
        {num('Alto', el.height, (v) => v > 0 && el.type !== 'text' && upd(lockRatio ? { height: v, width: v * ratio } : { height: v }))}
        <button className={lockRatio ? 'active' : ''} title="Mantener proporción" onClick={() => setLockRatio(!lockRatio)} style={{ alignSelf: 'flex-end', flex: 'none' }}>
          <Icon name={lockRatio ? 'lock' : 'unlock'} />
        </button>
      </div>
      <div className="row">
        {num('X', el.x, (v) => upd({ x: v }), 'num-x')}
        {num('Y', el.y, (v) => upd({ y: v }), 'num-y')}
        {num('Girar', el.rotation, (v) => upd({ rotation: v }), 'num-rotation')}
      </div>
    </>
  );
}

export function layerLabel(el: DesignElement): string {
  if (el.name) return el.name;
  if (el.type === 'text') return el.text.split('\n')[0] || 'Texto';
  switch (el.type) {
    case 'image':
      return 'Imagen';
    case 'shape':
      return shapeDef(el.shape).label;
    case 'graphic':
      return 'Ilustración';
    case 'chart':
      return el.title || 'Gráfico';
    case 'table':
      return 'Tabla';
    case 'frame':
      return el.decoration === 'none' ? 'Marco' : DECORATIONS[el.decoration].label;
    case 'grid':
      return `Cuadrícula de ${el.cells.length}`;
    case 'solid':
      return `3D: ${SOLID_LABELS[el.solid]}`;
    case 'video':
      return 'Video';
    case 'form':
      return el.title || 'Formulario';
    case 'sticky':
      return el.text.split('\n')[0] || 'Nota adhesiva';
    case 'draw':
      return 'Dibujo';
  }
}

function LayersTab() {
  const page = useEditor((s) => s.doc.pages.find((p) => p.id === s.activePageId)!);
  const selectedIds = useEditor((s) => s.selectedIds);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const st = useEditor.getState;
  // La lista muestra del frente (arriba) al fondo; el modelo guarda de fondo a frente.
  const rows = [...page.elements].map((el, i) => ({ el, i })).reverse();

  return (
    <div className="layers" data-testid="layers">
      {rows.map(({ el, i }) => (
        <div
          key={el.id}
          className={`layer${selectedIds.includes(el.id) ? ' selected' : ''}${dropIndex === i && dragIndex !== null ? ' drop-before' : ''}${el.visible ? '' : ' dim'}`}
          draggable
          onDragStart={(e) => {
            setDragIndex(i);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDropIndex(i);
          }}
          onDragEnd={() => {
            setDragIndex(null);
            setDropIndex(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragIndex !== null) st().moveLayer(page.id, dragIndex, i);
            setDragIndex(null);
            setDropIndex(null);
          }}
          onClick={(e) => st().select([el.id], e.shiftKey || e.ctrlKey || e.metaKey)}
          data-testid="layer-row"
        >
          <span className="grip">
            <Icon name="grip" size={14} />
          </span>
          <LayerPreview el={el} />
          <span className="name">{layerLabel(el)}</span>
          <button title={el.visible ? 'Ocultar' : 'Mostrar'} onClick={(e) => (e.stopPropagation(), st().toggleVisibility(el.id))}>
            <Icon name={el.visible ? 'eye' : 'eyeOff'} size={15} />
          </button>
          <button title={el.locked ? 'Desbloquear' : 'Bloquear'} onClick={(e) => (e.stopPropagation(), st().toggleLock([el.id]))}>
            <Icon name={el.locked ? 'lock' : 'unlock'} size={15} />
          </button>
        </div>
      ))}
      <div className="layer" style={{ cursor: 'default', opacity: 0.7 }}>
        <span className="grip" />
        <span className="preview" style={{ background: page.background }} />
        <span className="name">Fondo</span>
        <Icon name="lock" size={15} />
      </div>
    </div>
  );
}

function LayerPreview({ el }: { el: DesignElement }) {
  switch (el.type) {
    case 'image':
      return <span className="preview"><img src={el.src} alt="" /></span>;
    case 'text':
      return <span className="preview" style={{ color: el.fill, fontFamily: el.fontFamily }}>Aa</span>;
    case 'shape':
      return <span className="preview" style={{ background: el.fill === 'transparent' ? 'none' : el.fill, borderRadius: el.shape === 'ellipse' ? '50%' : 4 }} />;
    case 'graphic':
      return <span className="preview"><img src={graphicDataUrl(el.svg, el.colors)} alt="" /></span>;
    case 'frame':
      return <span className="preview">{el.src ? <img src={el.src} alt="" /> : '▢'}</span>;
    case 'grid':
      return <span className="preview">▦</span>;
    case 'solid':
      return <span className="preview" style={{ background: el.color, borderRadius: 4 }} />;
    case 'chart':
      return <span className="preview">📊</span>;
    case 'table':
      return <span className="preview">▤</span>;
    case 'video':
      return <span className="preview">▶</span>;
    case 'form':
      return <span className="preview" style={{ background: el.background }} />;
    case 'sticky':
      return <span className="preview" style={{ background: el.color }} />;
    case 'draw':
      return <span className="preview" style={{ color: el.stroke }}>✎</span>;
  }
}
