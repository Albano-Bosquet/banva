import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TextElement } from '@trazo/shared';
import { useEditor } from '../store/editorStore';

/**
 * Edición de texto en el lugar: un <textarea> superpuesto con la misma
 * tipografía y transformación que el nodo de Konva (que se oculta mientras tanto).
 */
export function TextEditorOverlay({ el, zoom }: { el: TextElement; zoom: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(el.text);
  const committed = useRef(false);

  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.focus();
    ta.select();
  }, []);

  useLayoutEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = '0px';
    ta.style.height = `${ta.scrollHeight}px`;
  }, [value, zoom, el.fontSize, el.width]);

  const finish = (save: boolean) => {
    if (committed.current) return;
    committed.current = true;
    const st = useEditor.getState();
    if (save && value !== el.text) st.updateElements([el.id], { text: value }, { label: 'Editar texto' });
    st.setEditingText(null);
  };

  const [bold, italic] = [el.fontStyle.includes('bold'), el.fontStyle.includes('italic')];

  return (
    <textarea
      ref={ref}
      className="text-editor"
      data-testid="text-editor"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') finish(true);
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) finish(true);
      }}
      style={{
        left: el.x * zoom,
        top: el.y * zoom,
        width: el.width,
        transform: `scale(${zoom}) rotate(${el.rotation}deg)`,
        fontFamily: el.fontFamily,
        fontSize: el.fontSize,
        fontWeight: bold ? 700 : 400,
        fontStyle: italic ? 'italic' : 'normal',
        textDecoration: el.textDecoration || 'none',
        color: el.fill,
        textAlign: el.align,
        lineHeight: el.lineHeight,
        letterSpacing: el.letterSpacing,
        opacity: el.opacity,
      }}
    />
  );
}
