import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Updater } from './updater';

let dir: string;
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' });

/** "GitHub" (repo desnudo), la copia de Banva que se actualiza y otra copia desde donde se suben cambios. */
async function setup() {
  dir = await mkdtemp(join(tmpdir(), 'banva-upd-'));
  const origin = join(dir, 'origin.git');
  const local = join(dir, 'local');
  const other = join(dir, 'other');
  git(dir, 'init', '--bare', '-q', '-b', 'main', origin);
  git(dir, 'clone', '-q', origin, other);
  git(other, 'config', 'user.name', 'Prueba');
  git(other, 'config', 'user.email', 'prueba@example.com');
  git(other, 'checkout', '-q', '-b', 'main');
  await writeFile(join(other, 'README.md'), 'hola\n');
  git(other, 'add', '.');
  git(other, 'commit', '-q', '-m', 'Inicio');
  git(other, 'push', '-q', '-u', 'origin', 'main');
  git(dir, 'clone', '-q', origin, local);
  return { local, other };
}

let local: string;
let other: string;
beforeAll(async () => ({ local, other } = await setup()));
afterAll(() => rm(dir, { recursive: true, force: true }));

describe('Updater', () => {
  it('no hay cambios recién clonado', async () => {
    const s = await new Updater(local, { minFetchIntervalMs: 0 }).status();
    expect(s).toMatchObject({ enabled: true, behind: 0, ahead: 0, commits: [], files: [] });
  });

  it('detecta commits nuevos en GitHub con sus archivos y los trae con pull', async () => {
    await writeFile(join(other, 'README.md'), 'hola de nuevo\n');
    await writeFile(join(other, 'nuevo.txt'), 'x\n');
    git(other, 'add', '.');
    git(other, 'commit', '-q', '-m', 'Agregar nuevo.txt');
    git(other, 'push', '-q');

    const upd = new Updater(local, { minFetchIntervalMs: 0 });
    const s = await upd.status();
    expect(s.behind).toBe(1);
    expect(s.commits.map((c) => c.subject)).toEqual(['Agregar nuevo.txt']);
    expect(s.files).toEqual(expect.arrayContaining([{ status: 'M', path: 'README.md' }, { status: 'A', path: 'nuevo.txt' }]));

    const r = await upd.pull();
    expect(r).toMatchObject({ ok: true, installed: false });
    expect(r.to).not.toBe(r.from);
    expect(r.commits).toHaveLength(1);
    expect((await upd.status()).behind).toBe(0);
  });

  it('una carpeta sin git queda desactivada', async () => {
    const s = await new Updater(tmpdir()).status();
    expect(s.enabled).toBe(false);
  });
});
