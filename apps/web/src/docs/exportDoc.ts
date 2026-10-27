import type { Block } from '@trazo/shared';
import { sanitizeHtml, textOf } from './sanitize';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const FONT = "font-family:Inter,Arial,Helvetica,sans-serif;color:#1f2430;";
const STYLE: Record<string, string> = {
  h1: 'font-size:32px;line-height:1.2;font-weight:700;margin:24px 0 12px;',
  h2: 'font-size:24px;line-height:1.25;font-weight:700;margin:20px 0 10px;',
  h3: 'font-size:19px;line-height:1.3;font-weight:700;margin:16px 0 8px;',
  p: 'font-size:15px;line-height:1.6;margin:0 0 10px;',
  quote: 'font-size:17px;line-height:1.6;margin:12px 0;padding-left:14px;border-left:4px solid #c9cede;font-style:italic;',
};

/** Bloques → html. `email` usa tablas y estilos en línea, que es lo que entienden los clientes de correo. */
export function blocksToHtml(blocks: Block[], email = false): string {
  const out: string[] = [];
  // La lista de control es una lista aparte (sin viñetas), aunque también sea <ul>.
  let list: 'ul' | 'ol' | 'check' | null = null;
  const closeList = () => {
    if (list) out.push(list === 'ol' ? '</ol>' : '</ul>');
    list = null;
  };
  for (const b of blocks) {
    const html = sanitizeHtml(b.html ?? '');
    const align = b.align ? `text-align:${b.align};` : '';
    const listKind = b.type === 'bullet' ? 'ul' : b.type === 'check' ? 'check' : b.type === 'number' ? 'ol' : null;
    if (listKind !== list) {
      closeList();
      if (listKind) {
        out.push(`<${listKind === 'ol' ? 'ol' : 'ul'} style="${FONT}font-size:15px;line-height:1.6;margin:0 0 10px;${listKind === 'check' ? 'list-style:none;padding-left:4px;' : ''}">`);
        list = listKind;
      }
    }
    switch (b.type) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'p':
        out.push(`<${b.type === 'p' ? 'p' : b.type} style="${FONT}${STYLE[b.type]}${align}">${html || '&nbsp;'}</${b.type === 'p' ? 'p' : b.type}>`);
        break;
      case 'quote':
        out.push(`<blockquote style="${FONT}${STYLE.quote}${align}">${html}</blockquote>`);
        break;
      case 'callout':
        out.push(`<div style="${FONT}font-size:15px;line-height:1.6;background:${esc(b.color ?? '#fff4d6')};border-radius:8px;padding:12px 16px;margin:10px 0;${align}">${html}</div>`);
        break;
      case 'bullet':
      case 'number':
        out.push(`<li style="${align}">${html}</li>`);
        break;
      case 'check':
        out.push(`<li style="${align}">${b.checked ? '☑' : '☐'} ${b.checked ? `<s>${html}</s>` : html}</li>`);
        break;
      case 'divider':
        out.push('<hr style="border:none;border-top:1px solid #d7dbe4;margin:18px 0;">');
        break;
      case 'pagebreak':
        out.push(email ? '' : '<div style="page-break-after:always;break-after:page;"></div>');
        break;
      case 'table':
        out.push(
          `<table role="presentation" cellpadding="8" cellspacing="0" style="${FONT}border-collapse:collapse;width:100%;font-size:14px;margin:10px 0;">` +
            (b.rows ?? []).map((r, ri) => `<tr>${r.map((c) => `<td style="border:1px solid #d7dbe4;${ri === 0 ? 'font-weight:700;background:#f5f6fa;' : ''}">${sanitizeHtml(c) || '&nbsp;'}</td>`).join('')}</tr>`).join('') +
            '</table>',
        );
        break;
      case 'columns':
        out.push(
          `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:10px 0;"><tr>` +
            (b.cols ?? []).map((c) => `<td valign="top" style="${FONT}font-size:15px;line-height:1.6;padding:0 8px;width:${Math.floor(100 / (b.cols?.length || 1))}%;">${sanitizeHtml(c)}</td>`).join('') +
            '</tr></table>',
        );
        break;
      case 'image':
        if (b.src) out.push(`<p style="margin:10px 0;${align}"><img src="${esc(absolute(b.src))}" alt="" style="max-width:100%;height:auto;border:0;display:block;"></p>`);
        break;
      case 'button': {
        const url = /^(https?:|mailto:)/i.test(b.url ?? '') ? b.url! : '#';
        out.push(
          `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px ${b.align === 'center' ? 'auto' : '0'};"><tr><td style="background:${esc(b.color ?? '#5b6cff')};border-radius:8px;"><a href="${esc(url)}" style="${FONT}display:inline-block;padding:12px 22px;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;">${html || 'Botón'}</a></td></tr></table>`,
        );
        break;
      }
      case 'chart': {
        const c = b.chart!;
        // En correos no hay gráficos: se exporta una tabla con los datos.
        out.push(
          `<table role="presentation" cellpadding="6" cellspacing="0" style="${FONT}font-size:14px;margin:10px 0;">` +
            c.labels.map((l, i) => `<tr><td>${esc(l)}</td><td><div style="background:${esc(c.color)};height:12px;width:${Math.round((Math.max(0, c.values[i] ?? 0) / Math.max(...c.values, 1)) * 200)}px;"></div></td><td>${c.values[i] ?? 0}</td></tr>`).join('') +
            '</table>',
        );
        break;
      }
    }
  }
  closeList();
  return out.join('\n');
}

