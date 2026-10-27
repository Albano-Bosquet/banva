import { useEffect, useRef, useState } from 'react';
import { useEditor } from '../store/editorStore';
import { blocksToMarkdown, download, printHtml, standaloneHtml } from '../docs/exportDoc';
import { Icon } from './icons';
import { sheetToCsv } from '../sheets/SheetEditor';

function safeName(title: string) {
  return title.replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 60) || 'documento';
}

/** Menú Descargar de documentos y correos. */
export function DocExportMenu({ toast }: { toast(msg: string): void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const doc = useEditor((s) => s.doc);
  const email = doc.kind === 'email';
  const name = safeName(doc.title);
  const html = () => standaloneHtml(doc.title, doc.blocks ?? [], doc.width, email);

  const actions: [string, string, () => void][] = email
    ? [
        ['HTML para correo', 'html', () => download(`${name}.html`, html(), 'text/html')],
        [
          'Copiar HTML',
          'copy',
          () =>
            navigator.clipboard.writeText(html()).then(
              () => toast('HTML copiado: pegalo en tu herramienta de envío'),
              () => toast('No se pudo copiar al portapapeles'),
            ),
        ],
        ['Vista previa en el navegador', 'preview', () => window.open(URL.createObjectURL(new Blob([html()], { type: 'text/html' })), '_blank')],
      ]
    : [
        ['PDF (imprimir)', 'pdf', () => printHtml(html())],
        ['Word (.doc)', 'doc', () => download(`${name}.doc`, html(), 'application/msword')],
        ['HTML', 'html', () => download(`${name}.html`, html(), 'text/html')],
        ['Markdown', 'md', () => download(`${name}.md`, blocksToMarkdown(doc.blocks ?? []), 'text/markdown')],
      ];

  return (
    <div className="popover-anchor" ref={ref}>
      <button className="primary" onClick={() => setOpen(!open)} data-testid="export-open">
        <Icon name="download" /> {email ? 'Exportar' : 'Descargar'}
      </button>
      {open && (
        <div className="popover" data-testid="export-menu">
          <h4>{email ? 'Exportar el correo' : 'Descargar el documento'}</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {actions.map(([label, id, fn]) => (
              <button
                key={id}
                data-testid={`doc-export-${id}`}
                onClick={() => {
                  fn();
                  setOpen(false);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {email && <p className="kbd">El HTML usa tablas y estilos en línea, compatibles con Gmail, Outlook y Mailchimp.</p>}
        </div>
      )}
    </div>
  );
}

/** Descargar de la hoja de cálculo: CSV con los valores calculados. */
export function SheetExportMenu() {
  const doc = useEditor((s) => s.doc);
  return (
    <button
      className="primary"
      data-testid="export-open"
      onClick={() => doc.sheet && download(`${safeName(doc.title)}.csv`, '\ufeff' + sheetToCsv(doc.sheet), 'text/csv')}
      title="Descargar como CSV (se abre en Excel, LibreOffice y Google Sheets)"
    >
      <Icon name="download" /> Descargar CSV
    </button>
  );
}
