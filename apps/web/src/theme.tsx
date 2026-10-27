import { useEffect, useState } from 'react';
import { Icon } from './editor/icons';

type Theme = 'light' | 'dark';
const KEY = 'banva:theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

/** El tema elegido por la persona; sin elección se sigue el del sistema. */
function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

const current = (): Theme => stored() ?? (media.matches ? 'dark' : 'light');

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

/** Se llama antes del primer render para que la app no parpadee en claro. */
export function initTheme() {
  apply(current());
  media.addEventListener('change', () => stored() || apply(current()));
}

/** Botón sol/luna que alterna entre modo claro y oscuro. */
export function ThemeToggle({ className = 'ghost' }: { className?: string }) {
  const [theme, setTheme] = useState(current);
  useEffect(() => {
    const on = () => setTheme(current());
    media.addEventListener('change', on);
    return () => media.removeEventListener('change', on);
  }, []);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      className={className}
      data-testid="theme-toggle"
      title={next === 'dark' ? 'Modo oscuro' : 'Modo claro'}
      aria-label={next === 'dark' ? 'Activar modo oscuro' : 'Activar modo claro'}
      onClick={() => {
        try {
          localStorage.setItem(KEY, next);
        } catch {
          // Sin almacenamiento el cambio vale solo para esta sesión.
        }
        apply(next);
        setTheme(next);
      }}
    >
      <Icon name={next === 'dark' ? 'moon' : 'sun'} />
    </button>
  );
}
