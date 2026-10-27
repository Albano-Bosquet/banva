import { app } from 'electron';
import { autoUpdater, type UpdateInfo } from 'electron-updater';
import type { PullResult, UpdateCommit, UpdateFile, UpdateStatus } from '@trazo/shared';
import type { UpdateSource } from '../../api/src/updater';

const FILE_STATUS: Record<string, string> = { added: 'A', modified: 'M', removed: 'D', renamed: 'R', copied: 'C', changed: 'M' };

interface Changes {
  commits: UpdateCommit[];
  files: UpdateFile[];
}

/** 1.10.0 > 1.9.3: compara versiones semánticas sin sufijos. */
export function newer(a: string, b: string) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  return false;
}

/**
 * Actualizaciones de la app instalada: busca en GitHub Releases un instalador más nuevo
 * (electron-updater lee latest.yml del release), muestra los commits entre las dos
 * versiones y, al actualizar, lo descarga y reinicia Banva para instalarlo.
 */
export class ReleaseUpdater implements UpdateSource {
  private lastCheck = 0;
  private checking: Promise<void> | null = null;
  private available: UpdateInfo | null = null;
  private error: string | undefined;
  private changes = new Map<string, Changes>();

  constructor(
    private readonly github: { owner: string; repo: string },
    private readonly minCheckIntervalMs = 10_000,
  ) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.logger = null;
  }

  private async check(force = false) {
    if (!force && Date.now() - this.lastCheck < this.minCheckIntervalMs) return;
    this.checking ??= autoUpdater
      .checkForUpdates()
      .then((r) => {
        const info = r?.updateInfo;
        this.available = info && newer(info.version, app.getVersion()) ? info : null;
        this.error = undefined;
      })
      .catch((e: Error) => {
        // Sin internet o sin releases publicados todavía: se informa y se sigue.
        this.error = `No se pudo consultar GitHub: ${e.message.split('\n')[0]}`;
      })
      .finally(() => {
        this.lastCheck = Date.now();
        this.checking = null;
      });
    await this.checking;
  }

  /** Commits y archivos entre dos versiones, con la API de comparación de GitHub (una vez por versión). */
  private async changesTo(info: UpdateInfo): Promise<Changes> {
    const cached = this.changes.get(info.version);
    if (cached) return cached;
    const notes = typeof info.releaseNotes === 'string' ? info.releaseNotes.replace(/<[^>]+>/g, '').trim() : '';
    const fallback: Changes = { commits: [{ hash: `v${info.version}`, subject: notes || `Versión ${info.version}`, author: 'Banva', date: info.releaseDate }], files: [] };
    try {
      const res = await fetch(`https://api.github.com/repos/${this.github.owner}/${this.github.repo}/compare/v${app.getVersion()}...v${info.version}`, {
        headers: { accept: 'application/vnd.github+json', 'user-agent': 'Banva' },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return fallback;
      const body = (await res.json()) as {
        commits: { sha: string; commit: { message: string; author: { name: string; date: string } } }[];
        files?: { filename: string; status: string }[];
      };
      const changes: Changes = {
        // GitHub los da del más viejo al más nuevo; se muestran como git log, el más nuevo primero.
        commits: body.commits
          .map((c) => ({ hash: c.sha.slice(0, 7), subject: c.commit.message.split('\n')[0], author: c.commit.author.name, date: c.commit.author.date }))
          .reverse(),
        files: (body.files ?? []).map((f) => ({ status: FILE_STATUS[f.status] ?? 'M', path: f.filename })),
      };
      this.changes.set(info.version, changes);
      return changes;
    } catch {
      return fallback;
    }
  }

  async status(): Promise<UpdateStatus> {
    await this.check();
    const current = app.getVersion();
    const info = this.available;
    const { commits, files } = info ? await this.changesTo(info) : { commits: [], files: [] };
    return {
      enabled: true,
      branch: 'GitHub Releases',
      current,
      remote: info?.version ?? current,
      behind: info ? Math.max(1, commits.length) : 0,
      ahead: 0,
      commits,
      files,
      dirty: [],
      checkedAt: new Date(this.lastCheck || Date.now()).toISOString(),
      error: this.error,
    };
  }

  async pull(): Promise<PullResult> {
    const from = app.getVersion();
    await this.check(true);
    const info = this.available;
    if (!info) return { ok: !this.error, from, to: from, commits: [], files: [], installed: false, error: this.error };
    const { commits, files } = await this.changesTo(info);
    try {
      await autoUpdater.downloadUpdate();
    } catch (e) {
      return { ok: false, from, to: from, commits, files, installed: false, error: `No se pudo descargar la versión ${info.version}: ${(e as Error).message}` };
    }
    // Se responde antes de cerrar para que la página alcance a mostrar el aviso.
    setTimeout(() => autoUpdater.quitAndInstall(true, true), 1500);
    return { ok: true, from, to: info.version, commits, files, installed: false, restarting: true };
  }
}
