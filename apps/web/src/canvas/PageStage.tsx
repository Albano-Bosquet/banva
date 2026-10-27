import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Group, Layer, Line, Rect, Shape, Stage, Text, Transformer } from 'react-konva';
import Konva from 'konva';
import { newId, type DesignElement, type Page } from '@trazo/shared';
import { useEditor } from '../store/editorStore';
import { computeSnap, elementBounds, intersects, type Box, type Guide } from '../lib/geometry';
import { ElementNode, type ElementHandlers } from './ElementNode';
import { stageRegistry } from './stageRegistry';
import { TextEditorOverlay } from './TextEditorOverlay';
import { TableCellEditor, cellAt, useCellEdit } from './TableCellEditor';
import { addAdjacentSticky, placeTool, useWbTool } from '../whiteboard/tools';
import { StickyEditorOverlay } from '../whiteboard/StickyEditor';

const SNAP_PX = 6; // umbral en píxeles de pantalla

interface Props {
  page: Page;
  width: number;
  height: number;
  zoom: number;
  active: boolean;
  fontsVersion: number;
}

export function PageStage({ page, width, height, zoom, active, fontsVersion }: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const selectedIds = useEditor((s) => (s.activePageId === page.id ? s.selectedIds : EMPTY));
  const editingTextId = useEditor((s) => s.editingTextId);
  const whiteboard = useEditor((s) => s.doc.kind === 'whiteboard');
  const tool = useWbTool((s) => s.tool);
  const [stroke, setStroke] = useState<number[] | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [marquee, setMarquee] = useState<Box | null>(null);
  const dragStart = useRef<{ id: string; origin: Map<string, { x: number; y: number }> } | null>(null);
  const marqueeStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stageRegistry.set(page.id, stage);
    return () => {
      if (stageRegistry.get(page.id) === stage) stageRegistry.delete(page.id);
    };
  }, [page.id]);

  const selectedEls = useMemo(() => page.elements.filter((e) => selectedIds.includes(e.id)), [page.elements, selectedIds]);
  const singleText = selectedEls.length === 1 && selectedEls[0].type === 'text';
  const anyLocked = selectedEls.some((e) => e.locked);

  // Conecta el Transformer a los nodos seleccionados.
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const nodes = selectedIds
      .filter((id) => id !== editingTextId)
      .map((id) => stage.findOne(`#${id}`))
      .filter((n): n is Konva.Node => !!n);
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, editingTextId, page.elements, fontsVersion]);

  const toDesign = (stage: Konva.Stage) => {
    const p = stage.getPointerPosition() ?? { x: 0, y: 0 };
    return { x: p.x / zoom, y: p.y / zoom };
  };

  const handlers: ElementHandlers = useMemo(
    () => ({
      onPointerDown(e, el) {
        e.cancelBubble = true;
        const st = useEditor.getState();
        const additive = 'shiftKey' in e.evt && (e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
        if (additive) st.select([el.id], true);
        else if (!st.selectedIds.includes(el.id) || st.activePageId !== page.id) st.select([el.id]);
      },
      onDblClick(el, e) {
        if (el.locked) return;
        if (el.type === 'text' || el.type === 'sticky') useEditor.getState().setEditingText(el.id);
        if (el.type === 'table') {
          const p = (e.currentTarget as Konva.Group).getRelativePointerPosition();
          if (!p) return;
          const { row, col } = cellAt(el, p.x, p.y);
          useEditor.getState().select([el.id]);
          useCellEdit.getState().edit(el.id, row, col);
        }
      },
      onDragStart(e, el) {
        const st = useEditor.getState();
        if (!st.selectedIds.includes(el.id)) st.select([el.id]);
        const ids = useEditor.getState().selectedIds;
        const origin = new Map<string, { x: number; y: number }>();
        for (const id of ids) {
          const other = page.elements.find((x) => x.id === id);
          if (other && !other.locked) origin.set(id, { x: other.x, y: other.y });
        }
        dragStart.current = { id: el.id, origin };
        if (!origin.has(el.id)) e.target.stopDrag();
      },
      onDragMove(e, el) {
        const node = e.target;
        const start = dragStart.current;
        if (!start) return;
        const o = start.origin.get(el.id) ?? { x: el.x, y: el.y };
        let dx = node.x() - o.x;
        let dy = node.y() - o.y;
        // Guías magnéticas: se ajusta la caja del grupo arrastrado contra la página y el resto.
        const moving = selectedBounds(page.elements, start.origin, dx, dy);
        const others = page.elements.filter((x) => !start.origin.has(x.id) && x.visible).map(elementBounds);
        const snap = moving ? computeSnap(moving, others, { width: page_w(), height: page_h() }, SNAP_PX / zoom) : { dx: 0, dy: 0, guides: [] };
        dx += snap.dx;
        dy += snap.dy;
        node.position({ x: o.x + dx, y: o.y + dy });
        const stage = node.getStage();
        for (const [id, pos] of start.origin) {
          if (id === el.id) continue;
          stage?.findOne(`#${id}`)?.position({ x: pos.x + dx, y: pos.y + dy });
        }
        setGuides(snap.guides);
      },
      onDragEnd(e) {
        const start = dragStart.current;
        dragStart.current = null;
        setGuides([]);
        if (!start) return;
        const stage = e.target.getStage();
        const positions = new Map<string, { x: number; y: number }>();
        for (const id of start.origin.keys()) {
          const n = stage?.findOne(`#${id}`);
          if (n) positions.set(id, { x: n.x(), y: n.y() });
        }
        useEditor.getState().updateElements([...positions.keys()], (d) => {
          const p = positions.get(d.id)!;
          d.x = Math.round(p.x * 100) / 100;
          d.y = Math.round(p.y * 100) / 100;
        }, { label: 'Mover' });
      },
      onTransformEnd(e, el) {
        const node = e.target;
        const sx = node.scaleX();
        const sy = node.scaleY();
        node.scale({ x: 1, y: 1 });
        const anchor = trRef.current?.getActiveAnchor() ?? '';
        const cornerDrag = /top-left|top-right|bottom-left|bottom-right/.test(anchor);
        useEditor.getState().updateElements([el.id], (d) => {
          d.x = node.x();
          d.y = node.y();
          d.rotation = Math.round(node.rotation() * 100) / 100;
          d.width = Math.max(4, d.width * sx);
          if (d.type === 'text') {
            // Esquinas escalan la tipografía; los laterales solo cambian el ancho de ajuste.
            if (cornerDrag) d.fontSize = Math.max(4, Math.round(d.fontSize * sy * 10) / 10);
          } else {
            d.height = Math.max(4, d.height * sy);
          }
        }, { label: 'Transformar' });
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page.id, page.elements, zoom],
  );

  // Acceso a medidas del documento sin re-crear handlers en cada render.
  const docSize = useRef({ width, height });
  docSize.current = { width, height };
  function page_w() {
    return docSize.current.width;
  }
  function page_h() {
    return docSize.current.height;
  }

  const onStageDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      const st = useEditor.getState();
      if (st.activePageId !== page.id) st.setActivePage(page.id);
      const target = e.target;
      // Pizarra: la herramienta elegida coloca un elemento o empieza un trazo.
      const wb = useWbTool.getState();
      if (st.doc.kind === 'whiteboard' && wb.tool !== 'select') {
        const p = toDesign(target.getStage()!);
        if (wb.tool === 'draw') {
          setStroke([p.x, p.y]);
          return;
        }
        // Sin esto el navegador le devuelve el foco al lienzo y cierra el editor de texto recién abierto.
        e.evt.preventDefault();
        st.clearSelection();
        placeTool(wb.tool, p.x, p.y);
        wb.set({ tool: 'select' });
        return;
      }
      // Solo el fondo inicia la selección por recuadro.
      if (target !== target.getStage() && !target.hasName('page-bg')) return;
      st.clearSelection();
      const p = toDesign(target.getStage()!);
      marqueeStart.current = p;
      setMarquee({ x: p.x, y: p.y, width: 0, height: 0 });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page.id, zoom],
  );

  const onStageMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (stroke) {
        const p = toDesign(e.target.getStage()!);
        setStroke((pts) => (pts ? [...pts, p.x, p.y] : pts));
        return;
      }
      const s = marqueeStart.current;
      if (!s) return;
      const p = toDesign(e.target.getStage()!);
      setMarquee({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), width: Math.abs(p.x - s.x), height: Math.abs(p.y - s.y) });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zoom, stroke],
  );

  const onStageUp = useCallback(() => {
    if (stroke) {
      finishStroke(stroke);
      setStroke(null);
      return;
    }
    const box = marquee;
    marqueeStart.current = null;
    setMarquee(null);
    if (!box || box.width < 3 || box.height < 3) return;
    const ids = page.elements.filter((el) => el.visible && !el.locked && intersects(elementBounds(el), box)).map((el) => el.id);
    if (ids.length) useEditor.getState().select(ids);
  }, [marquee, page.elements, stroke]);

  const editingEl = page.elements.find((e) => e.id === editingTextId && e.type === 'text');
  const editingSticky = page.elements.find((e): e is Extract<typeof e, { type: 'sticky' }> => e.id === editingTextId && e.type === 'sticky');

  return (
    <div className={`page-canvas${active ? ' active' : ''}${whiteboard && tool !== 'select' ? ' tool-' + tool : ''}`} style={{ width: width * zoom, height: height * zoom }} data-testid="page-canvas" data-page-id={page.id}>
      <Stage
        ref={stageRef}
        width={width * zoom}
        height={height * zoom}
        scaleX={zoom}
        scaleY={zoom}
        onMouseDown={onStageDown}
        onTouchStart={onStageDown}
        onMouseMove={onStageMove}
        onTouchMove={onStageMove}
        onMouseUp={onStageUp}
        onTouchEnd={onStageUp}
      >
        <Layer key={fontsVersion}>
          <Rect name="page-bg" x={0} y={0} width={width} height={height} fill={page.background} />
          {whiteboard && <Shape listening={false} sceneFunc={(ctx) => drawDots(ctx, width, height)} />}
          {page.elements.map((el) => (
            <ElementNode key={el.id} el={el} pageId={page.id} editing={el.id === editingTextId} {...handlers} />
          ))}
        </Layer>
        <Layer name="ui">
          {guides.map((g, i) =>
            g.orientation === 'V' ? (
              <Line key={i} points={[g.pos, 0, g.pos, height]} stroke="#ff3d8b" strokeWidth={1 / zoom} dash={[4 / zoom, 4 / zoom]} listening={false} />
            ) : (
              <Line key={i} points={[0, g.pos, width, g.pos]} stroke="#ff3d8b" strokeWidth={1 / zoom} dash={[4 / zoom, 4 / zoom]} listening={false} />
            ),
          )}
          {stroke && <Line points={stroke} stroke={useWbTool.getState().penColor} strokeWidth={useWbTool.getState().penWidth} lineCap="round" lineJoin="round" tension={0.4} listening={false} />}
          {whiteboard && selectedEls.length === 1 && selectedEls[0].type === 'sticky' && !editingTextId && <StickyPlus el={selectedEls[0]} zoom={zoom} />}
          {marquee && <Rect {...marquee} fill="rgba(61,90,254,0.08)" stroke="#3d5afe" strokeWidth={1 / zoom} listening={false} />}
          <Transformer
            ref={trRef}
            rotateEnabled={!anyLocked}
            resizeEnabled={!anyLocked}
            enabledAnchors={singleText ? ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right'] : undefined}
            keepRatio={singleText}
            rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
            rotationSnapTolerance={4}
            anchorSize={9}
            anchorCornerRadius={5}
            anchorStroke="#3d5afe"
            anchorStrokeWidth={1.5}
            borderStroke={anyLocked ? "#8a93a6" : "#3d5afe"}
            borderStrokeWidth={1.5}
            rotateAnchorOffset={24}
            ignoreStroke
            flipEnabled={false}
            boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 6 || Math.abs(newBox.height) < 6 ? oldBox : newBox)}
          />
        </Layer>
      </Stage>
      {editingEl && editingEl.type === 'text' && <TextEditorOverlay el={editingEl} zoom={zoom} />}
      {editingSticky && <StickyEditorOverlay el={editingSticky} zoom={zoom} />}
      {page.elements.map((el) => el.type === 'table' && <TableCellEditor key={el.id} el={el} zoom={zoom} />)}
    </div>
  );
}

