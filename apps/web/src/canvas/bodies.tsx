import { useEffect, useMemo, useRef, useState } from 'react';
import { Arc, Circle, Group, Image as KImage, Line, Path, Rect, Shape, Star, Text, Wedge } from 'react-konva';
import Konva from 'konva';
import {
  CHART_COLORS,
  displayCells,
  formFieldUnits,
  type ChartElement,
  type FormElement,
  type FrameElement,
  type GraphicElement,
  type GridElement,
  type SolidElement,
  type TableElement,
  type VideoElement,
  type StickyElement,
  type DrawElement,
} from '@trazo/shared';
import { graphicDataUrl } from '../elements/graphicsLibrary';
import { DECORATIONS } from '../elements/mockups';
import { maskClip } from '../elements/shapeLibrary';
import { drawSolid } from '../elements/solids';
import { useImage } from './useImage';

/** Área transparente para que todo el rectángulo del elemento responda a clics. */
export function HitBox({ w, h }: { w: number; h: number }) {
  return <Rect width={w} height={h} fill="transparent" />;
}

// --------------------------------------------------------------------------- gráficos SVG

export function GraphicBody({ el }: { el: GraphicElement }) {
  const url = useMemo(() => graphicDataUrl(el.svg, el.colors), [el.svg, el.colors]);
  const img = useImage(url);
  return (
    <>
      <HitBox w={el.width} h={el.height} />
      {img && <KImage image={img} width={el.width} height={el.height} />}
    </>
  );
}

// --------------------------------------------------------------------------- imagen con recorte "cubrir"

interface FillProps {
  src: string | null;
  w: number;
  h: number;
  zoom: number;
  offsetX: number;
  offsetY: number;
}

/** Imagen que cubre la caja w×h (como object-fit: cover) con zoom y desplazamiento. */
export function CoverImage({ src, w, h, zoom, offsetX, offsetY }: FillProps) {
  const img = useImage(src ?? '');
  if (!src || !img) return <Placeholder w={w} h={h} />;
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const x = (-(dw - w) / 2) * (1 + offsetX);
  const y = (-(dh - h) / 2) * (1 + offsetY);
  return <KImage image={img} x={x} y={y} width={dw} height={dh} />;
}

/** Relleno de un marco vacío: paisaje simple que indica "soltá una imagen acá". */
function Placeholder({ w, h }: { w: number; h: number }) {
  const s = Math.min(w, h);
  return (
    <>
      <Rect width={w} height={h} fill="#dbe7f3" />
      <Circle x={w * 0.72} y={h * 0.32} radius={s * 0.08} fill="#ffffff" opacity={0.9} />
      <Line points={[0, h, w * 0.32, h * 0.55, w * 0.55, h * 0.8, w * 0.75, h * 0.62, w, h, 0, h]} closed fill="#9cc58a" />
      <Line points={[w * 0.2, h, w * 0.5, h * 0.7, w * 0.85, h, w * 0.2, h]} closed fill="#7fb06e" />
    </>
  );
}

// --------------------------------------------------------------------------- marcos y mockups

export function FrameBody({ el }: { el: FrameElement }) {
  const deco = DECORATIONS[el.decoration];
  const { w, h } = { w: el.width, h: el.height };
  const sx = deco.screen.x * w;
  const sy = deco.screen.y * h;
  const sw = deco.screen.w * w;
  const sh = deco.screen.h * h;
  const clip = el.decoration === 'none' ? maskClip(el.mask, w, h, el.cornerRadius) : maskClip('rect', sw, sh, deco.screen.r * w);
  return (
    <>
      <HitBox w={w} h={h} />
      {deco.under && <Shape listening={false} sceneFunc={(ctx) => deco.under!(native(ctx), w, h, el.tint)} />}
      <Group x={sx} y={sy} clipFunc={clip as never} listening={false}>
        <CoverImage src={el.src} w={sw} h={sh} zoom={el.zoom} offsetX={el.offsetX} offsetY={el.offsetY} />
      </Group>
      {deco.over && <Shape listening={false} sceneFunc={(ctx) => deco.over!(native(ctx), w, h, el.tint)} />}
    </>
  );
}

