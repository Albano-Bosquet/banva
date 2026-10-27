import type { CreateDesignBody, Design, DesignDoc, DesignSummary, FormResponse, MediaResult } from '@trazo/shared';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.body && !(init.body instanceof FormData) ? { 'content-type': 'application/json', ...init.headers } : init?.headers,
  });
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  health: () => request<{ ok: boolean; storage: string }>('/api/health'),
  listDesigns: () => request<DesignSummary[]>('/api/designs'),
  getDesign: (id: string) => request<Design>(`/api/designs/${id}`),
  createDesign: (body: CreateDesignBody) => request<Design>('/api/designs', { method: 'POST', body: JSON.stringify(body) }),
  saveDesign: (id: string, baseRevision: number, doc: DesignDoc) =>
    request<{ revision: number; updatedAt: string }>(`/api/designs/${id}`, { method: 'PUT', body: JSON.stringify({ baseRevision, doc }) }),
  deleteDesign: (id: string) => request<void>(`/api/designs/${id}`, { method: 'DELETE' }),
  duplicateDesign: (id: string) => request<Design>(`/api/designs/${id}/duplicate`, { method: 'POST' }),
  saveThumbnail: (id: string, dataUrl: string) => request<void>(`/api/designs/${id}/thumbnail`, { method: 'PUT', body: JSON.stringify({ dataUrl }) }),
  upload: async (file: Blob, name = 'imagen') => {
    const fd = new FormData();
    fd.append('file', file, name);
    return request<{ url: string }>('/api/uploads', { method: 'POST', body: fd });
  },
  listUploads: () => request<{ url: string }[]>('/api/uploads'),
  searchMedia: (type: 'image' | 'audio', q: string) => request<MediaResult[]>(`/api/media/search?type=${type}&q=${encodeURIComponent(q)}`),
  importMedia: (type: 'image' | 'audio', id: string) =>
    request<{ url: string; title: string; credit: string }>('/api/media/import', { method: 'POST', body: JSON.stringify({ type, id }) }),
  submitResponse: (designId: string, formId: string, values: FormResponse['values']) =>
    request<FormResponse>(`/api/designs/${designId}/forms/${formId}/responses`, { method: 'POST', body: JSON.stringify({ values }) }),
  listResponses: (designId: string, formId: string) => request<FormResponse[]>(`/api/designs/${designId}/forms/${formId}/responses`),
};
