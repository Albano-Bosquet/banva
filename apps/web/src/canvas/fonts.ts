import { useEffect, useState } from 'react';
/** Tipografías del editor (las web se cargan desde index.html). */
export const FONTS = ['Inter', 'Montserrat', 'Playfair Display', 'DM Serif Display', 'Space Grotesk', 'Bebas Neue', 'Caveat', 'Roboto Mono', 'Lobster', 'Georgia', 'Arial'];

/**
 * El navegador solo descarga una fuente web cuando algo del DOM la usa; el texto de
 * un canvas no cuenta. Por eso se piden explícitamente todas las variantes.
 */
let loading: Promise<unknown> | null = null;
export function preloadFonts(): Promise<unknown> {
  if (typeof document === 'undefined' || !document.fonts?.load) return Promise.resolve();
  loading ??= Promise.all(
    FONTS.flatMap((f) => ['400', '700', 'italic 400', 'italic 700'].map((v) => document.fonts.load(`${v} 32px "${f}"`).catch(() => null))),
  );
  return loading;
}

/** Cambia cada vez que termina de cargar una fuente, para volver a dibujar los lienzos. */
export function useFontsVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return;
    const bump = () => setV((n) => n + 1);
    void preloadFonts().then(bump);
    document.fonts.addEventListener('loadingdone', bump);
    return () => document.fonts.removeEventListener('loadingdone', bump);
  }, []);
  return v;
}