const EMPTY: string[] = [];

function selectedBounds(elements: DesignElement[], origin: Map<string, { x: number; y: number }>, dx: number, dy: number): Box | null {
  const boxes = elements.filter((e) => origin.has(e.id)).map((e) => {
    const o = origin.get(e.id)!;
    return elementBounds({ ...e, x: o.x + dx, y: o.y + dy });
  });
  if (!boxes.length) return null;
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  return { x: minX, y: minY, width: Math.max(...boxes.map((b) => b.x + b.width)) - minX, height: Math.max(...boxes.map((b) => b.y + b.height)) - minY };
}

/** Fondo de puntos de la pizarra (cada 32 px). */
function drawDots(ctx: Konva.Context, w: number, h: number) {
  const c = (ctx as unknown as { _context: CanvasRenderingContext2D })._context;
  c.fillStyle = '#c9cede';
  for (let x = 16; x < w; x += 32) for (let y = 16; y < h; y += 32) c.fillRect(x - 1, y - 1, 2, 2);
}

/** Convierte el trazo en un elemento con caja propia y puntos relativos. */
function finishStroke(points: number[]) {
  if (points.length < 4) return;
  const { penColor, penWidth } = useWbTool.getState();
  const xs = points.filter((_, i) => i % 2 === 0);
  const ys = points.filter((_, i) => i % 2 === 1);
  const pad = penWidth / 2;
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  useEditor.getState().addElement({
    id: newId(),
    type: 'draw',
    x,
    y,
    width: Math.max(1, Math.max(...xs) - x + pad),
    height: Math.max(1, Math.max(...ys) - y + pad),
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    points: points.map((v, i) => Math.round((v - (i % 2 === 0 ? x : y)) * 10) / 10),
    stroke: penColor,
    strokeWidth: penWidth,
  });
  useEditor.getState().clearSelection();
}

