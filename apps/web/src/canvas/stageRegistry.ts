import type Konva from 'konva';
import { resetAnimations } from './animation';

/** Stages montados por página, usados por la exportación y las miniaturas. */
export const stageRegistry = new Map<string, Konva.Stage>();

/**
 * Renderiza una página a dataURL en resolución de diseño × `scale`,
 * ocultando la capa de interfaz (selección, guías).
 */
export function renderPage(pageId: string, opts: { scale: number; mime: 'image/png' | 'image/jpeg'; quality?: number; transparent?: boolean }): string | null {
  const stage = stageRegistry.get(pageId);
  if (!stage) return null;
  // Cuadro estático: animaciones en reposo y sin el ícono de "play" de los videos.
  resetAnimations(stage);
  const ui = [...stage.find('.ui'), ...stage.find('.video-badge')];
  const bg = stage.find('.page-bg');
  ui.forEach((n) => n.hide());
  if (opts.transparent) bg.forEach((n) => n.hide());
  try {
    // El stage está escalado por el zoom; pixelRatio lo compensa para obtener px de diseño.
    const zoom = stage.scaleX();
    return stage.toDataURL({ mimeType: opts.mime, quality: opts.quality ?? 0.92, pixelRatio: opts.scale / zoom });
  } finally {
    ui.forEach((n) => n.show());
    bg.forEach((n) => n.show());
    stage.batchDraw();
  }
}