/** Contexto nativo de canvas (Konva ya aplicó la transformación del nodo). */
function native(ctx: Konva.Context): CanvasRenderingContext2D {
  return (ctx as unknown as { _context: CanvasRenderingContext2D })._context;
}

// --------------------------------------------------------------------------- cuadrículas

export function gridCellBoxes(el: GridElement) {
  const g = el.gap;
  return el.cells.map((c) => {
    // Medio gap entre celdas vecinas y gap completo contra el borde de la caja.
    const x0 = c.x * el.width + (c.x <= 0.0001 ? g : g / 2);
    const y0 = c.y * el.height + (c.y <= 0.0001 ? g : g / 2);
    const x1 = (c.x + c.w) * el.width - (c.x + c.w >= 0.9999 ? g : g / 2);
    const y1 = (c.y + c.h) * el.height - (c.y + c.h >= 0.9999 ? g : g / 2);
    return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
  });
}

export function GridBody({ el }: { el: GridElement }) {
  const boxes = gridCellBoxes(el);
  return (
    <>
      <HitBox w={el.width} h={el.height} />
      {el.cells.map((c, i) => {
        const b = boxes[i];
        return (
          <Group key={i} x={b.x} y={b.y} clipFunc={maskClip('rect', b.w, b.h, el.cornerRadius) as never} listening={false}>
            <CoverImage src={c.src} w={b.w} h={b.h} zoom={c.zoom} offsetX={c.offsetX} offsetY={c.offsetY} />
          </Group>
        );
      })}
    </>
  );
}

// --------------------------------------------------------------------------- 3D

export function SolidBody({ el }: { el: SolidElement }) {
  const ref = useRef<Konva.Shape>(null);
  const spin = useRef(0);
  // "Girar" en un objeto 3D lo rota sobre su eje vertical.
  useEffect(() => {
    const node = ref.current;
    if (el.animation !== 'spin' || !node) return;
    const anim = new Konva.Animation((frame) => {
      spin.current = ((frame?.time ?? 0) / 1000) * 60;
    }, node.getLayer());
    anim.start();
    return () => {
      anim.stop();
      spin.current = 0;
    };
  }, [el.animation]);
  return (
    <>
      <HitBox w={el.width} h={el.height} />
      <Shape ref={ref} name="solid" listening={false} sceneFunc={(ctx) => drawSolid(native(ctx), el.solid, el.color, el.yaw + spin.current, el.pitch, el.width, el.height)} />
    </>
  );
}

// --------------------------------------------------------------------------- video

/** Videos montados en el lienzo, para que la barra contextual pueda reproducirlos. */
export const videoRegistry = new Map<string, HTMLVideoElement>();

