import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { createForm, createShape, type Design, type ServerMessage } from '@trazo/shared';
import { buildApp } from './app';
import { FileRepo } from './repo';

let dir: string;
let app: Awaited<ReturnType<typeof buildApp>>;
let base: string;

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const OV_ID = '0123abcd-0000-4000-8000-00000000beef';

/** Openverse simulado: búsqueda, detalle y descarga del archivo. */
const fakeFetch = (async (input: string | URL) => {
  const url = new URL(String(input));
  const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  if (url.pathname === '/v1/images/' && url.searchParams.get('q') === 'caido') return new Response('no', { status: 503 });
  if (url.host === 'commons.test') {
    const info = { url: 'https://cdn.test/flor.png', thumburl: 'https://cdn.test/flor.png', mime: 'image/png', extmetadata: { Artist: { value: '<a href="x">Beto</a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' }, ObjectName: { value: 'Lago' } } };
    return json({ query: { pages: [{ pageid: 42, title: 'File:Lago.png', imageinfo: [info] }] } });
  }
  if (url.pathname === '/v1/images/') {
    return json({ results: [{ id: OV_ID, title: 'Flor', url: 'https://cdn.test/flor.png', thumbnail: 'https://ov.test/thumb', creator: 'Ana', license: 'by', license_version: '4.0', provider: 'flickr' }] });
  }
  if (url.pathname === `/v1/images/${OV_ID}/`) {
    return json({ id: OV_ID, title: 'Flor', url: 'https://cdn.test/flor.png', creator: 'Ana', license: 'by', license_version: '4.0', provider: 'flickr' });
  }
  if (url.href === 'https://cdn.test/flor.png') return new Response(PNG, { headers: { 'content-type': 'image/png' } });
  return new Response('no', { status: 404 });
}) as typeof fetch;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'trazo-'));
  const repo = await new FileRepo(join(dir, 'data')).init();
  app = await buildApp({ repo, uploadsDir: join(dir, 'uploads'), media: { fetchImpl: fakeFetch, baseUrl: 'https://ov.test/v1', commonsUrl: 'https://commons.test/w/api.php' } });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const addr = app.server.address();
  base = typeof addr === 'object' && addr ? `127.0.0.1:${addr.port}` : '';
});

afterAll(async () => {
  await app.close();
  await rm(dir, { recursive: true, force: true });
});

async function createDesign(): Promise<Design> {
  const res = await app.inject({ method: 'POST', url: '/api/designs', payload: { width: 1080, height: 1080 } });
  expect(res.statusCode).toBe(201);
  return res.json();
}

describe('API de diseños', () => {
  it('health informa el almacenamiento', async () => {
    const res = await app.inject('/api/health');
    expect(res.json()).toEqual({ ok: true, storage: 'file' });
  });

  it('crea, lista, guarda, duplica y elimina', async () => {
    const d = await createDesign();
    expect(d.doc.pages).toHaveLength(1);

    const list = (await app.inject('/api/designs')).json();
    expect(list.some((x: { id: string }) => x.id === d.id)).toBe(true);

    const doc = { ...d.doc, title: 'Cambiado' };
    doc.pages[0].elements.push(createShape(doc, 'rect'));
    const save = await app.inject({ method: 'PUT', url: `/api/designs/${d.id}`, payload: { baseRevision: 0, doc } });
    expect(save.json().revision).toBe(1);

    const got = (await app.inject(`/api/designs/${d.id}`)).json();
    expect(got.doc.title).toBe('Cambiado');
    expect(got.doc.pages[0].elements).toHaveLength(1);

    const dup = await app.inject({ method: 'POST', url: `/api/designs/${d.id}/duplicate` });
    expect(dup.json().doc.title).toBe('Cambiado (copia)');

    expect((await app.inject({ method: 'DELETE', url: `/api/designs/${d.id}` })).statusCode).toBe(204);
    expect((await app.inject(`/api/designs/${d.id}`)).statusCode).toBe(404);
  });

  it('valida los cuerpos', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/designs', payload: { width: -1, height: 10 } })).statusCode).toBe(400);
    const d = await createDesign();
    const bad = await app.inject({ method: 'PUT', url: `/api/designs/${d.id}`, payload: { baseRevision: 0, doc: { title: 'x', width: 10, height: 10, pages: [] } } });
    expect(bad.statusCode).toBe(400);
  });

  it('guarda y sirve miniaturas', async () => {
    const d = await createDesign();
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    expect((await app.inject({ method: 'PUT', url: `/api/designs/${d.id}/thumbnail`, payload: { dataUrl: png } })).statusCode).toBe(204);
    const res = await app.inject(`/api/designs/${d.id}/thumbnail`);
    expect(res.headers['content-type']).toBe('image/png');
  });
});

