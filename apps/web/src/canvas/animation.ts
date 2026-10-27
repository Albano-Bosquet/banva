import { useEffect, type RefObject } from 'react';
import Konva from 'konva';
import { create } from 'zustand';
import type { AnimationKind } from '@trazo/shared';

/** Animaciones de entrada (una vez) y en bucle (continuas). */
export const ENTRANCE: AnimationKind[] = ['fade', 'rise', 'pop', 'slide'];
export const LOOP: AnimationKind[] = ['pulse', 'spin', 'bounce', 'wiggle'];

export const ANIMATION_LABELS: Record<AnimationKind, string> = {
  none: 'Ninguna',
  fade: 'Aparecer',
  rise: 'Elevar',
  pop: 'Saltar',
  slide: 'Deslizar',
  pulse: 'Latir',
  spin: 'Girar',
  bounce: 'Rebotar',
  wiggle: 'Balancear',
};

/** Reproducción de entradas: cada "play" incrementa el token de una página. */
interface PlaybackState {
  tokens: Record<string, number>;
  play(pageId: string): void;
}
export const usePlayback = create<PlaybackState>((set, get) => ({
  tokens: {},
  play(pageId) {
    set({ tokens: { ...get().tokens, [pageId]: (get().tokens[pageId] ?? 0) + 1 } });
  },
}));

const ENTRANCE_MS = 700;

/**
 * Anima el grupo interno "anim" (centrado en la caja) sin tocar la posición real del
 * elemento, así arrastrar o transformar no interfiere con la animación.
 */
export function useElementAnimation(ref: RefObject<Konva.Group | null>, kind: AnimationKind | undefined, w: number, h: number, pageId: string | undefined, delay = 0) {
  const token = usePlayback((s) => (pageId ? s.tokens[pageId] ?? 0 : 0));

  // Bucle continuo.
  useEffect(() => {
    const node = ref.current;
    if (!node || !kind || !LOOP.includes(kind)) return;
    const anim = new Konva.Animation((frame) => {
      const t = (frame?.time ?? 0) / 1000;
      resetNode(node, w, h);
      if (kind === 'pulse') node.scale({ x: 1 + Math.sin(t * 5) * 0.08, y: 1 + Math.sin(t * 5) * 0.08 });
      if (kind === 'spin') node.rotation((t * 90) % 360);
      if (kind === 'bounce') node.y(h / 2 - Math.abs(Math.sin(t * 4)) * h * 0.12);
      if (kind === 'wiggle') node.rotation(Math.sin(t * 6) * 8);
    }, node.getLayer());
    anim.start();
    return () => {
      anim.stop();
      resetNode(node, w, h);
    };
  }, [ref, kind, w, h]);

  // Entrada: se reproduce cuando cambia el token de la página.
  useEffect(() => {
    const node = ref.current;
    if (!node || !kind || !ENTRANCE.includes(kind) || token === 0) return;
    let start: number | null = null;
    const anim = new Konva.Animation((frame) => {
      const now = frame?.time ?? 0;
      if (start === null) start = now;
      const p = Math.min(1, Math.max(0, (now - start - delay) / ENTRANCE_MS));
      const e = 1 - Math.pow(1 - p, 3);
      resetNode(node, w, h);
      node.opacity(e);
      if (kind === 'rise') node.y(h / 2 + (1 - e) * h * 0.4);
      if (kind === 'slide') node.x(w / 2 - (1 - e) * w * 0.6);
      if (kind === 'pop') {
        const s = p < 1 ? 0.4 + 0.6 * e + Math.sin(p * Math.PI) * 0.12 : 1;
        node.scale({ x: s, y: s });
      }
      if (p >= 1) anim.stop();
    }, node.getLayer());
    anim.start();
    return () => {
      anim.stop();
      resetNode(node, w, h);
    };
  }, [ref, kind, token, w, h, delay]);
}

function resetNode(node: Konva.Node, w: number, h: number) {
  node.setAttrs({ x: w / 2, y: h / 2, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 });
}

/** Deja todos los grupos animados en reposo (para exportar cuadros estáticos). */
export function resetAnimations(stage: Konva.Stage) {
  stage.find('.anim').forEach((n) => {
    const { w, h } = n.getAttr('box') ?? { w: 0, h: 0 };
    resetNode(n, w, h);
  });
}
