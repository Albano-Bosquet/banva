import { useEffect, useState } from 'react';

const cache = new Map<string, HTMLImageElement>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  const hit = cache.get(src);
  if (hit?.complete && hit.naturalWidth) return Promise.resolve(hit);
  return new Promise((resolve, reject) => {
    const img = hit ?? new Image();
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar ${src.slice(0, 60)}`));
    if (!hit) {
      img.src = src;
      cache.set(src, img);
    }
  });
}

export function useImage(src: string): HTMLImageElement | undefined {
  const [img, setImg] = useState<HTMLImageElement | undefined>(() => {
    const hit = cache.get(src);
    return hit?.complete && hit.naturalWidth ? hit : undefined;
  });
  useEffect(() => {
    let alive = true;
    loadImage(src).then((i) => alive && setImg(i)).catch(() => alive && setImg(undefined));
    return () => {
      alive = false;
    };
  }, [src]);
  return img;
}
