import type { MediaResult } from '@trazo/shared';

/**
 * Banco de medios abierto: búsqueda en Openverse (Creative Commons) con Wikimedia
 * Commons como respaldo, e importación al almacenamiento propio. El servidor hace de
 * intermediario para que los archivos queden en el mismo origen (exportables sin
 * "canvas contaminado") y para guardar la atribución junto al recurso.
 */
export type MediaType = 'image' | 'audio';

export interface MediaOptions {
  fetchImpl?: typeof fetch;
  /** Base de la API de Openverse. */
  baseUrl?: string;
  /** Base de la API de Wikimedia Commons (respaldo). */
  commonsUrl?: string;
}

interface OpenverseItem {
  id: string;
  title?: string | null;
  url: string;
  thumbnail?: string | null;
  creator?: string | null;
  license: string;
  license_version?: string | null;
  provider?: string | null;
  duration?: number | null;
}

interface CommonsPage {
  pageid: number;
  title: string;
  imageinfo?: {
    url: string;
    thumburl?: string;
    mime: string;
    duration?: number;
    extmetadata?: Record<string, { value?: string }>;
  }[];
}

type Asset = { bytes: Buffer; mime: string; title: string; credit: string };

const MAX_IMPORT = 30 * 1024 * 1024;
/** Wikimedia pide identificar el cliente en el User-Agent. */
const UA = 'Banva/0.1 (editor de diseño; uso de prueba)';
/** Prefijo de los ids que vienen de Wikimedia Commons. */
const WC = 'wc-';

export class MediaSource {
  private fetch: typeof fetch;
  private base: string;
  private commons: string;
  /** Las búsquedas se cachean una hora: Openverse limita los pedidos anónimos. */
  private cache = new Map<string, { at: number; results: MediaResult[] }>();
  /** Datos completos de cada resultado de Openverse ya visto: importar no repite el pedido de detalle. */
  private items = new Map<string, OpenverseItem>();

  constructor(opts: MediaOptions = {}) {
    this.fetch = opts.fetchImpl ?? fetch;
    this.base = (opts.baseUrl ?? 'https://api.openverse.org/v1').replace(/\/$/, '');
    this.commons = opts.commonsUrl ?? 'https://commons.wikimedia.org/w/api.php';
  }

  private endpoint(type: MediaType) {
    return `${this.base}/${type === 'image' ? 'images' : 'audio'}/`;
  }

