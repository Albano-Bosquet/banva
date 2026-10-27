import { useEffect, useRef, useState } from 'react';
import type { StickyElement } from '@trazo/shared';
import { useEditor } from '../store/editorStore';

/** Edición del texto de una nota adhesiva: un textarea con el color de la nota. */
export function StickyEditorOverlay({ el, zoom }: { el: StickyElement; zoom: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(el.text);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    const st = useEditor.getState();
    if (value !== el.text) st.updateElements([el.id], { text: value }, { label: 'Editar nota' });
    st.setEditingText(null);
  };
  return (
    <textarea
      ref={ref}
      className="sticky-editor"
      data-testid="sticky-editor"
      value={value}
      placeholder="Agregar texto"
      onChange={(e) => setValue(e.target.value)}
      onBlur={finish}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) finish();
      }}
      style={{
        left: el.x * zoom,
        top: el.y * zoom,
        width: el.width,
        height: el.height,
        transform: `scale(${zoom}) rotate(${el.rotation}deg)`,
        background: el.color,
        fontSize: el.fontSize,
        padding: el.fontSize,
      }}
    />
  );
}
