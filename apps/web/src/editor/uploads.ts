import { create } from 'zustand';
import { getBackend } from '../api/backend';

interface UploadsState {
  items: string[];
  busy: boolean;
  refresh(): Promise<void>;
  upload(file: Blob, name?: string): Promise<string>;
}

export type MediaKind = 'image' | 'video' | 'audio';

/** Tipo de un archivo subido según su extensión o su data URL. */
export function mediaKind(url: string): MediaKind {
  const m = /^data:(image|video|audio)\//.exec(url);
  if (m) return m[1] as MediaKind;
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  if (['mp4', 'webm', 'mov'].includes(ext)) return 'video';
  if (['mp3', 'ogg', 'wav', 'm4a', 'flac'].includes(ext)) return 'audio';
  return 'image';
}

export const useUploads = create<UploadsState>((set, get) => ({
  items: [],
  busy: false,
  async refresh() {
    const b = await getBackend();
    set({ items: await b.listUploads().catch(() => []) });
  },
  async upload(file, name) {
    set({ busy: true });
    try {
      const b = await getBackend();
      const url = await b.upload(file, name ?? (file instanceof File ? file.name : 'imagen'));
      set({ items: [url, ...get().items.filter((u) => u !== url)] });
      return url;
    } finally {
      set({ busy: false });
    }
  },
}));