export function VideoBody({ el }: { el: VideoElement }) {
  const imgRef = useRef<Konva.Image>(null);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [paused, setPaused] = useState(true);

  useEffect(() => {
    const v = document.createElement('video');
    v.src = el.src;
    v.crossOrigin = 'anonymous';
    v.playsInline = true;
    v.preload = 'auto';
    v.onloadeddata = () => setVideo(v);
    videoRegistry.set(el.id, v);
    return () => {
      v.pause();
      v.removeAttribute('src');
      v.load();
      if (videoRegistry.get(el.id) === v) videoRegistry.delete(el.id);
    };
  }, [el.src, el.id]);

  useEffect(() => {
    if (!video) return;
    video.muted = el.muted;
    video.loop = el.loop;
  }, [video, el.muted, el.loop]);

  // El ícono de "play" se muestra solo mientras el video está en pausa.
  useEffect(() => {
    if (!video) return;
    const sync = () => setPaused(video.paused);
    sync();
    video.addEventListener('play', sync);
    video.addEventListener('pause', sync);
    video.addEventListener('ended', sync);
    return () => {
      video.removeEventListener('play', sync);
      video.removeEventListener('pause', sync);
      video.removeEventListener('ended', sync);
    };
  }, [video]);

  // Mientras el video avanza hay que redibujar la capa en cada cuadro.
  useEffect(() => {
    const node = imgRef.current;
    if (!video || !node) return;
    const anim = new Konva.Animation(() => !video.paused, node.getLayer());
    anim.start();
    return () => {
      anim.stop();
    };
  }, [video]);

  return (
    <>
      <HitBox w={el.width} h={el.height} />
      {video ? (
        <KImage ref={imgRef} image={video} width={el.width} height={el.height} cornerRadius={el.cornerRadius} />
      ) : (
        <Rect width={el.width} height={el.height} fill="#1f2430" cornerRadius={el.cornerRadius} />
      )}
      {video && paused && (
        <Group x={el.width / 2} y={el.height / 2} listening={false} opacity={0.85} name="video-badge">
          <Circle radius={Math.min(el.width, el.height) * 0.09} fill="rgba(0,0,0,0.55)" />
          <Line points={[-0.03, -0.045, 0.05, 0, -0.03, 0.045].map((p) => p * Math.min(el.width, el.height))} closed fill="#ffffff" />
        </Group>
      )}
    </>
  );
}

// --------------------------------------------------------------------------- tablas

export function TableBody({ el }: { el: TableElement }) {
  const display = useMemo(() => displayCells(el.cells), [el.cells]);
  const rows = el.cells.length;
  const rowH = el.height / rows;
  const xs = colOffsets(el);
  const pad = el.fontSize * 0.5;
  return (
    <>
      <HitBox w={el.width} h={el.height} />
      {el.cells.map((row, r) => {
        const header = el.headerRow && r === 0;
        const fill = header ? el.accent : el.banded && r % 2 === 0 ? el.bandFill : el.banded ? tintRow(el.bandFill) : 'transparent';
        return row.map((_, c) => (
          <Group key={`${r}:${c}`} x={xs[c]} y={r * rowH} listening={false}>
            {fill !== 'transparent' && <Rect width={xs[c + 1] - xs[c]} height={rowH} fill={fill} />}
            <Text
              width={xs[c + 1] - xs[c]}
              height={rowH}
              padding={pad}
              text={display[r][c]}
              fontFamily={el.fontFamily}
              fontSize={el.fontSize}
              fontStyle={header ? 'bold' : 'normal'}
              fill={header ? readableOn(el.accent) : el.textColor}
              align={isNumeric(display[r][c]) && !header ? 'right' : el.align}
              verticalAlign="middle"
              wrap="word"
              ellipsis
            />
          </Group>
        ));
      })}
      {el.borderWidth > 0 && (
        <>
          {xs.map((x, i) => (
            <Line key={`v${i}`} points={[x, 0, x, el.height]} stroke={el.borderColor} strokeWidth={el.borderWidth} listening={false} />
          ))}
          {Array.from({ length: rows + 1 }, (_, i) => (
            <Line key={`h${i}`} points={[0, i * rowH, el.width, i * rowH]} stroke={el.borderColor} strokeWidth={el.borderWidth} listening={false} />
          ))}
        </>
      )}
    </>
  );
}

export function colOffsets(el: TableElement): number[] {
  const total = el.colWidths.reduce((s, x) => s + x, 0) || 1;
  const xs = [0];
  for (const cw of el.colWidths) xs.push(xs[xs.length - 1] + (cw / total) * el.width);
  return xs;
}

const isNumeric = (s: string) => /^-?[\d.,]+%?$/.test(s.trim()) && /\d/.test(s);
/** Filas alternas: la banda clara y la siguiente aún más clara. */
const tintRow = (hex: string) => (hex.startsWith('#') ? `${hex}66` : hex);

