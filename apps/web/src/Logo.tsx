/** Marca de Banva: el círculo verde con la B (PNG con fondo transparente). */
export function Logo({ size = 32, wordmark = false }: { size?: number; wordmark?: boolean }) {
  return (
    <span className="banva-brand">
      <img className="banva-mark" src="/banva-logo.png" alt={wordmark ? '' : 'Banva'} width={size} height={size} />
      {wordmark && <span className="banva-word">Banva</span>}
    </span>
  );
}
