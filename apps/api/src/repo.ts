import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import type { Design, DesignDoc, DesignSummary, FormResponse, Patch } from '@trazo/shared';

/** Persistencia de diseños. PostgreSQL en producción; archivos JSON para desarrollo sin base de datos. */
export interface Repo {
  kind: 'postgres' | 'file';
  list(): Promise<DesignSummary[]>;
  get(id: string): Promise<Design | null>;
  create(id: string, doc: DesignDoc): Promise<Design>;
  /**
   * Guarda el documento y devuelve la nueva revisión (último en escribir gana).
   * `revision` explícita la usa la sala de colaboración, que lleva su propio contador.
   */
  save(id: string, doc: DesignDoc, revision?: number): Promise<{ revision: number; updatedAt: string } | null>;
  /** Registra una operación (deltas) aplicada por el canal de colaboración. */
  logOp(id: string, revision: number, clientId: string, patches: Patch[]): Promise<void>;
  remove(id: string): Promise<boolean>;
  setThumbnail(id: string, png: Buffer): Promise<void>;
  getThumbnail(id: string): Promise<Buffer | null>;
  /** Respuestas de los formularios de un diseño (enviadas desde la presentación). */
  addResponse(designId: string, response: FormResponse): Promise<void>;
  listResponses(designId: string, formId: string): Promise<FormResponse[]>;
  close(): Promise<void>;
}

const summary = (d: Design): DesignSummary => ({
  id: d.id,
  title: d.doc.title,
  kind: d.doc.kind,
  width: d.doc.width,
  height: d.doc.height,
  pageCount: d.doc.pages.length,
  updatedAt: d.updatedAt,
});

export class FileRepo implements Repo {
  kind = 'file' as const;
  private cache = new Map<string, Design>();
  private writes = new Map<string, Promise<void>>();

  constructor(private dir: string) {}

  async init() {
    await mkdir(join(this.dir, 'thumbs'), { recursive: true });
    await mkdir(join(this.dir, 'responses'), { recursive: true });
    for (const f of await readdir(this.dir)) {
      if (!f.endsWith('.json')) continue;
      const d = JSON.parse(await readFile(join(this.dir, f), 'utf8')) as Design;
      this.cache.set(d.id, d);
    }
    return this;
  }

  private persist(d: Design) {
    // Escrituras en serie por diseño para no pisar un archivo a medio escribir.
    const prev = this.writes.get(d.id) ?? Promise.resolve();
    const next = prev.then(() => writeFile(join(this.dir, `${d.id}.json`), JSON.stringify(d)));
    this.writes.set(d.id, next.catch(() => {}));
    return next;
  }