export function readableOn(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.62 ? '#1f2430' : '#ffffff';
}

// --------------------------------------------------------------------------- gráficos de datos

/** Escala "redonda": paso de 1, 2, 2,5 o 5 × 10^k con unas 5 divisiones. */
export function niceScale(v: number): { max: number; step: number; ticks: number } {
  if (v <= 0) return { max: 1, step: 0.25, ticks: 4 };
  const raw = v / 5;
  const p = 10 ** Math.floor(Math.log10(raw));
  const n = raw / p;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  const ticks = Math.max(1, Math.ceil(v / step - 1e-9));
  return { max: step * ticks, step, ticks };
}

const fmt = (v: number) => (Math.round(v * 100) / 100).toLocaleString('es-AR');

export function ChartBody({ el }: { el: ChartElement }) {
  const w = el.width;
  const h = el.height;
  const fs = Math.max(9, Math.min(w, h) * 0.045);
  const pad = fs * 0.8;
  const round = el.chartType === 'pie' || el.chartType === 'donut';
  const legendItems = round ? el.labels.map((l, i) => ({ name: l, color: sliceColor(el, i) })) : el.series.map((s) => ({ name: s.name, color: s.color }));
  const titleH = el.title ? fs * 1.9 : 0;
  const legendH = el.showLegend ? fs * 2 : 0;
  const top = pad + titleH;
  const bottom = h - pad - legendH;
  const text = { fontFamily: el.fontFamily, fontSize: fs, fill: el.textColor, listening: false } as const;

  return (
    <>
      <HitBox w={w} h={h} />
      {el.title && <Text {...text} x={0} y={pad * 0.6} width={w} align="center" text={el.title} fontStyle="bold" fontSize={fs * 1.25} />}
      {round ? <PieChart el={el} x={0} y={top} w={w} h={bottom - top} fs={fs} /> : <AxisChart el={el} x={pad} y={top} w={w - pad * 2} h={bottom - top} fs={fs} />}
      {el.showLegend && <Legend items={legendItems} y={h - pad - fs * 1.3} w={w} fs={fs} el={el} />}
    </>
  );
}

function sliceColor(el: ChartElement, i: number) {
  return i === 0 ? el.series[0].color : CHART_COLORS[(CHART_COLORS.indexOf(el.series[0].color) + i + CHART_COLORS.length) % CHART_COLORS.length];
}

function Legend({ items, y, w, fs, el }: { items: { name: string; color: string }[]; y: number; w: number; fs: number; el: ChartElement }) {
  const itemW = items.map((it) => fs * 1.6 + it.name.length * fs * 0.58 + fs);
  const total = itemW.reduce((s, x) => s + x, 0);
  let x = Math.max(0, (w - total) / 2);
  return (
    <Group listening={false}>
      {items.map((it, i) => {
        const gx = x;
        x += itemW[i];
        return (
          <Group key={i} x={gx} y={y}>
            <Rect width={fs} height={fs} cornerRadius={fs * 0.2} fill={it.color} />
            <Text x={fs * 1.4} y={0} text={it.name} fontFamily={el.fontFamily} fontSize={fs} fill={el.textColor} />
          </Group>
        );
      })}
    </Group>
  );
}

interface AreaProps {
  el: ChartElement;
  x: number;
  y: number;
  w: number;
  h: number;
  fs: number;
}

