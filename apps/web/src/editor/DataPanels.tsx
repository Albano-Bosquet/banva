import { useEffect, useState } from 'react';
import { CHART_COLORS, formUnits, newId, toNumber, type ChartElement, type ChartType, type FormElement, type FormField, type FormResponse } from '@trazo/shared';
import type { Draft } from 'immer';
import { getBackend } from '../api/backend';
import { useEditor } from '../store/editorStore';
import { FONTS } from './ContextBar';
import { Icon } from './icons';

function useSelected<T extends ChartElement['type'] | FormElement['type']>(type: T) {
  return useEditor((s) => {
    if (s.selectedIds.length !== 1) return null;
    const el = s.doc.pages.flatMap((p) => p.elements).find((e) => e.id === s.selectedIds[0]);
    return el?.type === type ? (el as Extract<typeof el, { type: T }>) : null;
  });
}

// --------------------------------------------------------------------------- gráfico

const CHART_TYPES: { type: ChartType; label: string }[] = [
  { type: 'bar', label: 'Barras verticales' },
  { type: 'hbar', label: 'Barras horizontales' },
  { type: 'stacked', label: 'Barras apiladas' },
  { type: 'line', label: 'Líneas' },
  { type: 'area', label: 'Área' },
  { type: 'pie', label: 'Torta' },
  { type: 'donut', label: 'Anillo' },
];

export function ChartPanel() {
  const el = useSelected('chart');
  const [tab, setTab] = useState<'data' | 'style'>('data');
  if (!el) return <p className="kbd">Seleccioná un gráfico para editar sus datos.</p>;
  const upd = (label: string, fn: (d: Draft<ChartElement>) => void, key?: string) =>
    useEditor.getState().updateElements([el.id], (d) => {
      if (d.type === 'chart') fn(d);
    }, { label, mergeKey: key ? `${key}:${el.id}` : undefined });

  return (
    <div data-testid="chart-panel">
      <h3>Gráfico</h3>
      <select value={el.chartType} onChange={(e) => upd('Tipo de gráfico', (d) => void (d.chartType = e.target.value as ChartType))} aria-label="Tipo de gráfico" data-testid="chart-type">
        {CHART_TYPES.map((t) => (
          <option key={t.type} value={t.type}>
            {t.label}
          </option>
        ))}
      </select>
      <div className="tabs">
        <button className={tab === 'data' ? 'active' : ''} onClick={() => setTab('data')}>
          Datos
        </button>
        <button className={tab === 'style' ? 'active' : ''} onClick={() => setTab('style')}>
          Personalizar
        </button>
      </div>
      {tab === 'data' ? <ChartData el={el} upd={upd} /> : <ChartStyle el={el} upd={upd} />}
    </div>
  );
}

type ChartUpd = (label: string, fn: (d: Draft<ChartElement>) => void, key?: string) => void;

function ChartData({ el, upd }: { el: ChartElement; upd: ChartUpd }) {
  const single = el.chartType === 'pie' || el.chartType === 'donut';
  const series = single ? el.series.slice(0, 1) : el.series;
  return (
    <>
      <div className="data-grid" style={{ gridTemplateColumns: `1.3fr repeat(${series.length}, 1fr) 28px` }} data-testid="chart-data">
        <span className="hdr">Etiqueta</span>
        {series.map((s, si) => (
          <span key={si} className="hdr series-hdr">
            <input type="color" value={s.color} onChange={(e) => upd('Color de serie', (d) => void (d.series[si].color = e.target.value), `sc${si}`)} aria-label={`Color de ${s.name}`} />
            <input value={s.name} onChange={(e) => upd('Nombre de serie', (d) => void (d.series[si].name = e.target.value), `sn${si}`)} aria-label={`Nombre de la serie ${si + 1}`} />
          </span>
        ))}
        <span />
        {el.labels.map((label, i) => (
          <Row key={i} i={i} label={label} series={series} el={el} upd={upd} />
        ))}
      </div>
      <div className="row">
        <button
          onClick={() =>
            upd('Agregar fila', (d) => {
              d.labels.push(`Dato ${d.labels.length + 1}`);
              for (const s of d.series) s.values.push(0);
            })
          }
          data-testid="chart-add-row"
        >
          + Fila
        </button>
        {!single && (
          <button
            onClick={() =>
              upd('Agregar serie', (d) => {
                d.series.push({ name: `Serie ${d.series.length + 1}`, color: CHART_COLORS[d.series.length % CHART_COLORS.length], values: d.labels.map(() => 0) });
                d.showLegend = true;
              })
            }
          >
            + Serie
          </button>
        )}
        {!single && el.series.length > 1 && <button onClick={() => upd('Quitar serie', (d) => void d.series.pop())}>− Serie</button>}
      </div>
      <label className="field">
        Pegar datos (CSV o desde una planilla)
        <textarea
          rows={3}
          placeholder={'Mes,Ventas\nEne,12\nFeb,19'}
          onBlur={(e) => {
            const parsed = parseTable(e.target.value);
            if (!parsed) return;
            upd('Importar datos', (d) => {
              d.labels = parsed.labels;
              d.series = parsed.series.map((s, i) => ({ ...s, color: d.series[i]?.color ?? CHART_COLORS[i % CHART_COLORS.length] }));
            });
            e.target.value = '';
          }}
        />
      </label>
    </>
  );
}