describe('subidas', () => {
  const boundary = '----trazo';
  const multipart = (type: string, body: Buffer) =>
    Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a"\r\nContent-Type: ${type}\r\n\r\n`),
      body,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

  it('acepta imágenes y las sirve', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const res = await app.inject({ method: 'POST', url: '/api/uploads', payload: multipart('image/png', png), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } });
    expect(res.statusCode).toBe(201);
    const { url } = res.json();
    expect((await app.inject(url)).statusCode).toBe(200);
    expect((await app.inject('/api/uploads')).json()).toContainEqual({ url, kind: 'image' });
  });

  it('rechaza tipos no admitidos', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/uploads', payload: multipart('text/plain', Buffer.from('hola')), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } });
    expect(res.statusCode).toBe(415);
  });

  it('acepta video y audio e informa el tipo', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/uploads', payload: multipart('video/mp4', Buffer.from('0000')), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ kind: 'video' });
    expect(res.json().url).toMatch(/\.mp4$/);
    const audio = await app.inject({ method: 'POST', url: '/api/uploads', payload: multipart('audio/mpeg', Buffer.from('0000')), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } });
    expect(audio.json()).toMatchObject({ kind: 'audio' });
  });
});

describe('banco de medios (Openverse simulado)', () => {
  it('busca y devuelve resultados con licencia', async () => {
    const res = await app.inject('/api/media/search?type=image&q=flor');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([{ id: OV_ID, title: 'Flor', thumbnail: 'https://ov.test/thumb', creator: 'Ana', license: 'CC BY 4.0' }]);
    expect((await app.inject('/api/media/search?type=image&q=')).statusCode).toBe(400);
  });

  it('importa el recurso al almacenamiento propio con atribución', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/media/import', payload: { type: 'image', id: OV_ID } });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.url).toMatch(/^\/uploads\/.+\.png$/);
    expect(body.credit).toBe('"Flor" de Ana · CC BY 4.0 · flickr');
    const file = await app.inject(body.url);
    expect(file.rawPayload.equals(PNG)).toBe(true);
  });

  it('usa Wikimedia Commons si Openverse no responde, también al importar', async () => {
    const res = await app.inject('/api/media/search?type=image&q=caido');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([{ id: 'wc-42', title: 'Lago', thumbnail: 'https://cdn.test/flor.png', creator: 'Beto', license: 'CC BY-SA 4.0 · Wikimedia Commons' }]);
    const imp = await app.inject({ method: 'POST', url: '/api/media/import', payload: { type: 'image', id: 'wc-42' } });
    expect(imp.statusCode).toBe(201);
    expect(imp.json().credit).toBe('"Lago" de Beto · CC BY-SA 4.0 · Wikimedia Commons');
  });

  it('rechaza ids inválidos', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/media/import', payload: { type: 'image', id: '../../etc' } });
    expect(res.statusCode).toBe(502);
  });
});

describe('tipos de diseño', () => {
  it('crea documentos por tipo y los lista con su tipo', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/designs', payload: { kind: 'sheet', width: 1920, height: 1080 } });
    expect(res.statusCode).toBe(201);
    expect(res.json().doc).toMatchObject({ kind: 'sheet', sheet: { rows: 100, cols: 26 } });
    const doc = await app.inject({ method: 'POST', url: '/api/designs', payload: { kind: 'doc', width: 794, height: 1123 } });
    expect(doc.json().doc.blocks).toHaveLength(2);
    const list = (await app.inject('/api/designs')).json() as { id: string; kind?: string }[];
    expect(list.find((d) => d.id === res.json().id)?.kind).toBe('sheet');
  });

  it('rechaza un tipo desconocido', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/designs', payload: { kind: 'otro', width: 10, height: 10 } });
    expect(res.statusCode).toBe(400);
  });
});

