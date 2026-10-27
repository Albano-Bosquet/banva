import { useState } from 'react';
import { useEditor } from '../store/editorStore';
import { DocPreview } from '../canvas/DocPreview';
import { AudioPanel } from '../editor/MediaPanels';
import { Icon } from '../editor/icons';

const PX_PER_SECOND = 28;

/**
 * Línea de tiempo del video: escenas con su duración (arrastrable desde el borde
 * derecho o editable), "Agregar una escena" y pistas de audio debajo.
 */
export function Timeline() {
  const doc = useEditor((s) => s.doc);
  const activePageId = useEditor((s) => s.activePageId);
  const [audioOpen, setAudioOpen] = useState(false);
  const st = useEditor.getState;
  const total = doc.pages.reduce((s, p) => s + (p.duration ?? 5), 0);
  const setDuration = (id: string, v: number, mergeKey?: string) =>
    st().commit('Duración de la escena', (d) => {
      const p = d.pages.find((x) => x.id === id);
      if (p) p.duration = Math.max(0.5, Math.min(120, Math.round(v * 10) / 10));
    }, { mergeKey });

  const dragEdge = (id: string, start: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const x0 = e.clientX;
    const onMove = (ev: MouseEvent) => setDuration(id, start + (ev.clientX - x0) / PX_PER_SECOND, `dur:${id}`);
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="timeline" data-testid="timeline">
      <div className="timeline-head">
        <button
          className="primary small"
          onClick={() => {
            const id = useEditor.getState().designId;
            if (id) location.hash = `#/v/${id}`;
          }}
          title="Reproducir el video"
          data-testid="video-play-all"
        >
          <Icon name="play" /> Reproducir
        </button>
        <span className="kbd">Duración total: {formatTime(total)}</span>
        <span className="spacer" />
        <button className="ghost small" onClick={() => setAudioOpen(!audioOpen)} data-testid="timeline-audio">
          <Icon name="music" /> {audioOpen ? 'Cerrar audio' : 'Agregar un audio'}
        </button>
      </div>
      <div className="timeline-track">
        {doc.pages.map((p, i) => {
          const dur = p.duration ?? 5;
          return (
            <div
              key={p.id}
              className={`scene${p.id === activePageId ? ' active' : ''}`}
              style={{ width: Math.max(140, dur * PX_PER_SECOND) }}
              onClick={() => st().setActivePage(p.id)}
              data-testid="scene"
            >
              <div className="scene-thumb">
                <DocPreview page={p} width={doc.width} height={doc.height} size={54} />
              </div>
              <label className="scene-dur" onClick={(e) => e.stopPropagation()}>
                <input type="number" min={0.5} max={120} step={0.5} value={dur} onChange={(e) => +e.target.value > 0 && setDuration(p.id, +e.target.value, `dur:${p.id}`)} aria-label={`Duración de la escena ${i + 1}`} />s
              </label>
              <span className="scene-edge" onMouseDown={(e) => dragEdge(p.id, dur, e)} title="Arrastrá para cambiar la duración" />
            </div>
          );
        })}
        <button className="scene-add" onClick={() => st().addPage(doc.pages[doc.pages.length - 1].id)} title="Agregar una escena en blanco" data-testid="scene-add">
          <Icon name="plus" />
        </button>
      </div>
      {(doc.audio?.length ?? 0) > 0 && (
        <div className="timeline-audio" style={{ width: Math.max(200, total * PX_PER_SECOND) }}>
          {doc.audio!.map((a) => (
            <span key={a.id} className="audio-bar" title={a.credit ?? a.title}>
              ♪ {a.title}
            </span>
          ))}
        </div>
      )}
      {audioOpen && (
        <div className="timeline-audio-panel">
          <AudioPanel />
        </div>
      )}
    </div>
  );
}

export function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.round(s % 60)).padStart(2, '0')}`;
}
