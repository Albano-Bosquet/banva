import { createDocOfKind, type CreateDesignBody, type Design, type DesignDoc, type DesignSummary, type FormResponse, type MediaResult } from '@trazo/shared';
import { api } from './client';

/**
 * Fuente de diseños. "remote" usa la API (Fastify + PostgreSQL/archivos) con
 * colaboración por WebSocket; "local" guarda en localStorage cuando la API no está disponible.
 */
export interface Backend {
  kind: 'remote' | 'local';
  list(): Promise<DesignSummary[]>;
  get(id: string): Promise<Design>;
  create(body: CreateDesignBody): Promise<Design>;
  save(id: string, baseRevision: number, doc: DesignDoc): Promise<{ revision: number }>;
  remove(id: string): Promise<void>;
  duplicate(id: string): Promise<Design>;
  saveThumbnail(id: string, dataUrl: string): Promise<void>;
  thumbnailUrl(id: string, updatedAt: string): string | null;
  upload(file: Blob, name?: string): Promise<string>;
  listUploads(): Promise<string[]>;
  /** Banco de medios abierto (requiere la API: el servidor descarga y guarda el archivo). */
  searchMedia(type: 'image' | 'audio', q: string): Promise<MediaResult[]>;
  importMedia(type: 'image' | 'audio', id: string): Promise<{ url: string; title: string; credit: string }>;
  submitResponse(designId: string, formId: string, values: FormResponse['values']): Promise<FormResponse>;
  listResponses(designId: string, formId: string): Promise<FormResponse[]>;
}

const remote: Backend = {
  kind: 'remote',
  list: () => api.listDesigns(),
  get: (id) => api.getDesign(id),
  create: (b) => api.createDesign(b),
  save: (id, rev, doc) => api.saveDesign(id, rev, doc),
  remove: (id) => api.deleteDesign(id),
  duplicate: (id) => api.duplicateDesign(id),
  saveThumbnail: (id, url) => api.saveThumbnail(id, url),
  thumbnailUrl: (id, updatedAt) => `/api/designs/${id}/thumbnail?v=${encodeURIComponent(updatedAt)}`,
  upload: async (file, name) => (await api.upload(file, name)).url,
  listUploads: async () => (await api.listUploads()).map((u) => u.url),
  searchMedia: (type, q) => api.searchMedia(type, q),
  importMedia: (type, id) => api.importMedia(type, id),
  submitResponse: (d, f, v) => api.submitResponse(d, f, v),
  listResponses: (d, f) => api.listResponses(d, f),
};

const OFFLINE_MEDIA = 'El banco de fotos y audio necesita el servidor de Banva en ejecución.';

const KEY = 'trazo:designs';
const THUMBS = 'trazo:thumbs';
const UPLOADS = 'trazo:uploads';
const RESPONSES = 'trazo:responses';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Cuota llena: el editor sigue funcionando en memoria.
  }
}

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });

const local: Backend = {
  kind: 'local',
  async list() {
    const all = readJson<Record<string, Design>>(KEY, {});
    return Object.values(all)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((d) => ({ id: d.id, title: d.doc.title, kind: d.doc.kind, width: d.doc.width, height: d.doc.height, pageCount: d.doc.pages.length, updatedAt: d.updatedAt }));
  },
  async get(id) {
    const d = readJson<Record<string, Design>>(KEY, {})[id];
    if (!d) throw new Error('Diseño no encontrado');
    return d;
  },
  async create(body) {
    const now = new Date().toISOString();
    const d: Design = { id: `l${Date.now().toString(36)}`, revision: 0, createdAt: now, updatedAt: now, doc: body.doc ?? createDocOfKind(body.kind ?? 'design', body.width, body.height, body.title) };
    writeJson(KEY, { ...readJson(KEY, {}), [d.id]: d });
    return d;
  },
  async save(id, _rev, doc) {
    const all = readJson<Record<string, Design>>(KEY, {});
    const prev = all[id];
    const d: Design = { ...(prev ?? { id, createdAt: new Date().toISOString() }), revision: (prev?.revision ?? 0) + 1, updatedAt: new Date().toISOString(), doc };
    writeJson(KEY, { ...all, [id]: d });
    return { revision: d.revision };
  },
  async remove(id) {
    const all = readJson<Record<string, Design>>(KEY, {});
    delete all[id];
    writeJson(KEY, all);
  },
  async duplicate(id) {
    const src = await local.get(id);
    const copy = await local.create({ width: src.doc.width, height: src.doc.height });
    await local.save(copy.id, 0, { ...structuredClone(src.doc), title: `${src.doc.title} (copia)` });
    return local.get(copy.id);
  },
  async saveThumbnail(id, url) {
    writeJson(THUMBS, { ...readJson(THUMBS, {}), [id]: url });
  },
  thumbnailUrl(id) {
    return readJson<Record<string, string>>(THUMBS, {})[id] ?? null;
  },
  async upload(file) {
    const url = await blobToDataUrl(file);
    writeJson(UPLOADS, [url, ...readJson<string[]>(UPLOADS, [])].slice(0, 30));
    return url;
  },
  async listUploads() {
    return readJson<string[]>(UPLOADS, []);
  },
  async searchMedia() {
    throw new Error(OFFLINE_MEDIA);
  },
  async importMedia() {
    throw new Error(OFFLINE_MEDIA);
  },
  async submitResponse(designId, formId, values) {
    const r: FormResponse = { id: `r${Date.now().toString(36)}`, formId, at: new Date().toISOString(), values };
    const all = readJson<Record<string, FormResponse[]>>(RESPONSES, {});
    writeJson(RESPONSES, { ...all, [designId]: [...(all[designId] ?? []), r] });
    return r;
  },
  async listResponses(designId, formId) {
    return (readJson<Record<string, FormResponse[]>>(RESPONSES, {})[designId] ?? []).filter((r) => r.formId === formId);
  },
};

let chosen: Promise<Backend> | null = null;
/** Detecta la API una sola vez; sin API se trabaja en modo local. */
export function getBackend(): Promise<Backend> {
  chosen ??= api
    .health()
    .then(() => remote)
    .catch(() => local);
  return chosen;
}
