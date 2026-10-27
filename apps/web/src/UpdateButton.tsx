import { useEffect, useRef, useState } from 'react';
import type { PullResult, UpdateCommit, UpdateFile, UpdateStatus } from '@trazo/shared';
import { api } from './api/client';
import { Icon } from './editor/icons';

const POLL_MS = 10_000;
/** Lo que se aplicó en la última actualización, para mostrarlo después de recargar (o de reinstalar la app). */
const LAST = 'banva:lastUpdate';

const FILE_STATUS: Record<string, string> = { A: 'Nuevo', M: 'Modificado', D: 'Eliminado', R: 'Renombrado', C: 'Copiado' };
const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

function ago(iso: string) {
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const [unit, n] of [['day', 86400], ['hour', 3600], ['minute', 60]] as const) if (Math.abs(s) >= n) return rtf.format(Math.round(s / n), unit);
  return 'recién';
}

function readLast(): PullResult | null {
  try {
    const raw = localStorage.getItem(LAST);
    return raw ? (JSON.parse(raw) as PullResult) : null;
  } catch {
    return null;
  }
}

/**
 * Botón "Actualizar": cada 10 s le pregunta a la API si hay commits nuevos en GitHub.
 * Se habilita cuando los hay, muestra qué cambia y al tocarlo hace git pull del proyecto.
 */
export function UpdateButton() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState<PullResult | null>(readLast);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const check = () =>
      api
        .updateStatus()
        .then((s) => alive && setStatus(s))
        .catch(() => alive && setStatus(null));
    void check();
    const t = setInterval(check, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (applied) setOpen(true);
  }, [applied]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (!status?.enabled) return null;

  const pending = status.behind > 0;
  const dismissApplied = () => {
    try {
      localStorage.removeItem(LAST);
    } catch {
      /* sin almacenamiento: solo se cierra */
    }
    setApplied(null);
    setOpen(false);
  };

  const pull = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.pullUpdate();
      if (!r.ok) throw new Error(r.error ?? 'No se pudo actualizar.');
      if (r.to === r.from) return void setStatus((s) => s && { ...s, behind: 0, commits: [], files: [] });
      try {
        localStorage.setItem(LAST, JSON.stringify(r));
      } catch {
        /* el aviso posterior es opcional */
      }
      setApplied(r);
      // App de escritorio: se cierra sola para instalar. Código fuente: Vite y la API ya tienen el código nuevo.
      if (!r.restarting) setTimeout(() => location.reload(), 1500);
    } catch (e) {
      setError((e as Error).message);
      setOpen(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="popover-anchor update" ref={ref}>
      <div className="update-controls">
        {pending && (
          <button className="ghost update-count" onClick={() => setOpen(!open)} aria-expanded={open} data-testid="update-changes">
            {status.behind === 1 ? '1 cambio nuevo' : `${status.behind} cambios nuevos`}
          </button>
        )}
        <button
          className={pending ? 'primary' : ''}
          disabled={!pending || busy}
          onClick={pull}
          title={pending ? `Traer los cambios de ${status.branch}` : `Banva está al día (${status.current})`}
          data-testid="update-run"
        >
          <Icon name="download" /> {busy ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>
      {open && (
        <div className="popover update-panel" data-testid="update-panel">
          {applied ? (
            <>
              <h4>{applied.restarting && status.current !== applied.to ? 'Instalando la actualización' : 'Banva se actualizó'}</h4>
              <p className="update-sub">
                De <code>{applied.from}</code> a <code>{applied.to}</code>
                {applied.installed && ', con dependencias reinstaladas'}
                {applied.restarting && status.current !== applied.to ? '. Banva se cierra y se vuelve a abrir solo.' : '.'}
              </p>
              <Changes commits={applied.commits} files={applied.files} />
              <button onClick={dismissApplied}>Cerrar</button>
            </>
          ) : (
            <>
              <h4>Cambios en GitHub</h4>
              <p className="update-sub">
                Tenés <code>{status.current}</code>, GitHub tiene <code>{status.remote}</code>. Revisado {ago(status.checkedAt)}.
              </p>
              {status.error && <p className="update-warn">{status.error}</p>}
              {status.dirty.length > 0 && (
                <p className="update-warn">
                  Hay archivos editados en esta computadora ({status.dirty.slice(0, 3).join(', ')}
                  {status.dirty.length > 3 ? '…' : ''}). Si los cambios de GitHub tocan los mismos archivos, la actualización se cancela sin perder nada.
                </p>
              )}
              {status.ahead > 0 && <p className="update-warn">Esta copia tiene {status.ahead} commit(s) que no están en GitHub; hay que fusionarlos a mano.</p>}
              {error && <p className="update-error">{error}</p>}
              <Changes commits={status.commits} files={status.files} />
              <button className="primary" disabled={busy} onClick={pull}>
                {busy ? 'Actualizando…' : 'Actualizar'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Changes({ commits, files }: { commits: UpdateCommit[]; files: UpdateFile[] }) {
  return (
    <div className="update-changes">
      <ul className="update-commits">
        {commits.map((c) => (
          <li key={c.hash}>
            <strong>{c.subject}</strong>
            <small>
              {c.author}, {ago(c.date)} <code>{c.hash}</code>
            </small>
          </li>
        ))}
      </ul>
      {files.length > 0 && (
        <details className="update-files">
          <summary>{files.length === 1 ? '1 archivo' : `${files.length} archivos`}</summary>
          <ul>
            {files.map((f) => (
              <li key={f.path}>
                <span className={`fstat s-${f.status}`}>{FILE_STATUS[f.status] ?? f.status}</span>
                <span className="fpath">{f.path}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