/** Los cuatro "+" de una nota seleccionada: cada uno crea una nota contigua. */
function StickyPlus({ el, zoom }: { el: Extract<DesignElement, { type: 'sticky' }>; zoom: number }) {
  const r = 11 / zoom;
  // Separados del tirador de rotación, que está arriba de la caja.
  const off = 38 / zoom;
  const spots = [
    ['top', el.x + el.width / 2, el.y - off],
    ['right', el.x + el.width + off, el.y + el.height / 2],
    ['bottom', el.x + el.width / 2, el.y + el.height + off],
    ['left', el.x - off, el.y + el.height / 2],
  ] as const;
  return (
    <>
      {spots.map(([dir, x, y]) => (
        <Group key={dir} x={x} y={y} name={`sticky-plus-${dir}`} onMouseDown={(e) => (e.cancelBubble = true)} onClick={() => addAdjacentSticky(el, dir)} onTap={() => addAdjacentSticky(el, dir)}>
          <Circle radius={r} fill="#ffffff" stroke="#c9cede" strokeWidth={1 / zoom} shadowColor="rgba(0,0,0,0.15)" shadowBlur={4 / zoom} />
          <Text text="+" fontSize={16 / zoom} fill="#4a5263" width={r * 2} height={r * 2} offsetX={r} offsetY={r} align="center" verticalAlign="middle" listening={false} />
        </Group>
      ))}
    </>
  );
}
