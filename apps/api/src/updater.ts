import { execFile } from 'node:child_process';
import type { PullResult, UpdateStatus } from '@trazo/shared';

type Run = (cmd: string, args: string[], cwd: string) => Promise<string>;

const run: Run = (cmd, args, cwd) =>
  new Promise((ok, fail) => {
    // npm es un .cmd en Windows y necesita shell; git no.
    const shell = process.platform === 'win32' && cmd === 'npm';
    execFile(cmd, args, { cwd, shell, timeout: 5 * 60_000, maxBuffer: 10 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) =>
      err ? fail(new Error((stderr || err.message).trim())) : ok(stdout),
    );
  });

const SEP = '\x1f';
const RANGE = 'HEAD..@{u}';

/**
 * Compara la copia local del proyecto con su rama remota (GitHub) y la actualiza con
 * `git merge --ff-only`, que nunca pisa trabajo local: si no puede avanzar, falla y lo informa.
 */
export class Updater {
  private lastFetch = 0;
  private fetching: Promise<void> | null = null;
  private pulling = false;

  constructor(
    private readonly cwd: string,
    private readonly opts: { minFetchIntervalMs?: number; run?: Run } = {},
  ) {}

  private git(...args: string[]) {
    return (this.opts.run ?? run)('git', args, this.cwd);
  }

  private async fetch() {
    if (Date.now() - this.lastFetch < (this.opts.minFetchIntervalMs ?? 8_000)) return;
    // Varias pestañas preguntan a la vez: un solo fetch para todas.
    this.fetching ??= this.git('fetch', '--quiet', '--prune')
      .then(() => void (this.lastFetch = Date.now()))
      .finally(() => (this.fetching = null));
    await this.fetching;
  }

  private async changes(range: string) {
    const log = await this.git('log', `--format=%h${SEP}%s${SEP}%an${SEP}%cI`, range);
    const commits = log
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        const [hash, subject, author, date] = l.split(SEP);
        return { hash, subject, author, date };
      });
    const diff = await this.git('diff', '--name-status', range.replace('..', '...'));
    const files = diff
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        const parts = l.split('\t');
        return { status: parts[0][0], path: parts[parts.length - 1] };
      });
    return { commits, files };
  }

  async status(): Promise<UpdateStatus> {
    const checkedAt = new Date().toISOString();
    const off = (reason: string): UpdateStatus => ({ enabled: false, reason, behind: 0, ahead: 0, commits: [], files: [], dirty: [], checkedAt });
    try {
      await this.git('rev-parse', '--is-inside-work-tree');
    } catch {
      return off('La carpeta del proyecto no es un repositorio de git.');
    }
    let upstream: string;
    try {
      upstream = (await this.git('rev-parse', '--abbrev-ref', '@{u}')).trim();
    } catch {
      return off('La rama actual no sigue a ninguna rama de GitHub.');
    }
    let error: string | undefined;
    try {
      await this.fetch();
    } catch (e) {
      // Sin internet se sigue mostrando lo último que se trajo.
      error = `No se pudo consultar GitHub: ${(e as Error).message}`;
    }
    const [branch, current, remote, counts, porcelain] = await Promise.all([
      this.git('rev-parse', '--abbrev-ref', 'HEAD'),
      this.git('rev-parse', '--short', 'HEAD'),
      this.git('rev-parse', '--short', '@{u}'),
      this.git('rev-list', '--left-right', '--count', 'HEAD...@{u}'),
      this.git('status', '--porcelain', '--untracked-files=no'),
    ]);
    const [ahead, behind] = counts.trim().split(/\s+/).map(Number);
    const { commits, files } = behind > 0 ? await this.changes(RANGE) : { commits: [], files: [] };
    return {
      enabled: true,
      branch: `${branch.trim()} → ${upstream}`,
      current: current.trim(),
      remote: remote.trim(),
      behind,
      ahead,
      commits,
      files,
      dirty: porcelain.split('\n').filter(Boolean).map((l) => l.slice(3)),
      checkedAt,
      error,
    };
  }

  async pull(): Promise<PullResult> {
    if (this.pulling) throw new Error('Ya hay una actualización en curso.');
    this.pulling = true;
    try {
      this.lastFetch = 0;
      await this.fetch();
      const from = (await this.git('rev-parse', '--short', 'HEAD')).trim();
      const { commits, files } = await this.changes(RANGE);
      try {
        await this.git('merge', '--ff-only', '@{u}');
      } catch (e) {
        return { ok: false, from, to: from, commits, files, installed: false, error: (e as Error).message };
      }
      const to = (await this.git('rev-parse', '--short', 'HEAD')).trim();
      const depsChanged = files.some((f) => /(^|\/)package(-lock)?\.json$/.test(f.path));
      let installed = false;
      if (depsChanged) {
        try {
          await (this.opts.run ?? run)('npm', ['install', '--no-audit', '--no-fund'], this.cwd);
          installed = true;
        } catch (e) {
          return { ok: false, from, to, commits, files, installed, error: `Se actualizó el código pero falló npm install: ${(e as Error).message}` };
        }
      }
      return { ok: true, from, to, commits, files, installed };
    } finally {
      this.pulling = false;
    }
  }
}
