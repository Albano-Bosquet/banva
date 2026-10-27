import { useEffect } from 'react';
import type { ImageElement, ImageFilters } from '@trazo/shared';
import { useEditor } from '../store/editorStore';

/** Filtros predefinidos (combinaciones propias de ajustes). */
const PRESETS: { id: string; label: string; f: ImageFilters }[] = [
  { id: 'original', label: 'Original', f: {} },
  { id: 'calido', label: 'Cálido', f: { brightness: 0.05, saturation: 0.6, contrast: 8 } },
  { id: 'frio', label: 'Frío', f: { saturation: -0.4, contrast: 12, brightness: 0.03 } },
  { id: 'bn', label: 'Blanco y negro', f: { grayscale: true, contrast: 18 } },
  { id: 'vintage', label: 'Vintage', f: { sepia: true, contrast: -10, brightness: 0.06 } },
  { id: 'drama', label: 'Drama', f: { contrast: 45, saturation: -0.3, brightness: -0.06 } },
  { id: 'vivido', label: 'Vívido', f: { saturation: 1.4, contrast: 15 } },
  { id: 'suave', label: 'Suave', f: { blur: 2, brightness: 0.08, contrast: -12 } },
];

const SLIDERS: { key: 'brightness' | 'contrast' | 'saturation' | 'blur'; label: string; min: number; max: number; step: number }[] = [
  { key: 'brightness', label: 'Brillo', min: -0.5, max: 0.5, step: 0.01 },
  { key: 'contrast', label: 'Contraste', min: -60, max: 60, step: 1 },
  { key: 'saturation', label: 'Saturación', min: -2, max: 3, step: 0.05 },
  { key: 'blur', label: 'Desenfoque', min: 0, max: 30, step: 1 },
];

/** "Editar foto": ajustes y filtros de la imagen seleccionada (no destructivos). */
export function PhotoPanel() {
  const img = useEditor((s) => {
    const page = s.doc.pages.find((p) => p.id === s.activePageId);
    const sel = page?.elements.find((e) => s.selectedIds.includes(e.id) && e.type === 'image');
    return (sel as ImageElement | undefined) ?? null;
  });
  const firstImage = useEditor((s) => s.doc.pages.find((p) => p.id === s.activePageId)?.elements.find((e) => e.type === 'image')?.id ?? null);

  // Al abrir "Editar foto" sin selección se toma la primera imagen de la página.
  useEffect(() => {
    if (!img && firstImage) useEditor.getState().select([firstImage]);
  }, [img, firstImage]);

  if (!img) return <p className="kbd">Seleccioná una imagen para editarla.</p>;
  const f = img.filters ?? {};
  const set = (patch: Partial<ImageFilters>, key?: string) =>
    useEditor.getState().updateElements([img.id], (d) => {
      if (d.type === 'image') d.filters = { ...(d.filters ?? {}), ...patch };
    }, { label: 'Editar foto', mergeKey: key ? `photo:${key}:${img.id}` : undefined });

  return (
    <div className="stack photo-panel" data-testid="photo-panel">
      <h3>Filtros</h3>
      <div className="preset-grid">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => useEditor.getState().updateElements([img.id], (d) => {
              if (d.type === 'image') d.filters = { ...p.f, flipX: d.filters?.flipX, flipY: d.filters?.flipY };
            }, { label: `Filtro ${p.label}` })}
            data-testid={`preset-${p.id}`}
          >
            <span className="preset-thumb" style={{ backgroundImage: `url(${img.src})`, filter: cssFilter(p.f) }} />
            {p.label}
          </button>
        ))}
      </div>
      <h3>Ajustes</h3>
      {SLIDERS.map((s) => (
        <label key={s.key} className="field">
          <span style={{ display: 'flex', justifyContent: 'space-between' }}>
            {s.label} <span>{Math.round(((f[s.key] as number | undefined) ?? 0) * (s.key === 'brightness' || s.key === 'saturation' ? 100 : 1))}</span>
          </span>
          <input type="range" min={s.min} max={s.max} step={s.step} value={(f[s.key] as number | undefined) ?? 0} onChange={(e) => set({ [s.key]: +e.target.value }, s.key)} data-testid={`photo-${s.key}`} />
        </label>
      ))}
      <div className="row">
        {([['grayscale', 'B/N'], ['sepia', 'Sepia'], ['invert', 'Invertir']] as const).map(([k, label]) => (
          <button key={k} className={f[k] ? 'active' : ''} onClick={() => set({ [k]: !f[k] })}>
            {label}
          </button>
        ))}
      </div>
      <div className="row">
        <button className={f.flipX ? 'active' : ''} onClick={() => set({ flipX: !f.flipX })} data-testid="photo-flipx">
          ↔ Voltear horizontal
        </button>
        <button className={f.flipY ? 'active' : ''} onClick={() => set({ flipY: !f.flipY })}>
          ↕ Voltear vertical
        </button>
      </div>
      <button onClick={() => useEditor.getState().updateElements([img.id], (d) => void (d.type === 'image' && (d.filters = undefined)), { label: 'Restablecer foto' })}>Restablecer</button>
    </div>
  );
}

/** Aproximación en CSS de los ajustes, para las miniaturas de los filtros. */
function cssFilter(f: ImageFilters): string {
  const parts: string[] = [];
  if (f.brightness) parts.push(`brightness(${1 + f.brightness})`);
  if (f.contrast) parts.push(`contrast(${1 + f.contrast / 100})`);
  if (f.saturation) parts.push(`saturate(${Math.max(0, 1 + f.saturation)})`);
  if (f.blur) parts.push(`blur(${f.blur / 6}px)`);
  if (f.grayscale) parts.push('grayscale(1)');
  if (f.sepia) parts.push('sepia(1)');
  if (f.invert) parts.push('invert(1)');
  return parts.join(' ') || 'none';
}
