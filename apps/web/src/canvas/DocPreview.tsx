import { Layer, Rect, Stage } from 'react-konva';
import type { Page } from '@trazo/shared';
import { ElementNode, type ElementHandlers } from './ElementNode';
import { useFontsVersion } from './fonts';

const noop: ElementHandlers = {
  onPointerDown() {},
  onDblClick() {},
  onDragStart() {},
  onDragMove() {},
  onDragEnd() {},
  onTransformEnd() {},
};

/** Vista previa estática de una página (plantillas, miniaturas sin servidor). */
export function DocPreview({ page, width, height, size }: { page: Page; width: number; height: number; size: number }) {
  const scale = size / Math.max(width, height);
  // Al cargar una fuente se vuelve a montar la capa para medir y dibujar con ella.
  const fonts = useFontsVersion();
  return (
    <Stage width={width * scale} height={height * scale} scaleX={scale} scaleY={scale} listening={false}>
      <Layer listening={false} key={fonts}>
        <Rect width={width} height={height} fill={page.background} />
        {page.elements.map((el) => (
          <ElementNode key={el.id} el={{ ...el, locked: true, animation: undefined }} readOnly {...noop} />
        ))}
      </Layer>
    </Stage>
  );
}
