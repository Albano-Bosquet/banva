import type { SolidKind } from '@trazo/shared';

/**
 * Objetos 3D simples: mallas generadas en código, rotadas (yaw/pitch), ordenadas
 * por profundidad (algoritmo del pintor) y sombreadas según la normal de cada cara.
 */

type V3 = [number, number, number];
interface Mesh {
  verts: V3[];
  faces: number[][];
}

function cube(): Mesh {
  const v: V3[] = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) v.push([x, y, z]);
  // índices: (x,y,z) → 4*(x>0) + 2*(y>0) + (z>0)
  return { verts: v, faces: [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]] };
}

/** Prisma/cilindro/cono genérico: n lados, radio inferior y superior. */
function lathe(n: number, rBottom: number, rTop: number): Mesh {
  const verts: V3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    verts.push([Math.cos(a) * rBottom, 1, Math.sin(a) * rBottom]);
  }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    verts.push([Math.cos(a) * rTop, -1, Math.sin(a) * rTop]);
  }
  const faces: number[][] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (rTop === 0) faces.push([i, j, n + i]);
    else faces.push([i, j, n + j, n + i]);
  }
  faces.push(Array.from({ length: n }, (_, i) => n - 1 - i)); // base
  if (rTop > 0) faces.push(Array.from({ length: n }, (_, i) => n + i)); // tapa
  return { verts, faces };
}

function sphere(lat: number, lon: number): Mesh {
  const verts: V3[] = [];
  const faces: number[][] = [];
  for (let i = 0; i <= lat; i++) {
    const t = (i / lat) * Math.PI;
    for (let j = 0; j < lon; j++) {
      const p = (j / lon) * Math.PI * 2;
      verts.push([Math.sin(t) * Math.cos(p), -Math.cos(t), Math.sin(t) * Math.sin(p)]);
    }
  }
  for (let i = 0; i < lat; i++)
    for (let j = 0; j < lon; j++) {
      const a = i * lon + j;
      const b = i * lon + ((j + 1) % lon);
      faces.push([a, b, b + lon, a + lon]);
    }
  return { verts, faces };
}

function torus(n: number, m: number, R: number, r: number): Mesh {
  const verts: V3[] = [];
  const faces: number[][] = [];
  for (let i = 0; i < n; i++) {
    const u = (i / n) * Math.PI * 2;
    for (let j = 0; j < m; j++) {
      const v = (j / m) * Math.PI * 2;
      verts.push([(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u)]);
    }
  }
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) {
      const a = i * m + j;
      const b = ((i + 1) % n) * m + j;
      const c = ((i + 1) % n) * m + ((j + 1) % m);
      const d = i * m + ((j + 1) % m);
      faces.push([a, d, c, b]);
    }
  return { verts, faces };
}

function gem(): Mesh {
  const n = 8;
  const verts: V3[] = [[0, 1.1, 0]];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    verts.push([Math.cos(a), -0.25, Math.sin(a)]);
  }
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * Math.PI * 2;
    verts.push([Math.cos(a) * 0.6, -0.7, Math.sin(a) * 0.6]);
  }
  const faces: number[][] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push([0, 1 + j, 1 + i]);
    faces.push([1 + i, 1 + j, 1 + n + i]);
    faces.push([1 + j, 1 + n + j, 1 + n + i]);
  }
  faces.push(Array.from({ length: n }, (_, i) => 1 + n + i));
  return { verts, faces };
}

const MESHES: Record<SolidKind, () => Mesh> = {
  cube,
  pyramid: () => lathe(4, 1.2, 0),
  prism: () => lathe(6, 1, 1),
  cylinder: () => lathe(28, 1, 1),
  cone: () => lathe(28, 1, 0),
  sphere: () => sphere(14, 24),
  torus: () => torus(28, 14, 0.75, 0.32),
  gem,
};
const cache = new Map<SolidKind, Mesh>();
function mesh(kind: SolidKind): Mesh {
  if (!cache.has(kind)) cache.set(kind, MESHES[kind]());
  return cache.get(kind)!;
}

export const SOLID_LABELS: Record<SolidKind, string> = {
  cube: 'Cubo',
  pyramid: 'Pirámide',
  prism: 'Prisma',
  cylinder: 'Cilindro',
  cone: 'Cono',
  sphere: 'Esfera',
  torus: 'Anillo',
  gem: 'Gema',
};

function rgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  const n = m ? parseInt(m[1], 16) : 0x5b6cff;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const LIGHT: V3 = normalize([-0.5, -0.8, -0.9]);
function normalize(v: V3): V3 {
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** Dibuja el sólido centrado en la caja w×h. */
export function drawSolid(ctx: CanvasRenderingContext2D, kind: SolidKind, color: string, yawDeg: number, pitchDeg: number, w: number, h: number) {
  const { verts, faces } = mesh(kind);
  const yaw = (yawDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const rot = verts.map(([x, y, z]): V3 => {
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
  });
  // Perspectiva suave y escala para que el objeto entre en la caja.
  const camera = 5;
  const proj = rot.map(([x, y, z]) => {
    const f = camera / (camera + z);
    return [x * f, y * f] as [number, number];
  });
  const xs = proj.map((p) => p[0]);
  const ys = proj.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1;
  const spanY = Math.max(...ys) - minY || 1;
  const scale = Math.min((w * 0.92) / spanX, (h * 0.92) / spanY);
  const ox = (w - spanX * scale) / 2 - minX * scale;
  const oy = (h - spanY * scale) / 2 - minY * scale;
  const [r, g, b] = rgb(color);

  const drawn = faces
    .map((f) => {
      const a = rot[f[0]];
      const bb = rot[f[1]];
      const c = rot[f[2]];
      const u: V3 = [bb[0] - a[0], bb[1] - a[1], bb[2] - a[2]];
      const v: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      let n = normalize([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]);
      // La normal se orienta hacia la cámara (que mira hacia +z) sin depender del sentido de las caras.
      if (n[2] > 0) n = [-n[0], -n[1], -n[2]];
      const depth = f.reduce((s, i) => s + rot[i][2], 0) / f.length;
      return { f, n, depth };
    })
    // Algoritmo del pintor: primero lo más lejano.
    .sort((p, q) => q.depth - p.depth);

  for (const { f, n } of drawn) {
    // LIGHT apunta hacia la luz (arriba, a la izquierda y hacia el observador).
    const diffuse = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
    const k = 0.42 + 0.68 * diffuse;
    const spec = Math.pow(diffuse, 24) * 90;
    const c = (x: number) => Math.min(255, Math.round(x * k + spec));
    ctx.beginPath();
    f.forEach((i, idx) => {
      const [px, py] = proj[i];
      const X = ox + px * scale;
      const Y = oy + py * scale;
      if (idx) ctx.lineTo(X, Y);
      else ctx.moveTo(X, Y);
    });
    ctx.closePath();
    const fill = `rgb(${c(r)},${c(g)},${c(b)})`;
    ctx.fillStyle = fill;
    ctx.strokeStyle = fill;
    ctx.lineWidth = 0.6;
    ctx.fill();
    ctx.stroke();
  }
}