/** Las imágenes subidas son rutas relativas; en un archivo o correo hacen falta absolutas. */
function absolute(src: string) {
  try {
    return new URL(src, location.origin).href;
  } catch {
    return src;
  }
}

export function standaloneHtml(title: string, blocks: Block[], width: number, email: boolean): string {
  const body = blocksToHtml(blocks, email);
  if (email) {
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f2f3f7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f3f7;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="${width}" cellpadding="0" cellspacing="0" style="width:100%;max-width:${width}px;background:#ffffff;border-radius:8px;"><tr><td style="padding:28px 32px;">
${body}
</td></tr></table>
</td></tr></table>
</body></html>`;
  }
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{margin:0;background:#f2f3f7}main{max-width:${width}px;margin:24px auto;background:#fff;padding:56px 64px;box-sizing:border-box}@media print{body{background:#fff}main{margin:0;padding:0;max-width:none}}</style></head>
<body><main>
${body}
</main></body></html>`;
}

/** Markdown simple (títulos, listas, citas, tablas y texto con negrita/cursiva). */
export function blocksToMarkdown(blocks: Block[]): string {
  const inline = (html: string) =>
    textOf(
      sanitizeHtml(html)
        .replace(/<b>(.*?)<\/b>/g, '**$1**')
        .replace(/<i>(.*?)<\/i>/g, '_$1_')
        .replace(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g, '[$2]($1)')
        .replace(/<br>/g, '\n'),
    );
  let n = 0;
  return blocks
    .map((b) => {
      n = b.type === 'number' ? n + 1 : 0;
      const t = inline(b.html ?? '');
      switch (b.type) {
        case 'h1':
          return `# ${t}`;
        case 'h2':
          return `## ${t}`;
        case 'h3':
          return `### ${t}`;
        case 'bullet':
          return `- ${t}`;
        case 'number':
          return `${n}. ${t}`;
        case 'check':
          return `- [${b.checked ? 'x' : ' '}] ${t}`;
        case 'quote':
        case 'callout':
          return `> ${t}`;
        case 'divider':
        case 'pagebreak':
          return '---';
        case 'table': {
          const rows = (b.rows ?? []).map((r) => `| ${r.map((c) => inline(c).replace(/\|/g, '\\|')).join(' | ')} |`);
          if (rows.length) rows.splice(1, 0, `|${(b.rows![0] ?? []).map(() => ' --- ').join('|')}|`);
          return rows.join('\n');
        }
        case 'image':
          return b.src ? `![](${absolute(b.src)})` : '';
        case 'button':
          return `[${t || 'Botón'}](${b.url ?? ''})`;
        case 'columns':
          return (b.cols ?? []).map(inline).join('\n\n');
        case 'chart':
          return b.chart!.labels.map((l, i) => `- ${l}: ${b.chart!.values[i] ?? 0}`).join('\n');
        default:
          return t;
      }
    })
    .join('\n\n');
}

export function download(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** PDF: se imprime una ventana con el documento (el navegador ofrece "Guardar como PDF"). */
export function printHtml(html: string) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const d = frame.contentDocument!;
  d.open();
  d.write(html);
  d.close();
  frame.onload = () => {
    frame.contentWindow!.focus();
    frame.contentWindow!.print();
    setTimeout(() => frame.remove(), 1000);
  };
}
