import type { ClientMessage, Patch, Peer, ServerMessage } from '@trazo/shared';
import type { Backend } from '../api/backend';
import { onDocChange, useEditor } from '../store/editorStore';
import { create } from 'zustand';

const SNAPSHOT_DEBOUNCE_MS = 900;
const THUMB_DEBOUNCE_MS = 2500;

export const usePresence = create<{ peers: Peer[]; clientId: string }>(() => ({
  peers: [],
  clientId: `c${Math.random().toString(36).slice(2, 10)}`,
}));

/**
 * Sesión de edición de un diseño.
 * - Con WebSocket: cada cambio local viaja como parches (deltas) y el servidor responde con la nueva revisión.
 * - Sin WebSocket (o modo local): guardado del documento completo con debounce.
 */
export function startSession(designId: string, backend: Backend, makeThumbnail: () => string | null): () => void {
  const editor = useEditor.getState;
  let ws: WebSocket | null = null;
  let closed = false;
  let retry = 0;
  let pending = new Map<string, Patch[]>();
  let snapshotTimer: ReturnType<typeof setTimeout> | undefined;
  let thumbTimer: ReturnType<typeof setTimeout> | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let unsyncedWhileOffline = false;
  let opSeq = 0;

  const setStatus = (s: Parameters<ReturnType<typeof editor>['setSaveStatus']>[0]) => editor().setSaveStatus(s);

  const scheduleThumbnail = () => {
    clearTimeout(thumbTimer);
    thumbTimer = setTimeout(() => {
      const url = makeThumbnail();
      if (url) backend.saveThumbnail(designId, url).catch(() => {});
    }, THUMB_DEBOUNCE_MS);
  };

  const saveSnapshot = async () => {
    const { doc, revision } = editor();
    setStatus('saving');
    try {
      const res = await backend.save(designId, revision, doc);
      editor().setRevision(res.revision);
      unsyncedWhileOffline = false;
      setStatus(backend.kind === 'local' ? 'offline' : 'saved');
      scheduleThumbnail();
    } catch {
      setStatus('error');
      snapshotTimer = setTimeout(saveSnapshot, 4000);
    }
  };

  const scheduleSnapshot = () => {
    clearTimeout(snapshotTimer);
    snapshotTimer = setTimeout(saveSnapshot, SNAPSHOT_DEBOUNCE_MS);
  };

  const send = (msg: ClientMessage) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify(msg));

  const offChange = onDocChange((patches, source) => {
    if (source === 'remote' || source === 'load') return;
    if (ws?.readyState === WebSocket.OPEN) {
      const opId = `${usePresence.getState().clientId}:${++opSeq}`;
      pending.set(opId, patches);
      setStatus('saving');
      send({ type: 'patch', baseRevision: editor().revision, patches, opId });
      scheduleThumbnail();
    } else {
      unsyncedWhileOffline = true;
      scheduleSnapshot();
    }
  });

  const connect = () => {
    if (backend.kind !== 'remote' || closed) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws`);
    ws.onopen = () => {
      retry = 0;
      send({ type: 'join', designId, clientId: usePresence.getState().clientId, name: 'Invitado' });
    };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data)) as ServerMessage;
      switch (msg.type) {
        case 'welcome':
          usePresence.setState({ peers: msg.peers });
          if (unsyncedWhileOffline) saveSnapshot();
          else if (msg.revision !== editor().revision) editor().replaceDoc(msg.doc, msg.revision);
          break;
        case 'ack':
          pending.delete(msg.opId);
          editor().setRevision(msg.revision);
          if (!pending.size) setStatus('saved');
          break;
        case 'patch':
          editor().applyRemote(msg.patches);
          editor().setRevision(msg.revision);
          break;
        case 'resync':
          pending = new Map();
          // Si el servidor ya tiene exactamente lo mismo (p. ej. nuestro propio guardado), se conserva el historial.
          if (JSON.stringify(msg.doc) === JSON.stringify(editor().doc)) editor().setRevision(msg.revision);
          else editor().replaceDoc(msg.doc, msg.revision);
          setStatus('saved');
          break;
        case 'peers':
          usePresence.setState({ peers: msg.peers });
          break;
      }
    };
    ws.onclose = () => {
      ws = null;
      usePresence.setState({ peers: [] });
      if (closed) return;
      // Lo que no se confirmó se guarda como snapshot por HTTP.
      if (pending.size) {
        pending = new Map();
        unsyncedWhileOffline = true;
        scheduleSnapshot();
      }
      reconnectTimer = setTimeout(connect, Math.min(10000, 500 * 2 ** retry++));
    };
  };

  if (backend.kind === 'local') setStatus('offline');
  connect();

  const beforeUnload = (e: BeforeUnloadEvent) => {
    if (editor().saveStatus === 'dirty' || editor().saveStatus === 'saving') e.preventDefault();
  };
  window.addEventListener('beforeunload', beforeUnload);

  return () => {
    closed = true;
    offChange();
    window.removeEventListener('beforeunload', beforeUnload);
    clearTimeout(reconnectTimer);
    clearTimeout(thumbTimer);
    if (snapshotTimer) {
      clearTimeout(snapshotTimer);
      if (unsyncedWhileOffline) void saveSnapshot();
    }
    ws?.close();
  };
}
