/**
 * Saneador del html en línea de los bloques. El html viaja por la colaboración en
 * tiempo real, así que solo se conservan etiquetas de formato, enlaces http(s)/mailto
 * y estilos de color: todo lo demás se reduce a su texto.
 */
const INLINE = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'A', 'SPAN', 'BR', 'MARK', 'CODE', 'SUB', 'SUP']);
const RENAME: Record<string, string> = { STRONG: 'b', EM: 'i', STRIKE: 's', DEL: 's' };
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i;

export function sanitizeHtml(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const out = document.createElement('div');
  copyChildren(doc.body.firstChild as Element, out);
  return out.innerHTML.replace(/(<br>)+$/, (m) => (m === '<br>' ? '' : m));
}

function copyChildren(from: Node, to: HTMLElement) {
  for (const node of [...from.childNodes]) {
    if (node.nodeType === Node.TEXT_NODE) {
      to.appendChild(document.createTextNode(node.textContent ?? ''));
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as HTMLElement;
    // Bloques pegados (div, p, li…) se convierten en saltos de línea.
    if (!INLINE.has(el.tagName)) {
      if (to.lastChild && /^(DIV|P|LI|H\d|TR|BLOCKQUOTE)$/.test(el.tagName)) to.appendChild(document.createElement('br'));
      copyChildren(el, to);
      continue;
    }
    const tag = (RENAME[el.tagName] ?? el.tagName).toLowerCase();
    const clean = document.createElement(tag);
    if (tag === 'a') {
      const href = el.getAttribute('href') ?? '';
      if (/^(https?:|mailto:)/i.test(href.trim())) {
        clean.setAttribute('href', href.trim());
        clean.setAttribute('target', '_blank');
        clean.setAttribute('rel', 'noopener noreferrer');
      }
    }
    if (tag === 'span' || tag === 'mark') {
      const color = el.style.color;
      const bg = el.style.backgroundColor;
      if (color && COLOR.test(color.replace(/\s/g, ''))) clean.style.color = color;
      if (bg && COLOR.test(bg.replace(/\s/g, ''))) clean.style.backgroundColor = bg;
      const weight = el.style.fontWeight;
      if (weight === 'bold' || weight === '700') clean.style.fontWeight = '700';
      if (el.style.fontStyle === 'italic') clean.style.fontStyle = 'italic';
    }
    // También se respeta <font color> que genera execCommand('foreColor') en algunos navegadores.
    copyChildren(el, clean);
    to.appendChild(clean);
  }
}

/** html → texto plano (para contar palabras y para el esquema). */
export function textOf(html: string): string {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent ?? '';
}