function AxisChart({ el, x, y, w, h, fs }: AreaProps) {
  const n = el.labels.length || 1;
  const stacked = el.chartType === 'stacked';
  const horizontal = el.chartType === 'hbar';
  const totals = el.labels.map((_, i) => el.series.reduce((s, se) => s + Math.max(0, se.values[i] ?? 0), 0));
  const rawMax = stacked ? Math.max(...totals, 0) : Math.max(...el.series.flatMap((s) => s.values), 0);
  const { max, ticks } = niceScale(rawMax);
  const labelW = fs * (fmt(max).length * 0.62 + 0.8);
  const catLabelW = horizontal ? Math.min(w * 0.3, Math.max(...el.labels.map((l) => l.length), 1) * fs * 0.6 + fs * 0.6) : 0;
  const px = x + (horizontal ? catLabelW : labelW);
  const pw = w - (horizontal ? catLabelW : labelW);
  const ph = h - fs * (horizontal ? 1.6 : 1.8);
  const text = { fontFamily: el.fontFamily, fontSize: fs, fill: el.textColor, listening: false } as const;
  const nodes: React.ReactNode[] = [];

  // Grilla y valores del eje.
  for (let t = 0; t <= ticks; t++) {
    const v = (max / ticks) * t;
    if (horizontal) {
      const gx = px + (pw * t) / ticks;
      if (el.showGrid) nodes.push(<Line key={`g${t}`} points={[gx, y, gx, y + ph]} stroke="#d7dbe4" strokeWidth={1} listening={false} />);
      nodes.push(<Text key={`t${t}`} {...text} x={gx - fs * 2} y={y + ph + fs * 0.3} width={fs * 4} align="center" text={fmt(v)} wrap="none" />);
    } else {
      const gy = y + ph - (ph * t) / ticks;
      if (el.showGrid) nodes.push(<Line key={`g${t}`} points={[px, gy, px + pw, gy]} stroke="#d7dbe4" strokeWidth={1} listening={false} />);
      nodes.push(<Text key={`t${t}`} {...text} x={x} y={gy - fs / 2} width={labelW - fs * 0.5} align="right" text={fmt(v)} wrap="none" />);
    }
  }

  const band = (horizontal ? ph : pw) / n;
  el.labels.forEach((label, i) => {
    if (horizontal) nodes.push(<Text key={`l${i}`} {...text} x={x} y={y + band * i + band / 2 - fs / 2} width={catLabelW - fs * 0.4} align="right" text={label} ellipsis wrap="none" />);
    else nodes.push(<Text key={`l${i}`} {...text} x={px + band * i} y={y + ph + fs * 0.4} width={band} align="center" text={label} ellipsis wrap="none" />);
  });

  if (el.chartType === 'line' || el.chartType === 'area') {
    el.series.forEach((s, si) => {
      const pts = el.labels.flatMap((_, i) => [px + band * i + band / 2, y + ph - (ph * Math.max(0, s.values[i] ?? 0)) / max]);
      if (el.chartType === 'area') {
        nodes.push(<Line key={`a${si}`} points={[pts[0], y + ph, ...pts, pts[pts.length - 2], y + ph]} closed fill={s.color} opacity={0.35} listening={false} />);
      }
      nodes.push(<Line key={`s${si}`} points={pts} stroke={s.color} strokeWidth={Math.max(2, fs * 0.22)} lineJoin="round" lineCap="round" tension={0} listening={false} />);
      for (let i = 0; i < pts.length; i += 2) {
        nodes.push(<Circle key={`p${si}-${i}`} x={pts[i]} y={pts[i + 1]} radius={Math.max(2.5, fs * 0.28)} fill="#ffffff" stroke={s.color} strokeWidth={Math.max(1.5, fs * 0.15)} listening={false} />);
        if (el.showValues) nodes.push(<Text key={`v${si}-${i}`} {...text} x={pts[i] - fs * 2} y={pts[i + 1] - fs * 1.5} width={fs * 4} align="center" text={fmt(s.values[i / 2] ?? 0)} />);
      }
    });
    return <>{nodes}</>;
  }

  const inner = band * 0.72;
  el.labels.forEach((_, i) => {
    let acc = 0;
    el.series.forEach((s, si) => {
      const v = Math.max(0, s.values[i] ?? 0);
      const len = ((horizontal ? pw : ph) * v) / max;
      const thick = stacked ? inner : inner / el.series.length;
      const off = band * i + (band - inner) / 2 + (stacked ? 0 : thick * si);
      const r = Math.min(thick * 0.18, fs * 0.4);
      const props = horizontal
        ? { x: px + (stacked ? acc : 0), y: y + off, width: len, height: thick * 0.92, cornerRadius: stacked ? 0 : [0, r, r, 0] }
        : { x: px + off, y: y + ph - len - (stacked ? acc : 0), width: thick * 0.92, height: len, cornerRadius: stacked ? 0 : [r, r, 0, 0] };
      nodes.push(<Rect key={`b${i}-${si}`} {...props} fill={s.color} listening={false} />);
      if (el.showValues && v > 0) {
        nodes.push(
          horizontal ? (
            <Text key={`v${i}-${si}`} {...text} x={props.x + len + fs * 0.3} y={props.y + props.height / 2 - fs / 2} text={fmt(v)} />
          ) : (
            <Text key={`v${i}-${si}`} {...text} x={props.x - fs} y={props.y - fs * 1.3} width={props.width + fs * 2} align="center" text={fmt(v)} />
          ),
        );
      }
      acc += len;
    });
  });
  return <>{nodes}</>;
}

