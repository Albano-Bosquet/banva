import { applyPatches, enablePatches, type Patch as ImmerPatch } from 'immer';
import type { WebSocket } from 'ws';
import { clientMessageSchema, designDocSchema, type DesignDoc, type Peer, type ServerMessage } from '@trazo/shared';
import type { Repo } from './repo';

enablePatches();

const COLORS = ['#ff6b4a', '#2bb3a3', '#5b6cff', '#e84a8a', '#ffc145', '#2e7d32'];
const PERSIST_DEBOUNCE_MS = 400;

interface Client {
  socket: WebSocket;
  peer: Peer;
}

interface Room {
  id: string;
  doc: DesignDoc;
  revision: number;
  clients: Set<Client>;
  persistTimer?: NodeJS.Timeout;
  saving: Promise<unknown>;
}

/**
 * Salas de colaboración por diseño. El servidor es la fuente de verdad:
 * aplica los parches recibidos en orden de llegada, incrementa la revisión,
 * confirma al emisor (ack) y retransmite a los demás. Si un parche no aplica
 * (p. ej. un elemento borrado por otro), se reenvía el documento completo (resync).
 */
export class CollabHub {
  private rooms = new Map<string, Room>();

  constructor(private repo: Repo) {}

  /** Notifica que el documento cambió fuera del canal (p. ej. PUT por HTTP): todos los clientes se resincronizan. */
  async externalUpdate(id: string, doc: DesignDoc, revision: number) {
    const room = this.rooms.get(id);
    if (!room) return;
    room.doc = doc;
    room.revision = revision;
    this.broadcast(room, { type: 'resync', revision, doc });
  }

  handle(socket: WebSocket) {
    let client: Client | null = null;
    let room: Room | null = null;

    socket.on('message', async (raw) => {
      let msg;
      try {
        msg = clientMessageSchema.parse(JSON.parse(String(raw)));
      } catch {
        return socket.close(1003, 'mensaje inválido');
      }

      if (msg.type === 'join') {
        if (room) return;
        room = await this.join(msg.designId);
        if (!room) return socket.close(4404, 'diseño inexistente');
        client = { socket, peer: { clientId: msg.clientId, name: msg.name ?? 'Invitado', color: COLORS[room.clients.size % COLORS.length] } };
        room.clients.add(client);
        this.send(client, { type: 'welcome', revision: room.revision, doc: room.doc, peers: this.peers(room) });
        this.broadcast(room, { type: 'peers', peers: this.peers(room) }, client);
        return;
      }

      if (!room || !client) return;

      if (msg.type === 'patch') {
        let next: DesignDoc;
        try {
          next = applyPatches(room.doc, msg.patches as ImmerPatch[]);
          designDocSchema.parse(next);
        } catch {
          this.send(client, { type: 'resync', revision: room.revision, doc: room.doc });
          return;
        }
        room.doc = next;
        room.revision += 1;
        this.send(client, { type: 'ack', revision: room.revision, opId: msg.opId });
        this.broadcast(room, { type: 'patch', revision: room.revision, patches: msg.patches, clientId: client.peer.clientId, opId: msg.opId }, client);
        void this.repo.logOp(room.id, room.revision, client.peer.clientId, msg.patches).catch(() => {});
        this.schedulePersist(room);
        return;
      }

      if (msg.type === 'cursor') {
        this.broadcast(room, { type: 'cursor', clientId: client.peer.clientId, pageId: msg.pageId, x: msg.x, y: msg.y }, client);
      }
    });

    socket.on('close', () => {
      if (!room || !client) return;
      room.clients.delete(client);
      this.broadcast(room, { type: 'peers', peers: this.peers(room) });
      if (!room.clients.size) void this.closeRoom(room);
    });
  }

  private async join(id: string): Promise<Room | null> {
    const existing = this.rooms.get(id);
    if (existing) return existing;
    const design = await this.repo.get(id);
    if (!design) return null;
    // Dos joins simultáneos pueden haber cargado el diseño: gana el primero.
    const again = this.rooms.get(id);
    if (again) return again;
    const room: Room = { id, doc: design.doc, revision: design.revision, clients: new Set(), saving: Promise.resolve() };
    this.rooms.set(id, room);
    return room;
  }

  private schedulePersist(room: Room) {
    clearTimeout(room.persistTimer);
    room.persistTimer = setTimeout(() => void this.persist(room), PERSIST_DEBOUNCE_MS);
  }

  private persist(room: Room) {
    clearTimeout(room.persistTimer);
    room.persistTimer = undefined;
    const { doc, revision } = room;
    // La revisión de la sala manda: se guarda tal cual junto con el documento.
    room.saving = room.saving.then(() => this.repo.save(room.id, doc, revision)).catch(() => {});
    return room.saving;
  }

  private async closeRoom(room: Room) {
    if (room.persistTimer) await this.persist(room);
    await room.saving;
    if (!room.clients.size) this.rooms.delete(room.id);
  }

  /** Revisión vigente de un diseño abierto en una sala (para respuestas HTTP coherentes). */
  roomState(id: string) {
    const r = this.rooms.get(id);
    return r ? { doc: r.doc, revision: r.revision } : null;
  }

  async flushAll() {
    await Promise.all([...this.rooms.values()].map((r) => (r.persistTimer ? this.persist(r) : r.saving)));
  }

  private peers(room: Room): Peer[] {
    return [...room.clients].map((c) => c.peer);
  }

  private send(client: Client, msg: ServerMessage) {
    if (client.socket.readyState === client.socket.OPEN) client.socket.send(JSON.stringify(msg));
  }

  private broadcast(room: Room, msg: ServerMessage, except?: Client) {
    for (const c of room.clients) if (c !== except) this.send(c, msg);
  }
}
