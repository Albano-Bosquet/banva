import { PDFDocument } from 'pdf-lib';
import type { DesignDoc } from '@trazo/shared';
import { renderPage } from '../canvas/stageRegistry';

export type ExportFormat = 'png' | 'jpg' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  scale: number;
  pageIds: string[];
  transparent: boolean;
  quality: number;
}

export interface ExportedFile {
  name: string;
  blob: Blob;
}

function dataUrlToBytes(url: string): Uint8Array {
  const b64 = url.slice(url.indexOf(',') + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function safeName(title: string) {
  return title.replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 60) || 'diseño';
}

/**
 * Exporta en el cliente: PNG/JPG por página (un archivo por página) y PDF con
 * una hoja por página del mismo tamaño que el diseño (1 px = 1 pt × escala).
 */
export async function exportDesign(doc: DesignDoc, opts: ExportOptions): Promise<ExportedFile[]> {
  const base = safeName(doc.title);
  const pages = doc.pages.filter((p) => opts.pageIds.includes(p.id));
  if (!pages.length) throw new Error('No hay páginas seleccionadas');

  if (opts.format === 'pdf') {
    const pdf = await PDFDocument.create();
    pdf.setTitle(doc.title);
    pdf.setCreator('Banva');
    for (const page of pages) {
      // PNG sin pérdida para que textos y bordes queden nítidos.
      const url = renderPage(page.id, { scale: Math.max(2, opts.scale), mime: 'image/png' });
      if (!url) throw new Error('La página no está renderizada');
      const img = await pdf.embedPng(dataUrlToBytes(url));
      const sheet = pdf.addPage([doc.width * opts.scale, doc.height * opts.scale]);
      sheet.drawImage(img, { x: 0, y: 0, width: sheet.getWidth(), height: sheet.getHeight() });
    }
    const bytes = await pdf.save();
    return [{ name: `${base}.pdf`, blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }) }];
  }

  const mime = opts.format === 'png' ? 'image/png' : 'image/jpeg';
  return pages.map((page) => {
    const index = doc.pages.indexOf(page) + 1;
    const url = renderPage(page.id, { scale: opts.scale, mime, quality: opts.quality, transparent: opts.format === 'png' && opts.transparent });
    if (!url) throw new Error('La página no está renderizada');
    const suffix = pages.length > 1 ? `-${index}` : '';
    return { name: `${base}${suffix}.${opts.format}`, blob: new Blob([dataUrlToBytes(url) as BlobPart], { type: mime }) };
  });
}

export function downloadFiles(files: ExportedFile[]) {
  for (const f of files) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(f.blob);
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
}
