import type { FrameDecoration } from '@trazo/shared';

/**
 * Decoraciones de marcos y mockups dibujadas en código (sin imágenes externas).
 * `screen` es el área donde va la imagen, en fracciones de la caja del elemento;
 * `under` se dibuja detrás de la imagen y `over` encima.
 */
export interface Decoration {
  label: string;
  screen: { x: number; y: number; w: number; h: number; r: number };
  under?(c: CanvasRenderingContext2D, w: number, h: number, tint: string): void;
  over?(c: CanvasRenderingContext2D, w: number, h: number, tint: string): void;
}

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
}

function shade(hex: string, amount: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (s: number) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * (1 + amount))));
  return `rgb(${f(16)},${f(8)},${f(0)})`;
}

function softShadow(c: CanvasRenderingContext2D, size: number) {
  c.shadowColor = 'rgba(15,20,40,0.25)';
  c.shadowBlur = size * 0.04;
  c.shadowOffsetY = size * 0.015;
}

export const DECORATIONS: Record<FrameDecoration, Decoration> = {
  none: { label: 'Sin decoración', screen: { x: 0, y: 0, w: 1, h: 1, r: 0 } },
  polaroid: {
    label: 'Foto instantánea',
    screen: { x: 0.07, y: 0.06, w: 0.86, h: 0.72, r: 0 },
    under(c, w, h) {
      c.save();
      softShadow(c, w);
      rr(c, 0, 0, w, h, w * 0.01);
      c.fillStyle = '#ffffff';
      c.fill();
      c.restore();
    },
  },
  film: {
    label: 'Película',
    screen: { x: 0.04, y: 0.17, w: 0.92, h: 0.66, r: 0.01 },
    under(c, w, h, tint) {
      rr(c, 0, 0, w, h, 0);
      c.fillStyle = tint;
      c.fill();
    },
    over(c, w, h) {
      c.fillStyle = '#ffffff';
      const n = 12;
      const hw = w / n;
      for (let i = 0; i < n; i++) {
        for (const y of [h * 0.05, h * 0.89]) {
          rr(c, i * hw + hw * 0.28, y, hw * 0.44, h * 0.06, hw * 0.08);
          c.fill();
        }
      }
    },
  },
  phone: {
    label: 'Teléfono',
    screen: { x: 0.05, y: 0.025, w: 0.9, h: 0.95, r: 0.085 },
    under(c, w, h, tint) {
      c.save();
      softShadow(c, h);
      rr(c, 0, 0, w, h, w * 0.14);
      c.fillStyle = tint;
      c.fill();
      c.restore();
      c.strokeStyle = shade(tint, 0.6);
      c.lineWidth = w * 0.008;
      rr(c, w * 0.004, w * 0.004, w * 0.992, h - w * 0.008, w * 0.14);
      c.stroke();
    },
    over(c, w, h, tint) {
      rr(c, w * 0.36, h * 0.035, w * 0.28, h * 0.022, h * 0.011);
      c.fillStyle = tint;
      c.fill();
    },
  },
  tablet: {
    label: 'Tablet',
    screen: { x: 0.05, y: 0.04, w: 0.9, h: 0.92, r: 0.02 },
    under(c, w, h, tint) {
      c.save();
      softShadow(c, h);
      rr(c, 0, 0, w, h, w * 0.06);
      c.fillStyle = tint;
      c.fill();
      c.restore();
    },
  },
  laptop: {
    label: 'Laptop',
    screen: { x: 0.135, y: 0.05, w: 0.73, h: 0.76, r: 0.005 },
    under(c, w, h, tint) {
      c.save();
      softShadow(c, w);
      rr(c, w * 0.11, 0, w * 0.78, h * 0.86, w * 0.025);
      c.fillStyle = tint;
      c.fill();
      c.restore();
      // Base
      c.beginPath();
      c.moveTo(0, h * 0.88);
      c.lineTo(w, h * 0.88);
      c.lineTo(w * 0.97, h);
      c.lineTo(w * 0.03, h);
      c.closePath();
      c.fillStyle = '#c9ccd6';
      c.fill();
      rr(c, 0, h * 0.86, w, h * 0.035, h * 0.01);
      c.fillStyle = '#dfe2ea';
      c.fill();
      rr(c, w * 0.42, h * 0.86, w * 0.16, h * 0.02, h * 0.01);
      c.fillStyle = '#b5b9c6';
      c.fill();
    },
  },
  monitor: {
    label: 'Monitor',
    screen: { x: 0.03, y: 0.04, w: 0.94, h: 0.68, r: 0.005 },
    under(c, w, h, tint) {
      c.fillStyle = '#c9ccd6';
      c.beginPath();
      c.moveTo(w * 0.44, h * 0.78);
      c.lineTo(w * 0.56, h * 0.78);
      c.lineTo(w * 0.6, h * 0.95);
      c.lineTo(w * 0.4, h * 0.95);
      c.closePath();
      c.fill();
      rr(c, w * 0.3, h * 0.94, w * 0.4, h * 0.05, h * 0.02);
      c.fill();
      c.save();
      softShadow(c, w);
      rr(c, 0, 0, w, h * 0.8, w * 0.02);
      c.fillStyle = tint;
      c.fill();
      c.restore();
    },
  },
  tshirt: {
    label: 'Remera',
    screen: { x: 0.33, y: 0.3, w: 0.34, h: 0.36, r: 0 },
    under(c, w, h, tint) {
      c.save();
      softShadow(c, w);
      c.beginPath();
      const p = [
        [0.34, 0.02], [0.4, 0.06], [0.5, 0.09], [0.6, 0.06], [0.66, 0.02], [0.96, 0.17], [0.86, 0.38], [0.76, 0.32],
        [0.77, 0.98], [0.23, 0.98], [0.24, 0.32], [0.14, 0.38], [0.04, 0.17],
      ];
      p.forEach(([x, y], i) => (i ? c.lineTo(x * w, y * h) : c.moveTo(x * w, y * h)));
      c.closePath();
      c.fillStyle = tint;
      c.fill();
      c.restore();
      c.strokeStyle = shade(tint, -0.12);
      c.lineWidth = w * 0.006;
      c.beginPath();
      c.moveTo(0.4 * w, 0.06 * h);
      c.quadraticCurveTo(0.5 * w, 0.16 * h, 0.6 * w, 0.06 * h);
      c.stroke();
    },
  },
  mug: {
    label: 'Taza',
    screen: { x: 0.1, y: 0.16, w: 0.56, h: 0.66, r: 0 },
    under(c, w, h, tint) {
      c.strokeStyle = tint;
      c.lineWidth = w * 0.07;
      c.beginPath();
      c.ellipse(w * 0.76, h * 0.48, w * 0.14, h * 0.2, 0, -Math.PI / 2, Math.PI / 2);
      c.stroke();
      c.save();
      softShadow(c, w);
      rr(c, 0.04 * w, 0.06 * h, 0.68 * w, 0.88 * h, w * 0.05);
      c.fillStyle = tint;
      c.fill();
      c.restore();
      c.beginPath();
      c.ellipse(0.38 * w, 0.08 * h, 0.34 * w, 0.05 * h, 0, 0, Math.PI * 2);
      c.fillStyle = shade(tint, -0.25);
      c.fill();
    },
    over(c, w, h) {
      const g = c.createLinearGradient(0.04 * w, 0, 0.72 * w, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.18)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.12)');
      g.addColorStop(1, 'rgba(0,0,0,0.22)');
      c.fillStyle = g;
      c.fillRect(0.04 * w, 0.16 * h, 0.68 * w, 0.66 * h);
    },
  },
  poster: {
    label: 'Póster',
    screen: { x: 0.05, y: 0.04, w: 0.9, h: 0.92, r: 0 },
    under(c, w, h) {
      c.save();
      softShadow(c, h);
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, w, h);
      c.restore();
    },
    over(c, w, h) {
      c.fillStyle = 'rgba(255,240,200,0.75)';
      for (const x of [0.08, 0.8]) {
        c.save();
        c.translate(x * w, -h * 0.01);
        c.rotate(x < 0.5 ? -0.3 : 0.3);
        c.fillRect(0, 0, w * 0.14, h * 0.04);
        c.restore();
      }
    },
  },
};