function PieChart({ el, y, w, h, fs }: AreaProps) {
  const values = el.labels.map((_, i) => Math.max(0, el.series[0].values[i] ?? 0));
  const total = values.reduce((s, v) => s + v, 0) || 1;
  const r = Math.max(4, Math.min(w, h) / 2 - fs * 0.5);
  const cx = w / 2;
  const cy = y + h / 2;
  const inner = el.chartType === 'donut' ? r * 0.58 : 0;
  let angle = -90;
  return (
    <Group listening={false}>
      {values.map((v, i) => {
        const sweep = (v / total) * 360;
        const start = angle;
        angle += sweep;
        const mid = ((start + sweep / 2) * Math.PI) / 180;
        const lr = inner ? (r + inner) / 2 : r * 0.62;
        return (
          <Group key={i}>
            {inner ? (
              <Arc x={cx} y={cy} innerRadius={inner} outerRadius={r} angle={sweep} rotation={start} fill={sliceColor(el, i)} stroke="#ffffff" strokeWidth={Math.max(1, r * 0.015)} />
            ) : (
              <Wedge x={cx} y={cy} radius={r} angle={sweep} rotation={start} fill={sliceColor(el, i)} stroke="#ffffff" strokeWidth={Math.max(1, r * 0.015)} />
            )}
            {el.showValues && sweep > 14 && (
              <Text x={cx + Math.cos(mid) * lr - fs * 2} y={cy + Math.sin(mid) * lr - fs / 2} width={fs * 4} align="center" text={`${Math.round((v / total) * 100)}%`} fontFamily={el.fontFamily} fontSize={fs} fontStyle="bold" fill={readableOn(sliceColor(el, i))} />
            )}
          </Group>
        );
      })}
    </Group>
  );
}

// --------------------------------------------------------------------------- formularios (vista estática en el editor)