  async list() {
    return [...this.cache.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(summary);
  }
  async get(id: string) {
    return this.cache.get(id) ?? null;
  }
  async create(id: string, doc: DesignDoc) {
    const now = new Date().toISOString();
    const d: Design = { id, revision: 0, createdAt: now, updatedAt: now, doc };
    this.cache.set(id, d);
    await this.persist(d);
    return d;
  }
  async save(id: string, doc: DesignDoc, revision?: number) {
    const prev = this.cache.get(id);
    if (!prev) return null;
    const d: Design = { ...prev, doc, revision: revision ?? prev.revision + 1, updatedAt: new Date().toISOString() };
    this.cache.set(id, d);
    await this.persist(d);
    return { revision: d.revision, updatedAt: d.updatedAt };
  }
  async logOp() {
    // El modo archivo no guarda historial de operaciones.
  }
  async remove(id: string) {
    const had = this.cache.delete(id);
    await rm(join(this.dir, `${id}.json`), { force: true });
    await rm(join(this.dir, 'thumbs', `${id}.jpg`), { force: true });
    await rm(join(this.dir, 'responses', `${id}.json`), { force: true });
    return had;
  }
  private async readResponses(designId: string): Promise<FormResponse[]> {
    try {
      return JSON.parse(await readFile(join(this.dir, 'responses', `${designId}.json`), 'utf8')) as FormResponse[];
    } catch {
      return [];
    }
  }
  private responseWrites = new Map<string, Promise<void>>();
  async addResponse(designId: string, response: FormResponse) {
    // Lectura-modificación-escritura en serie por diseño.
    const prev = this.responseWrites.get(designId) ?? Promise.resolve();
    const next = prev.then(async () => {
      const all = await this.readResponses(designId);
      all.push(response);
      await writeFile(join(this.dir, 'responses', `${designId}.json`), JSON.stringify(all));
    });
    this.responseWrites.set(designId, next.catch(() => {}));
    await next;
  }
  async listResponses(designId: string, formId: string) {
    await this.responseWrites.get(designId);
    return (await this.readResponses(designId)).filter((r) => r.formId === formId);
  }
  async setThumbnail(id: string, img: Buffer) {
    await writeFile(join(this.dir, 'thumbs', `${id}.jpg`), img);
  }
  async getThumbnail(id: string) {
    try {
      return await readFile(join(this.dir, 'thumbs', `${id}.jpg`));
    } catch {
      return null;
    }
  }
  async close() {
    await Promise.all(this.writes.values());
  }
}

export class PgRepo implements Repo {
  kind = 'postgres' as const;
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString });
  }

  async init() {
    const sql = readFileSync(new URL('../sql/001_init.sql', import.meta.url), 'utf8');
    await this.pool.query(sql);
    return this;
  }

  private row(r: { id: string; revision: number; doc: DesignDoc; created_at: Date; updated_at: Date }): Design {
    return { id: r.id, revision: r.revision, doc: r.doc, createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString() };
  }

  async list() {
    const { rows } = await this.pool.query(
      `SELECT id, doc->>'title' AS title, doc->>'kind' AS kind, (doc->>'width')::int AS width, (doc->>'height')::int AS height,
              jsonb_array_length(doc->'pages') AS page_count, updated_at
         FROM designs ORDER BY updated_at DESC LIMIT 200`,
    );
    return rows.map((r) => ({ id: r.id, title: r.title, kind: r.kind ?? undefined, width: r.width, height: r.height, pageCount: r.page_count, updatedAt: r.updated_at.toISOString() }));
  }
  async get(id: string) {
    const { rows } = await this.pool.query('SELECT id, revision, doc, created_at, updated_at FROM designs WHERE id = $1', [id]);
    return rows[0] ? this.row(rows[0]) : null;
  }
  async create(id: string, doc: DesignDoc) {
    const { rows } = await this.pool.query('INSERT INTO designs (id, doc) VALUES ($1, $2) RETURNING id, revision, doc, created_at, updated_at', [id, doc]);
    return this.row(rows[0]);
  }
  async save(id: string, doc: DesignDoc, revision?: number) {
    const { rows } = await this.pool.query(
      'UPDATE designs SET doc = $2, revision = COALESCE($3, revision + 1), updated_at = now() WHERE id = $1 RETURNING revision, updated_at',
      [id, doc, revision ?? null],
    );
    return rows[0] ? { revision: rows[0].revision, updatedAt: rows[0].updated_at.toISOString() } : null;
  }
  async logOp(id: string, revision: number, clientId: string, patches: Patch[]) {
    await this.pool.query('INSERT INTO design_ops (design_id, revision, client_id, patches) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [
      id,
      revision,
      clientId,
      JSON.stringify(patches),
    ]);
  }
  async remove(id: string) {
    const r = await this.pool.query('DELETE FROM designs WHERE id = $1', [id]);
    return (r.rowCount ?? 0) > 0;
  }
  async setThumbnail(id: string, img: Buffer) {
    await this.pool.query('UPDATE designs SET thumbnail = $2 WHERE id = $1', [id, img]);
  }
  async getThumbnail(id: string) {
    const { rows } = await this.pool.query('SELECT thumbnail FROM designs WHERE id = $1', [id]);
    return rows[0]?.thumbnail ?? null;
  }
  async addResponse(designId: string, r: FormResponse) {
    await this.pool.query('INSERT INTO form_responses (id, design_id, form_id, data, created_at) VALUES ($1, $2, $3, $4, $5)', [
      r.id,
      designId,
      r.formId,
      JSON.stringify(r.values),
      r.at,
    ]);
  }
  async listResponses(designId: string, formId: string) {
    const { rows } = await this.pool.query(
      'SELECT id, form_id, data, created_at FROM form_responses WHERE design_id = $1 AND form_id = $2 ORDER BY created_at',
      [designId, formId],
    );
    return rows.map((r) => ({ id: r.id, formId: r.form_id, values: r.data, at: r.created_at.toISOString() }));
  }
  async close() {
    await this.pool.end();
  }
}

export async function createRepo(opts: { databaseUrl?: string; dataDir: string }): Promise<Repo> {
  if (opts.databaseUrl) return new PgRepo(opts.databaseUrl).init();
  return new FileRepo(opts.dataDir).init();
}
