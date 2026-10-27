import { memo, useEffect, useRef } from 'react';
import KonvaLib from 'konva';
import { Arrow, Ellipse, Group, Image as KImage, Line, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { DesignElement, ImageElement, ShapeElement, TextElement } from '@trazo/shared';
import { useImage } from './useImage';
import { shapeDef } from '../elements/shapeLibrary';
import { ChartBody, DrawBody, FormBody, FrameBody, GraphicBody, GridBody, PathShape, SolidBody, StickyBody, TableBody, VideoBody } from './bodies';
import { useElementAnimation } from './animation';

export interface ElementHandlers {
  onPointerDown(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>, el: DesignElement): void;
  onDblClick(el: DesignElement, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void;
  onDragStart(e: Konva.KonvaEventObject<DragEvent>, el: DesignElement): void;
  onDragMove(e: Konva.KonvaEventObject<DragEvent>, el: DesignElement): void;
  onDragEnd(e: Konva.KonvaEventObject<DragEvent>, el: DesignElement): void;
  onTransformEnd(e: Konva.KonvaEventObject<Event>, el: DesignElement): void;
}

interface Props extends Partial<ElementHandlers> {
  el: DesignElement;
  editing?: boolean;
  pageId?: string;
  /** Solo lectura (presentación): sin arrastre ni eventos. */
  readOnly?: boolean;
  /** Retardo de la animación de entrada, para escalonar elementos. */
  delay?: number;
}

/**
 * Cada elemento es un Group en (x, y) con rotación; el contenido se dibuja en
 * coordenadas locales 0..width × 0..height. El Transformer escala el Group y al
 * terminar convertimos la escala en width/height. Adentro, el grupo "anim"
 * (centrado) es el que mueven las animaciones.
 */
export const ElementNode = memo(function ElementNode({ el, editing = false, pageId, readOnly = false, delay = 0, ...h }: Props) {
  const animRef = useRef<Konva.Group>(null);
  const anim = el.type === 'solid' && el.animation === 'spin' ? undefined : el.animation;
  useElementAnimation(animRef, anim, el.width, el.height, pageId, delay);
  if (!el.visible) return null;
  return (
    <Group
      id={readOnly ? undefined : el.id}
      name={readOnly ? undefined : 'element'}
      x={el.x}
      y={el.y}
      rotation={el.rotation}
      opacity={editing ? 0 : el.opacity}
      draggable={!readOnly && !el.locked && !editing}
      listening={!readOnly}
      onMouseDown={(e) => h.onPointerDown?.(e, el)}
      onTouchStart={(e) => h.onPointerDown?.(e, el)}
      onDblClick={(e) => h.onDblClick?.(el, e)}
      onDblTap={(e) => h.onDblClick?.(el, e)}
      onDragStart={(e) => h.onDragStart?.(e, el)}
      onDragMove={(e) => h.onDragMove?.(e, el)}
      onDragEnd={(e) => h.onDragEnd?.(e, el)}
      onTransformEnd={(e) => h.onTransformEnd?.(e, el)}
    >
      <Group ref={animRef} name="anim" box={{ w: el.width, h: el.height }} x={el.width / 2} y={el.height / 2} offsetX={el.width / 2} offsetY={el.height / 2}>
        <Body el={el} />
      </Group>
    </Group>
  );
});

function Body({ el }: { el: DesignElement }) {
  switch (el.type) {
    case 'text':
      return <TextBody el={el} />;
    case 'shape':
      return <ShapeBody el={el} />;
    case 'image':
      return <ImageBody el={el} />;
    case 'graphic':
      return <GraphicBody el={el} />;
    case 'chart':
      return <ChartBody el={el} />;
    case 'table':
      return <TableBody el={el} />;
    case 'frame':
      return <FrameBody el={el} />;
    case 'grid':
      return <GridBody el={el} />;
    case 'solid':
      return <SolidBody el={el} />;
    case 'video':
      return <VideoBody el={el} />;
    case 'form':
      return <FormBody el={el} />;
    case 'sticky':
      return <StickyBody el={el} />;
    case 'draw':
      return <DrawBody el={el} />;
  }
}

function TextBody({ el }: { el: TextElement }) {
  return (
    <Text
      name="text-body"
      width={el.width}
      text={el.text || ' '}
      fontFamily={el.fontFamily}
      fontSize={el.fontSize}
      fontStyle={el.fontStyle}
      textDecoration={el.textDecoration}
      fill={el.fill}
      align={el.align}
      lineHeight={el.lineHeight}
      letterSpacing={el.letterSpacing}
      wrap="word"
    />
  );
}

function ShapeBody({ el }: { el: ShapeElement }) {
  const common = { fill: el.fill, stroke: el.strokeWidth > 0 ? el.stroke : undefined, strokeWidth: el.strokeWidth, strokeScaleEnabled: false };
  const w = el.width;
  const hgt = el.height;
  const def = shapeDef(el.shape);
  switch (def.render) {
    case 'rect':
      return <Rect width={w} height={hgt} cornerRadius={Math.min(el.cornerRadius, w / 2, hgt / 2)} {...common} />;
    case 'ellipse':
      return <Ellipse x={w / 2} y={hgt / 2} radiusX={w / 2} radiusY={hgt / 2} {...common} />;
    case 'line':
      return <LineBody el={el} />;
    case 'path':
      return <PathShape path={def.path!} w={w} h={hgt} fill={el.fill} stroke={common.stroke} strokeWidth={el.strokeWidth} />;
  }
}

/** Líneas: sólidas, de guiones o puntos, con flecha opcional. El grosor sale del alto de la caja. */
function LineBody({ el }: { el: ShapeElement }) {
  const arrow = el.arrow ?? 'none';
  const dash = el.dash ?? 'solid';
  const t = arrow === 'none' ? el.height : el.height / 5;
  const y = el.height / 2;
  if (arrow === 'none' && dash === 'solid') return <Rect width={el.width} height={el.height} cornerRadius={el.height / 2} fill={el.fill} />;
  const dashArr = dash === 'dashed' ? [t * 3, t * 2] : dash === 'dotted' ? [0.001, t * 2] : undefined;
  const props = { points: [t / 2, y, el.width - t / 2, y], stroke: el.fill, strokeWidth: t, dash: dashArr, lineCap: dash === 'dotted' ? ('round' as const) : ('butt' as const) };
  return (
    <>
      <Rect width={el.width} height={el.height} fill="transparent" />
      {arrow === 'none' ? (
        <Line {...props} />
      ) : (
        <Arrow {...props} pointerLength={t * 2.2} pointerWidth={t * 4} pointerAtBeginning={arrow === 'both'} fill={el.fill} />
      )}
    </>
  );
}

function ImageBody({ el }: { el: ImageElement }) {
  const img = useImage(el.src);
  const ref = useRef<Konva.Image>(null);
  const f = el.filters;
  const active = !!f && (!!f.brightness || !!f.contrast || !!f.saturation || !!f.blur || !!f.grayscale || !!f.sepia || !!f.invert);

  // Los filtros de Konva trabajan sobre una copia en caché de la imagen.
  useEffect(() => {
    const node = ref.current;
    if (!node || !img) return;
    if (!active) {
      node.clearCache();
      node.filters([]);
      node.getLayer()?.batchDraw();
      return;
    }
    const list = [];
    if (f!.brightness) list.push(KonvaLib.Filters.Brighten);
    if (f!.contrast) list.push(KonvaLib.Filters.Contrast);
    if (f!.saturation) list.push(KonvaLib.Filters.HSL);
    if (f!.blur) list.push(KonvaLib.Filters.Blur);
    if (f!.grayscale) list.push(KonvaLib.Filters.Grayscale);
    if (f!.sepia) list.push(KonvaLib.Filters.Sepia);
    if (f!.invert) list.push(KonvaLib.Filters.Invert);
    // La caché a la resolución de la imagen (acotada) para que el filtro no pixele.
    const pr = Math.min(3, Math.max(1, img.naturalWidth / Math.max(1, el.width)));
    node.cache({ pixelRatio: pr });
    node.filters(list);
    node.brightness(f!.brightness ?? 0);
    node.contrast(f!.contrast ?? 0);
    node.saturation(f!.saturation ?? 0);
    node.blurRadius(f!.blur ?? 0);
    node.getLayer()?.batchDraw();
  }, [img, active, f?.brightness, f?.contrast, f?.saturation, f?.blur, f?.grayscale, f?.sepia, f?.invert, el.width, el.height, f]);

  if (!img) return <Rect width={el.width} height={el.height} fill="#e3e6ee" />;
  return (
    <KImage
      ref={ref}
      image={img}
      width={el.width}
      height={el.height}
      cornerRadius={el.cornerRadius}
      scaleX={f?.flipX ? -1 : 1}
      scaleY={f?.flipY ? -1 : 1}
      x={f?.flipX ? el.width : 0}
      y={f?.flipY ? el.height : 0}
    />
  );
}