export function FormBody({ el }: { el: FormElement }) {
  const u = el.width / 18;
  const fs = u * 0.78;
  const text = { fontFamily: el.fontFamily, fill: el.textColor, listening: false } as const;
  const muted = el.textColor === '#ffffff' ? 'rgba(255,255,255,0.18)' : '#ffffff';
  const border = el.textColor === '#ffffff' ? 'rgba(255,255,255,0.35)' : '#cfd4df';
  let y = u * 1.1;
  const nodes: React.ReactNode[] = [
    <Rect key="bg" width={el.width} height={el.height} fill={el.background} cornerRadius={u * 0.8} />,
    <Text key="title" {...text} x={u} y={y} width={el.width - 2 * u} text={el.title} fontSize={fs * 1.5} fontStyle="bold" />,
  ];
  y += u * 2.3;
  for (const f of el.fields) {
    const units = formFieldUnits(f);
    nodes.push(<Text key={`${f.id}-l`} {...text} x={u} y={y} text={f.label + (f.required ? ' *' : '')} fontSize={fs} opacity={0.85} />);
    if (f.kind === 'rating') {
      for (let i = 0; i < 5; i++) nodes.push(<Star key={`${f.id}-s${i}`} x={u * (1.8 + i * 1.9)} y={y + u * 2} numPoints={5} innerRadius={u * 0.35} outerRadius={u * 0.75} fill={el.accent} opacity={i < 4 ? 1 : 0.35} listening={false} />);
    } else if (f.kind === 'choice') {
      (f.options ?? []).forEach((opt, i) => {
        const oy = y + u * (1.5 + i * 1.7);
        nodes.push(<Circle key={`${f.id}-c${i}`} x={u * 1.5} y={oy + u * 0.55} radius={u * 0.45} stroke={el.accent} strokeWidth={u * 0.12} fill={i === 0 ? el.accent : undefined} listening={false} />);
        nodes.push(<Text key={`${f.id}-o${i}`} {...text} x={u * 2.4} y={oy + u * 0.55 - fs / 2} text={opt} fontSize={fs} />);
      });
    } else {
      const ih = (units - 1.6) * u;
      nodes.push(<Rect key={`${f.id}-i`} x={u} y={y + u * 1.25} width={el.width - 2 * u} height={ih} fill={muted} stroke={border} strokeWidth={u * 0.06} cornerRadius={u * 0.3} listening={false} />);
    }
    y += units * u;
  }
  y += u * 0.4;
  nodes.push(<Rect key="btn" x={u} y={y} width={el.width - 2 * u} height={u * 2.2} fill={el.accent} cornerRadius={u * 0.4} listening={false} />);
  nodes.push(<Text key="btn-t" x={u} y={y} width={el.width - 2 * u} height={u * 2.2} align="center" verticalAlign="middle" text={el.submitLabel} fontFamily={el.fontFamily} fontSize={fs} fontStyle="bold" fill={readableOn(el.accent)} listening={false} />);
  return <>{nodes}</>;
}

// --------------------------------------------------------------------------- formas de la biblioteca (trazados)

export function PathShape({ path, w, h, fill, stroke, strokeWidth }: { path: string; w: number; h: number; fill: string; stroke?: string; strokeWidth: number }) {
  return <Path data={path} scaleX={w / 100} scaleY={h / 100} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeScaleEnabled={false} />;
}

// --------------------------------------------------------------------------- pizarra

/** Nota adhesiva: papel de color con sombra suave, texto arriba y autor abajo (como la observada). */
export function StickyBody({ el }: { el: StickyElement }) {
  const pad = el.fontSize;
  return (
    <>
      <Rect width={el.width} height={el.height} fill={el.color} shadowColor="rgba(31,36,48,0.25)" shadowBlur={el.fontSize * 0.8} shadowOffsetY={el.fontSize * 0.3} />
      <Text name="text-body" x={pad} y={pad} width={el.width - pad * 2} height={el.height - pad * 3} text={el.text || ' '} fontFamily="Inter" fontSize={el.fontSize} fill="#1f2430" wrap="word" ellipsis listening={false} />
      {el.author && <Text x={pad} y={el.height - pad * 1.8} width={el.width - pad * 2} text={el.author} fontFamily="Inter" fontSize={el.fontSize * 0.7} fill="rgba(31,36,48,0.55)" listening={false} />}
    </>
  );
}

/** Trazo a mano alzada. La caja se usa para seleccionar y mover; los puntos son relativos a ella. */
export function DrawBody({ el }: { el: DrawElement }) {
  return (
    <>
      <HitBox w={el.width} h={el.height} />
      <Line points={el.points} stroke={el.stroke} strokeWidth={el.strokeWidth} lineCap="round" lineJoin="round" tension={0.4} listening={false} />
    </>
  );
}