function Row({ i, label, series, el, upd }: { i: number; label: string; series: ChartElement['series']; el: ChartElement; upd: ChartUpd }) {
  return (
    <>
      <input value={label} onChange={(e) => upd('Editar etiqueta', (d) => void (d.labels[i] = e.target.value), `l${i}`)} aria-label={`Etiqueta ${i + 1}`} />
      {series.map((s, si) => (
        <input
          key={si}
          type="number"
          value={s.values[i] ?? 0}
          onChange={(e) => upd('Editar valor', (d) => void (d.series[si].values[i] = Number(e.target.value) || 0), `v${si}-${i}`)}
          aria-label={`${s.name} de ${label}`}
          data-testid={`chart-value-${si}-${i}`}
        />
      ))}
      <button
        className="ghost"
        title="Quitar fila"
        disabled={el.labels.length <= 1}
        onClick={() =>
          upd('Quitar fila', (d) => {
            d.labels.splice(i, 1);
            for (const s of d.series) s.values.splice(i, 1);
          })
        }
      >
        <Icon name="close" size={14} />
      </button>
    </>
  );
}

/** "Etiqueta,Serie1,Serie2\nEne,1,2" (coma, punto y coma o tabulación) → datos del gráfico. */
export function parseTable(text: string): { labels: string[]; series: { name: string; values: number[] }[] } | null {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return null;
  const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const rows = lines.map((l) => l.split(sep).map((c) => c.trim()));
  const header = rows[0];
  if (header.length < 2) return null;
  return {
    labels: rows.slice(1).map((r) => r[0] ?? ''),
    series: header.slice(1).map((name, i) => ({ name, values: rows.slice(1).map((r) => toNumber(r[i + 1] ?? '') ?? 0) })),
  };
}

