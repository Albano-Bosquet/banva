import type Konva from 'konva';
import type { AudioTrack } from '@trazo/shared';

export interface Recorder {
  stop(): void;
}

/**
 * Graba la reproducción del video: en cada cuadro copia las capas del stage visible
 * a un canvas del tamaño del diseño (máx. 1920 px) y mezcla las pistas de audio con
 * Web Audio. MediaRecorder produce un WebM que se descarga al terminar.
 */
export function startRecording(width: number, height: number, getStage: () => Konva.Stage | null, tracks: AudioTrack[], filename: string, onDone: () => void): Recorder {
  const k = Math.min(1, 1920 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * k);
  canvas.height = Math.round(height * k);
  const g = canvas.getContext('2d')!;
  const stream = canvas.captureStream(30);

  // Audio: cada pista pasa por Web Audio hacia la grabación y hacia los parlantes.
  // Sin pistas no se agrega audio: una pista muda (o un contexto suspendido) deja al
  // grabador esperando datos y el archivo sale vacío.
  const ctx = tracks.length ? new AudioContext() : null;
  const audios: HTMLAudioElement[] = [];
  if (ctx) {
    void ctx.resume();
    const dest = ctx.createMediaStreamDestination();
    for (const t of tracks) {
      const a = new Audio(t.src);
      a.crossOrigin = 'anonymous';
      a.loop = true;
      const src = ctx.createMediaElementSource(a);
      const gain = ctx.createGain();
      gain.gain.value = t.volume;
      src.connect(gain);
      gain.connect(dest);
      gain.connect(ctx.destination);
      void a.play().catch(() => {});
      audios.push(a);
    }
    if (ctx.state === 'running' || navigator.userActivation?.isActive) for (const tr of dest.stream.getAudioTracks()) stream.addTrack(tr);
  }

  const hasAudio = stream.getAudioTracks().length > 0;
  const mime = (hasAudio ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'] : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']).find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  // Temporizador y no requestAnimationFrame: éste se congela si la pestaña pasa a segundo plano.
  let timer = 0;
  const frame = () => {
    // Un cuadro que falla (p. ej. mientras cambia la escena) no corta la grabación.
    try {
      const stage = getStage();
      g.fillStyle = '#000';
      g.fillRect(0, 0, canvas.width, canvas.height);
      if (stage) for (const layer of stage.getLayers()) g.drawImage(layer.getNativeCanvasElement(), 0, 0, canvas.width, canvas.height);
    } catch {
      /* se reintenta en el próximo cuadro */
    }
  };
  frame();
  timer = window.setInterval(frame, 1000 / 30);
  rec.start(250);

  let stopped = false;
  rec.onstop = () => {
    clearInterval(timer);
    audios.forEach((a) => a.pause());
    void ctx?.close();
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.replace(/[\\/:*?"<>|]+/g, '');
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    onDone();
  };
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      rec.stop();
    },
  };
}
