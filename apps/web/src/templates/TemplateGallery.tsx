import { useEffect, useMemo, useRef, useState } from 'react';
import { DocPreview } from '../canvas/DocPreview';
import { CATEGORIES, TEMPLATES, searchTemplates, type Template } from './catalog';

interface Props {
  onPick(t: Template): void;
  /** Tamaño del diseño abierto: muestra primero "Este formato" (panel del editor). */
  current?: { width: number; height: number };
  compact?: boolean;
}

/** Galería de plantillas por categoría, con búsqueda (Inicio y panel del editor). */
export function TemplateGallery({ onPick, current, compact }: Props) {
  const [q, setQ] = useState('');
  const sameSize = useMemo(() => (current ? TEMPLATES.filter((t) => sizeOf(t).w === current.width && sizeOf(t).h === current.height) : []), [current]);
  const [cat, setCat] = useState<string>(current && sameSize.length ? 'same' : 'all');

  const list = q.trim() ? searchTemplates(q) : cat === 'all' ? TEMPLATES : cat === 'same' ? sameSize : TEMPLATES.filter((t) => t.category === cat);
  const usedCats = CATEGORIES.filter((c) => TEMPLATES.some((t) => t.category === c.id));

  return (
    <div className={`template-gallery${compact ? ' compact' : ''}`}>
      <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar entre ${TEMPLATES.length} plantillas`} aria-label="Buscar plantillas" data-testid="template-search" />
      {!q.trim() && (
        <div className="chips category-chips" data-testid="template-categories">
          {current && sameSize.length > 0 && (
            <button className={`chip${cat === 'same' ? ' active' : ''}`} onClick={() => setCat('same')}>
              Este formato
            </button>
          )}
          <button className={`chip${cat === 'all' ? ' active' : ''}`} onClick={() => setCat('all')}>
            Todas
          </button>
          {usedCats.map((c) => (
            <button key={c.id} className={`chip${cat === c.id ? ' active' : ''}`} onClick={() => setCat(c.id)} data-testid={`tcat-${c.id}`} title={`${c.width} × ${c.height} px${c.note ? ` (${c.note})` : ''}`}>
              {c.label}
            </button>
          ))}
        </div>
      )}
      {list.length === 0 && <p className="kbd">No hay plantillas para "{q}".</p>}
      <div className="template-grid" data-testid="templates">
        {list.map((t) => (
          <TemplateCard key={t.id} t={t} onPick={onPick} size={compact ? 120 : 180} />
        ))}
      </div>
    </div>
  );
}

const sizes = new Map<string, { w: number; h: number; pages: number }>();
function sizeOf(t: Template) {
  if (!sizes.has(t.id)) {
    const d = t.build();
    sizes.set(t.id, { w: d.width, h: d.height, pages: d.pages.length });
  }
  return sizes.get(t.id)!;
}

function TemplateCard({ t, onPick, size }: { t: Template; onPick(t: Template): void; size: number }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  // Las miniaturas son lienzos: solo se dibujan cuando la tarjeta entra en pantalla.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') return setVisible(true);
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && (setVisible(true), io.disconnect()), { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const doc = useMemo(() => (visible ? t.build() : null), [visible, t]);
  const info = sizeOf(t);
  const cat = CATEGORIES.find((c) => c.id === t.category);
  return (
    <button ref={ref} className="template-card" onClick={() => onPick(t)} data-testid={`template-${t.id}`} title={t.name}>
      <span className="thumb" style={{ height: size }}>
        {doc && <DocPreview page={doc.pages[0]} width={doc.width} height={doc.height} size={size} />}
        {info.pages > 1 && <span className="pages-badge">{info.pages} pág.</span>}
      </span>
      <span className="meta">
        <strong>{t.name}</strong>
        <small>
          {cat?.label} · {info.w} × {info.h}
        </small>
      </span>
    </button>
  );
}