  async search(type: MediaType, q: string, page = 1): Promise<MediaResult[]> {
    const key = `${type}:${q.toLowerCase()}:${page}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < 3600_000) return hit.results;
    let results: MediaResult[];
    try {
      results = await this.searchOpenverse(type, q, page);
    } catch (first) {
      // Openverse suele no responder cuando limita pedidos anónimos: se prueba Commons.
      try {
        results = await this.searchCommons(type, q, page);
      } catch {
        throw first;
      }
    }
    if (this.cache.size > 300) this.cache.clear();
    this.cache.set(key, { at: Date.now(), results });
    return results;
  }

  private async searchOpenverse(type: MediaType, q: string, page: number): Promise<MediaResult[]> {
    const url = new URL(this.endpoint(type));
    url.searchParams.set('q', q);
    url.searchParams.set('page', String(page));
    // Sin credenciales, Openverse admite como máximo 20 resultados por página.
    url.searchParams.set('page_size', '20');
    // Solo licencias que permiten uso comercial y modificación, para no limitar el diseño.
    url.searchParams.set('license_type', 'commercial,modification');
    if (type === 'image') url.searchParams.set('mature', 'false');
    let res: Response;
    try {
      res = await this.fetch(url, { signal: AbortSignal.timeout(5000), headers: { accept: 'application/json' } });
    } catch {
      throw new Error('El banco de medios no respondió a tiempo. Probá de nuevo en unos segundos.');
    }
    if (res.status === 429) throw new Error('El banco de medios limitó los pedidos por un rato. Probá de nuevo en unos minutos.');
    if (!res.ok) throw new Error(`búsqueda falló (${res.status})`);
    const body = (await res.json()) as { results?: OpenverseItem[] };
    if (this.items.size > 5000) this.items.clear();
    for (const r of body.results ?? []) this.items.set(r.id, r);
    return (body.results ?? []).map((r) => ({
      id: r.id,
      title: r.title || 'Sin título',
      thumbnail: r.thumbnail || (type === 'image' ? r.url : ''),
      creator: r.creator || 'Autor desconocido',
      license: formatLicense(r),
      duration: r.duration ?? undefined,
      preview: type === 'audio' ? r.url : undefined,
    }));
  }

  private commonsUrl(params: Record<string, string>) {
    const url = new URL(this.commons);
    for (const [k, v] of Object.entries({ action: 'query', format: 'json', formatversion: '2', origin: '*', ...params })) url.searchParams.set(k, v);
    return url;
  }

  private async commonsQuery(params: Record<string, string>): Promise<CommonsPage[]> {
    const res = await this.fetch(this.commonsUrl(params), { signal: AbortSignal.timeout(10000), headers: { accept: 'application/json', 'user-agent': UA } });
    if (!res.ok) throw new Error(`Commons respondió ${res.status}`);
    const body = (await res.json()) as { query?: { pages?: CommonsPage[] } };
    return body.query?.pages ?? [];
  }

  private async searchCommons(type: MediaType, q: string, page: number): Promise<MediaResult[]> {
    const pages = await this.commonsQuery({
      generator: 'search',
      gsrsearch: `filetype:${type === 'image' ? 'bitmap' : 'audio'} ${q}`,
      gsrnamespace: '6',
      gsrlimit: '20',
      gsroffset: String((page - 1) * 20),
      prop: 'imageinfo',
      iiprop: 'url|mime|extmetadata',
      iiurlwidth: '400',
      iiextmetadatafilter: 'Artist|LicenseShortName|ObjectName',
    });
    return pages
      .filter((p) => p.imageinfo?.[0]?.mime.startsWith(`${type}/`))
      .map((p) => {
        const info = p.imageinfo![0];
        return {
          id: `${WC}${p.pageid}`,
          title: commonsTitle(p),
          thumbnail: type === 'image' ? info.thumburl ?? info.url : '',
          creator: commonsArtist(info.extmetadata),
          license: `${info.extmetadata?.LicenseShortName?.value ?? 'Licencia libre'} · Wikimedia Commons`,
          preview: type === 'audio' ? info.url : undefined,
        };
      });
  }

  /** Descarga el recurso; devuelve los bytes, su tipo y la atribución. */
  async fetchAsset(type: MediaType, id: string): Promise<Asset> {
    if (id.startsWith(WC)) return this.fetchCommons(type, id.slice(WC.length));
    if (!/^[0-9a-f-]{8,64}$/i.test(id)) throw new Error('id inválido');
    let item = this.items.get(id);
    if (!item) {
      const res = await this.fetch(`${this.endpoint(type)}${id}/`, { signal: AbortSignal.timeout(15000), headers: { accept: 'application/json' } }).catch(() => {
        throw new Error('El banco de medios no respondió a tiempo. Probá de nuevo.');
      });
      if (!res.ok) throw new Error(`recurso no encontrado (${res.status})`);
      item = (await res.json()) as OpenverseItem;
    }
    const title = item.title || 'Sin título';
    const credit = `"${title}" de ${item.creator || 'autor desconocido'} · ${formatLicense(item)}${item.provider ? ` · ${item.provider}` : ''}`;
    return { ...(await this.download(type, item.url)), title, credit };
  }

  private async fetchCommons(type: MediaType, pageid: string): Promise<Asset> {
    if (!/^\d{1,12}$/.test(pageid)) throw new Error('id inválido');
    // Las fotos se importan escaladas (los originales de Commons pueden pesar decenas de MB).
    const [page] = await this.commonsQuery({ pageids: pageid, prop: 'imageinfo', iiprop: 'url|mime|extmetadata', iiextmetadatafilter: 'Artist|LicenseShortName|ObjectName', ...(type === 'image' ? { iiurlwidth: '2000' } : {}) });
    const info = page?.imageinfo?.[0];
    if (!info) throw new Error('recurso no encontrado');
    const title = commonsTitle(page);
    const credit = `"${title}" de ${commonsArtist(info.extmetadata)} · ${info.extmetadata?.LicenseShortName?.value ?? 'licencia libre'} · Wikimedia Commons`;
    return { ...(await this.download(type, type === 'image' ? info.thumburl ?? info.url : info.url)), title, credit };
  }

  private async download(type: MediaType, href: string): Promise<{ bytes: Buffer; mime: string }> {
    const src = new URL(href);
    if (src.protocol !== 'https:' && src.protocol !== 'http:') throw new Error('URL no admitida');
    const file = await this.fetch(src, { signal: AbortSignal.timeout(30000), redirect: 'follow', headers: { 'user-agent': UA } });
    if (!file.ok) throw new Error(`descarga falló (${file.status})`);
    const mime = (file.headers.get('content-type') ?? '').split(';')[0].trim();
    if (!mime.startsWith(`${type}/`) && !(type === 'audio' && mime === 'application/ogg')) throw new Error(`tipo inesperado: ${mime || 'desconocido'}`);
    const len = Number(file.headers.get('content-length') ?? 0);
    if (len > MAX_IMPORT) throw new Error('archivo demasiado grande');
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length > MAX_IMPORT) throw new Error('archivo demasiado grande');
    return { bytes, mime: mime === 'application/ogg' ? 'audio/ogg' : mime };
  }
}

function formatLicense(r: Pick<OpenverseItem, 'license' | 'license_version'>): string {
  const l = r.license.toLowerCase();
  if (l === 'cc0') return 'CC0';
  if (l === 'pdm') return 'Dominio público';
  return `CC ${l.toUpperCase()}${r.license_version ? ` ${r.license_version}` : ''}`;
}

/** Los metadatos de Commons vienen en HTML: se quedan solo con el texto. */
const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();

function commonsTitle(p: CommonsPage): string {
  const name = p.imageinfo?.[0]?.extmetadata?.ObjectName?.value;
  return stripHtml(name ?? '') || p.title.replace(/^File:/, '').replace(/\.[^.]+$/, '');
}

function commonsArtist(meta?: Record<string, { value?: string }>): string {
  return stripHtml(meta?.Artist?.value ?? '').slice(0, 80) || 'autor desconocido';
}