describe('formularios', () => {
  it('guarda respuestas válidas y las lista', async () => {
    const d = await createDesign();
    const form = createForm(d.doc, 'contact');
    d.doc.pages[0].elements.push(form);
    await app.inject({ method: 'PUT', url: `/api/designs/${d.id}`, payload: { baseRevision: d.revision, doc: d.doc } });

    const url = `/api/designs/${d.id}/forms/${form.id}/responses`;
    const bad = await app.inject({ method: 'POST', url, payload: { values: { name: 'Ana' } } });
    expect(bad.statusCode).toBe(400);
    const ok = await app.inject({ method: 'POST', url, payload: { values: { name: 'Ana', email: 'ana@test.dev', msg: 'Hola', extra: 'ignorado' } } });
    expect(ok.statusCode).toBe(201);
    const list = (await app.inject(url)).json();
    expect(list).toHaveLength(1);
    expect(list[0].values).toEqual({ name: 'Ana', email: 'ana@test.dev', msg: 'Hola' });
  });

  it('responde 404 para formularios inexistentes', async () => {
    const d = await createDesign();
    const res = await app.inject({ method: 'POST', url: `/api/designs/${d.id}/forms/nada/responses`, payload: { values: {} } });
    expect(res.statusCode).toBe(404);
  });
});

describe('colaboración por WebSocket', () => {
  function connect(designId: string, clientId: string) {
    const ws = new WebSocket(`ws://${base}/ws`);
    const inbox: ServerMessage[] = [];
    const waiters: [(m: ServerMessage) => boolean, (m: ServerMessage) => void][] = [];
    ws.on('message', (raw) => {
      const m = JSON.parse(String(raw)) as ServerMessage;
      inbox.push(m);
      for (const w of [...waiters]) if (w[0](m)) (waiters.splice(waiters.indexOf(w), 1), w[1](m));
    });
    const next = <T extends ServerMessage['type']>(type: T) =>
      new Promise<Extract<ServerMessage, { type: T }>>((resolve, reject) => {
        const hit = inbox.find((m) => m.type === type);
        if (hit) return (inbox.splice(inbox.indexOf(hit), 1), resolve(hit as never));
        waiters.push([(m) => m.type === type, (m) => (inbox.splice(inbox.indexOf(m), 1), resolve(m as never))]);
        setTimeout(() => reject(new Error(`timeout esperando ${type}`)), 3000);
      });
    const ready = new Promise<void>((r) => ws.on('open', () => r())).then(() => ws.send(JSON.stringify({ type: 'join', designId, clientId })));
    return { ws, next, ready };
  }

  it('retransmite parches, confirma revisiones y persiste', async () => {
    const d = await createDesign();
    const a = connect(d.id, 'a');
    const b = connect(d.id, 'b');
    await Promise.all([a.ready, b.ready]);
    const wa = await a.next('welcome');
    await b.next('welcome');
    expect(wa.revision).toBe(0);

    const rect = createShape(d.doc, 'rect');
    a.ws.send(JSON.stringify({ type: 'patch', baseRevision: 0, opId: 'op1', patches: [{ op: 'add', path: ['pages', 0, 'elements', 0], value: rect }] }));
    const ack = await a.next('ack');
    expect(ack).toMatchObject({ opId: 'op1', revision: 1 });
    const remote = await b.next('patch');
    expect(remote.clientId).toBe('a');
    expect(remote.patches[0].value).toMatchObject({ id: rect.id });

    // El GET refleja el estado vivo de la sala.
    const live = (await app.inject(`/api/designs/${d.id}`)).json();
    expect(live.revision).toBe(1);
    expect(live.doc.pages[0].elements[0].id).toBe(rect.id);

    a.ws.close();
    b.ws.close();
    await new Promise((r) => setTimeout(r, 600));
    const stored = (await app.inject(`/api/designs/${d.id}`)).json();
    expect(stored.doc.pages[0].elements).toHaveLength(1);
    expect(stored.revision).toBe(1);
  });

  it('pide resincronizar si un parche no aplica', async () => {
    const d = await createDesign();
    const a = connect(d.id, 'a');
    await a.ready;
    await a.next('welcome');
    a.ws.send(JSON.stringify({ type: 'patch', baseRevision: 0, opId: 'x', patches: [{ op: 'replace', path: ['pages', 5, 'title'], value: 'no existe' }] }));
    const r = await a.next('resync');
    expect(r.revision).toBe(0);
    a.ws.close();
  });

  it('rechaza diseños inexistentes', async () => {
    const a = connect('nope', 'a');
    await a.ready;
    const code = await new Promise<number>((r) => a.ws.on('close', (c) => r(c)));
    expect(code).toBe(4404);
  });
});