function ChartStyle({ el, upd }: { el: ChartElement; upd: ChartUpd }) {
  const toggle = (key: 'showLegend' | 'showValues' | 'showGrid', label: string) => (
    <label className="switch">
      <input type="checkbox" checked={el[key]} onChange={(e) => upd(label, (d) => void (d[key] = e.target.checked))} />
      {label}
    </label>
  );
  return (
    <div className="stack">
      {toggle('showLegend', 'Leyenda')}
      {toggle('showValues', 'Etiquetas de datos')}
      {toggle('showGrid', 'Líneas de la grilla')}
      <label className="field">
        Título
        <input value={el.title} placeholder="Agregá un título" onChange={(e) => upd('Título del gráfico', (d) => void (d.title = e.target.value), 'title')} data-testid="chart-title" />
      </label>
      <label className="field">
        Tipografía
        <select value={el.fontFamily} onChange={(e) => upd('Tipografía', (d) => void (d.fontFamily = e.target.value))}>
          {FONTS.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </label>
      <label className="field">
        Color del texto
        <input type="color" value={el.textColor} onChange={(e) => upd('Color del texto', (d) => void (d.textColor = e.target.value), 'tc')} />
      </label>
    </div>
  );
}

// --------------------------------------------------------------------------- formulario

const FIELD_KINDS: { kind: FormField['kind']; label: string }[] = [
  { kind: 'text', label: 'Texto corto' },
  { kind: 'email', label: 'Correo' },
  { kind: 'textarea', label: 'Texto largo' },
  { kind: 'rating', label: 'Estrellas' },
  { kind: 'choice', label: 'Opciones' },
];

export function FormPanel() {
  const el = useSelected('form');
  const designId = useEditor((s) => s.designId);
  const [responses, setResponses] = useState<FormResponse[] | null>(null);
  useEffect(() => {
    setResponses(null);
  }, [el?.id]);
  if (!el) return <p className="kbd">Seleccioná un formulario para editarlo.</p>;

  // Al cambiar los campos se ajusta el alto para que el formulario no se recorte.
  const upd = (label: string, fn: (d: Draft<FormElement>) => void, key?: string) =>
    useEditor.getState().updateElements([el.id], (d) => {
      if (d.type !== 'form') return;
      fn(d);
      d.height = Math.round(formUnits(d.fields) * (d.width / 18));
    }, { label, mergeKey: key ? `${key}:${el.id}` : undefined });

  const loadResponses = async () => {
    if (!designId) return;
    setResponses(await (await getBackend()).listResponses(designId, el.id));
  };

  return (
    <div className="stack" data-testid="form-panel">
      <h3>Formulario</h3>
      <label className="field">
        Título
        <input value={el.title} onChange={(e) => upd('Título del formulario', (d) => void (d.title = e.target.value), 'ft')} />
      </label>
      <h3>Campos</h3>
      {el.fields.map((f, i) => (
        <div key={f.id} className="form-field-edit">
          <input value={f.label} onChange={(e) => upd('Etiqueta del campo', (d) => void (d.fields[i].label = e.target.value), `fl${i}`)} aria-label={`Etiqueta del campo ${i + 1}`} />
          <select value={f.kind} onChange={(e) => upd('Tipo de campo', (d) => {
            d.fields[i].kind = e.target.value as FormField['kind'];
            if (d.fields[i].kind === 'choice' && !d.fields[i].options?.length) d.fields[i].options = ['Opción 1', 'Opción 2'];
          })}>
            {FIELD_KINDS.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label}
              </option>
            ))}
          </select>
          <label className="switch" title="Obligatorio">
            <input type="checkbox" checked={!!f.required} onChange={(e) => upd('Obligatorio', (d) => void (d.fields[i].required = e.target.checked))} />*
          </label>
          <button className="ghost" title="Quitar campo" onClick={() => upd('Quitar campo', (d) => void d.fields.splice(i, 1))}>
            <Icon name="close" size={14} />
          </button>
          {f.kind === 'choice' && (
            <input
              className="options"
              value={(f.options ?? []).join(', ')}
              onChange={(e) => upd('Opciones', (d) => void (d.fields[i].options = e.target.value.split(',').map((x) => x.trim()).filter(Boolean)), `fo${i}`)}
              aria-label="Opciones separadas por comas"
              placeholder="Opciones separadas por comas"
            />
          )}
        </div>
      ))}
      <button onClick={() => upd('Agregar campo', (d) => void d.fields.push({ id: newId('f'), label: 'Nuevo campo', kind: 'text' }))} data-testid="form-add-field">
        + Agregar campo
      </button>
      <label className="field">
        Texto del botón
        <input value={el.submitLabel} onChange={(e) => upd('Botón', (d) => void (d.submitLabel = e.target.value), 'fb')} />
      </label>
      <div className="row">
        <label className="field">
          Acento
          <input type="color" value={el.accent} onChange={(e) => upd('Color', (d) => void (d.accent = e.target.value), 'fa')} />
        </label>
        <label className="field">
          Fondo
          <input type="color" value={el.background} onChange={(e) => upd('Fondo', (d) => void (d.background = e.target.value), 'fbg')} />
        </label>
        <label className="field">
          Texto
          <input type="color" value={el.textColor} onChange={(e) => upd('Texto', (d) => void (d.textColor = e.target.value), 'ftc')} />
        </label>
      </div>
      <h3>Respuestas</h3>
      <button onClick={loadResponses} data-testid="form-responses">
        Ver respuestas
      </button>
      {responses && responses.length === 0 && <p className="kbd">Todavía no hay respuestas. Compartí la vista "Presentar".</p>}
      {responses && responses.length > 0 && (
        <div className="responses" data-testid="responses-list">
          {responses.map((r) => (
            <div key={r.id} className="response">
              <small>{new Date(r.at).toLocaleString('es-AR')}</small>
              {el.fields.map((f) => r.values[f.id] !== undefined && (
                <div key={f.id}>
                  <b>{f.label}:</b> {f.kind === 'rating' ? '★'.repeat(Number(r.values[f.id])) : String(r.values[f.id])}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
