/** Marca de Banva: el círculo verde con la B, recortado del fondo blanco de la imagen. */
export function Logo({ size = 32, wordmark = false }: { size?: number; wordmark?: boolean }) {
  return (
    <span className="banva-brand">
      <span className="banva-mark" style={{ width: size, height: size }}>
        <img src="/banva-logo.webp" alt={wordmark ? '' : 'Banva'} />
      </span>
      {wordmark && <span className="banva-word">Banva</span>}
    </span>
  );
}
