import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import { randomBytes } from 'node:crypto';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createDesignBodySchema, createDocOfKind, formResponseBodySchema, saveDesignBodySchema, type FormResponse } from '@trazo/shared';
import type { Repo } from './repo';
import { CollabHub } from './collab';
import { MediaSource, type MediaOptions, type MediaType } from './media';

export interface AppOptions {
  repo: Repo;
  uploadsDir: string;
  /** Carpeta del build del frontend para servirlo en producción (opcional). */
  webDist?: string;
  logger?: boolean;
  /** Banco de medios (Openverse); inyectable para pruebas. */
  media?: MediaOptions;
}

const UPLOAD_TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/ogg': '.ogg',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/flac': '.flac',
};
const KIND_BY_EXT: Record<string, 'image' | 'video' | 'audio'> = Object.fromEntries(
  Object.entries(UPLOAD_TYPES).map(([mime, ext]) => [ext, mime.split('/')[0] as 'image' | 'video' | 'audio']),
);
const MAX_UPLOAD = 100 * 1024 * 1024;
const uploadName = (ext: string) => `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}${ext}`;

const newDesignId = () => `D${randomBytes(6).toString('base64url')}`;

export async function buildApp(opts: AppOptions) {
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 20 * 1024 * 1024 });
  const { repo } = opts;
  const hub = new CollabHub(repo);
  const media = new MediaSource(opts.media);
  const uploadsDir = resolve(opts.uploadsDir);
  await mkdir(uploadsDir, { recursive: true });

  await app.register(cors, { origin: true });
  await app.register(multipart, { limits: { fileSize: MAX_UPLOAD, files: 1 } });
  await app.register(websocket);
  await app.register(fastifyStatic, { root: uploadsDir, prefix: '/uploads/', decorateReply: false, maxAge: '1y', immutable: true });
  if (opts.webDist) await app.register(fastifyStatic, { root: resolve(opts.webDist), prefix: '/', decorateReply: false });

  app.get('/api/health', async () => ({ ok: true, storage: repo.kind }));

  app.get('/api/designs', async () => repo.list());

  app.post('/api/designs', async (req, reply) => {
    const body = createDesignBodySchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues });
    const design = await repo.create(newDesignId(), body.data.doc ?? createDocOfKind(body.data.kind ?? 'design', body.data.width, body.data.height, body.data.title));
    return reply.code(201).send(design);
  });

  app.get<{ Params: { id: string } }>('/api/designs/:id', async (req, reply) => {
    const design = await repo.get(req.params.id);
    if (!design) return reply.code(404).send({ error: 'not_found' });
    // Si hay una sala abierta, su estado es el más reciente.
    const live = hub.roomState(design.id);
    return live ? { ...design, doc: live.doc, revision: live.revision } : design;
  });

  // Guardado completo (snapshot). Se usa cuando el canal WebSocket no está disponible.
  app.put<{ Params: { id: string } }>('/api/designs/:id', async (req, reply) => {
    const body = saveDesignBodySchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues });
    const live = hub.roomState(req.params.id);
    const result = await repo.save(req.params.id, body.data.doc, live ? live.revision + 1 : undefined);
    if (!result) return reply.code(404).send({ error: 'not_found' });
    await hub.externalUpdate(req.params.id, body.data.doc, result.revision);
    return result;
  });

  app.delete<{ Params: { id: string } }>('/api/designs/:id', async (req, reply) => {
    const ok = await repo.remove(req.params.id);
    return reply.code(ok ? 204 : 404).send();
  });

  app.post<{ Params: { id: string } }>('/api/designs/:id/duplicate', async (req, reply) => {
    const src = await repo.get(req.params.id);
    if (!src) return reply.code(404).send({ error: 'not_found' });
    const doc = { ...structuredClone(hub.roomState(src.id)?.doc ?? src.doc) };
    doc.title = `${doc.title} (copia)`;
    return reply.code(201).send(await repo.create(newDesignId(), doc));
  });

  app.put<{ Params: { id: string }; Body: { dataUrl?: string } }>('/api/designs/:id/thumbnail', async (req, reply) => {
    const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(req.body?.dataUrl ?? '');
    if (!m) return reply.code(400).send({ error: 'dataUrl inválido' });
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 2 * 1024 * 1024) return reply.code(413).send();
    await repo.setThumbnail(req.params.id, buf);
    return reply.code(204).send();
  });

  app.get<{ Params: { id: string } }>('/api/designs/:id/thumbnail', async (req, reply) => {
    const img = await repo.getThumbnail(req.params.id);
    if (!img) return reply.code(404).send();
    const isPng = img[0] === 0x89 && img[1] === 0x50;
    return reply.type(isPng ? 'image/png' : 'image/jpeg').header('cache-control', 'no-cache').send(img);
  });

  app.post('/api/uploads', async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: 'falta el archivo' });
    const ext = UPLOAD_TYPES[file.mimetype];
    if (!ext) return reply.code(415).send({ error: `tipo no admitido: ${file.mimetype}` });
    const buf = await file.toBuffer();
    if (file.file.truncated) return reply.code(413).send({ error: 'archivo demasiado grande' });
    const name = uploadName(ext);
    await writeFile(join(uploadsDir, name), buf);
    return reply.code(201).send({ url: `/uploads/${name}`, kind: KIND_BY_EXT[ext] });
  });

  app.get('/api/uploads', async () => {
    const names = (await readdir(uploadsDir)).filter((n) => KIND_BY_EXT[extname(n)]);
    const withTime = await Promise.all(names.map(async (n) => ({ n, t: (await stat(join(uploadsDir, n))).mtimeMs })));
    return withTime
      .sort((a, b) => b.t - a.t)
      .slice(0, 200)
      .map(({ n }) => ({ url: `/uploads/${n}`, kind: KIND_BY_EXT[extname(n)] }));
  });

  // Banco de medios abierto (Openverse): búsqueda e importación al almacenamiento propio.
  app.get<{ Querystring: { type?: string; q?: string; page?: string } }>('/api/media/search', async (req, reply) => {
    const type = req.query.type === 'audio' ? 'audio' : 'image';
    const q = (req.query.q ?? '').trim().slice(0, 100);
    if (!q) return reply.code(400).send({ error: 'falta la búsqueda' });
    try {
      return await media.search(type, q, Math.max(1, Math.min(20, Number(req.query.page) || 1)));
    } catch (e) {
      return reply.code(502).send({ error: (e as Error).message });
    }
  });

  app.post<{ Body: { type?: MediaType; id?: string } }>('/api/media/import', async (req, reply) => {
    const type = req.body?.type === 'audio' ? 'audio' : 'image';
    const id = String(req.body?.id ?? '');
    try {
      const asset = await media.fetchAsset(type, id);
      const ext = UPLOAD_TYPES[asset.mime] ?? (type === 'image' ? '.jpg' : '.mp3');
      const name = uploadName(ext);
      await writeFile(join(uploadsDir, name), asset.bytes);
      return reply.code(201).send({ url: `/uploads/${name}`, title: asset.title, credit: asset.credit });
    } catch (e) {
      return reply.code(502).send({ error: (e as Error).message });
    }
  });

  // Formularios: respuestas enviadas desde la presentación del diseño.
  const findForm = async (designId: string, formId: string) => {
    const doc = hub.roomState(designId)?.doc ?? (await repo.get(designId))?.doc;
    return doc?.pages.flatMap((p) => p.elements).find((e) => e.id === formId && e.type === 'form') ?? null;
  };

  app.post<{ Params: { id: string; formId: string } }>('/api/designs/:id/forms/:formId/responses', async (req, reply) => {
    const form = await findForm(req.params.id, req.params.formId);
    if (!form || form.type !== 'form') return reply.code(404).send({ error: 'not_found' });
    const body = formResponseBodySchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues });
    // Solo se guardan los campos que existen en el formulario, con un tope de tamaño.
    const values: FormResponse['values'] = {};
    for (const f of form.fields) {
      const v = body.data.values[f.id];
      if (v === undefined || v === '') {
        if (f.required) return reply.code(400).send({ error: `falta "${f.label}"` });
        continue;
      }
      values[f.id] = typeof v === 'string' ? v.slice(0, 2000) : v;
    }
    const response: FormResponse = { id: randomBytes(8).toString('hex'), formId: form.id, at: new Date().toISOString(), values };
    await repo.addResponse(req.params.id, response);
    return reply.code(201).send(response);
  });

  app.get<{ Params: { id: string; formId: string } }>('/api/designs/:id/forms/:formId/responses', async (req) => {
    return repo.listResponses(req.params.id, req.params.formId);
  });

  app.get('/ws', { websocket: true }, (socket) => hub.handle(socket));

  app.addHook('onClose', async () => {
    await hub.flushAll();
  });

  return app;
}
