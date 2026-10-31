// Room logic for online play. Pure of networking: clients are plain `send` callbacks, so this
// module is unit-tested directly. The server is authoritative — every move is validated with the
// same engine the browser uses, and each player receives a view with hidden information removed.
import {
  IllegalActionError,
  applyAction,
  chooseAiAction,
  createGame,
  type Action,
  type GameState,
  type SeatConfig,
} from '../src/engine';
import {
  DECK_PLACEHOLDER,
  HIDDEN_PREFIX,
  MAX_NAME_LENGTH,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  normalizeCode,
  type ClientMsg,
  type RoomView,
  type SeatKind,
  type ServerMsg,
} from '../src/online/protocol';
import { getCard } from '../src/engine';

interface Seat {
  kind: SeatKind;
  /** player token of the person in a human seat (null = open) */
  token: string | null;
  name: string;
}

interface Session {
  state: GameState;
  turnStart: GameState;
  undoBlocked: boolean;
}

interface Room {
  code: string;
  hostToken: string;
  seats: Seat[];
  status: 'lobby' | 'playing';
  session: Session | null;
  aiTimer: ReturnType<typeof setTimeout> | null;
  lastActive: number;
}

interface Client {
  send: (msg: ServerMsg) => void;
  token: string | null;
  room: string | null;
}

export interface RoomManagerOptions {
  aiDelayMs?: number;
  /** rooms with nobody connected are removed after this long */
  idleRoomMs?: number;
  maxRooms?: number;
  random?: () => number;
  now?: () => number;
}

const BOT_NAMES: Record<Exclude<SeatKind, 'human'>, string> = { easy: 'Bot (Easy)', medium: 'Bot (Medium)' };
const MAX_LOG = 200;

export class RoomManager {
  private rooms = new Map<string, Room>();
  private clients = new Map<string, Client>();
  private aiDelayMs: number;
  private idleRoomMs: number;
  private maxRooms: number;
  private random: () => number;
  private now: () => number;

  constructor(opts: RoomManagerOptions = {}) {
    this.aiDelayMs = opts.aiDelayMs ?? 750;
    this.idleRoomMs = opts.idleRoomMs ?? 6 * 60 * 60 * 1000;
    this.maxRooms = opts.maxRooms ?? 500;
    this.random = opts.random ?? Math.random;
    this.now = opts.now ?? Date.now;
  }

  // -------------------------------------------------------------------------
  // connection lifecycle

  connect(clientId: string, send: (msg: ServerMsg) => void) {
    this.clients.set(clientId, { send, token: null, room: null });
  }

  disconnect(clientId: string) {
    const c = this.clients.get(clientId);
    this.clients.delete(clientId);
    if (c?.room) {
      const room = this.rooms.get(c.room);
      if (room) {
        room.lastActive = this.now();
        this.broadcast(room);
      }
    }
  }

  /** Handle one parsed message; malformed input yields an error reply, never a throw. */
  handle(clientId: string, raw: unknown) {
    const c = this.clients.get(clientId);
    if (!c) return;
    const fail = (message: string) => c.send({ t: 'error', message });
    if (!raw || typeof raw !== 'object' || typeof (raw as { t?: unknown }).t !== 'string') return fail('Malformed message.');
    const msg = raw as ClientMsg;

    if (msg.t === 'hello') {
      if (typeof msg.token !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(msg.token)) return fail('Invalid player token.');
      // identifies the player across reconnects; the client rejoins its room with `join`
      c.token = msg.token;
      return;
    }
    if (!c.token) return fail('Say hello first.');

    try {
      switch (msg.t) {
        case 'create':
          return this.create(c, msg.name, msg.seats);
        case 'join':
          return this.join(c, msg.code, msg.name);
        case 'leave':
          return this.leave(c);
        case 'start':
          return this.start(c);
        case 'action':
          return this.act(c, msg.action);
        case 'undo':
          return this.undo(c);
        case 'rematch':
          return this.rematch(c);
        case 'botify':
          return this.botify(c, msg.seat);
        default:
          return fail('Unknown message.');
      }
    } catch (e) {
      if (e instanceof IllegalActionError || e instanceof RoomError) return fail(e.message);
      throw e;
    }
  }

  /** Remove rooms nobody has had open for a long time. Call periodically. */
  sweep() {
    const cutoff = this.now() - this.idleRoomMs;
    for (const room of this.rooms.values()) {
      if (room.lastActive < cutoff && !this.connectedTokens(room).size) this.deleteRoom(room);
    }
  }

  roomCount() {
    return this.rooms.size;
  }

  // -------------------------------------------------------------------------
  // lobby

  private create(c: Client, name: unknown, seats: unknown) {
    if (!Array.isArray(seats) || seats.length < 2 || seats.length > 4) throw new RoomError('A room needs 2–4 seats.');
    const kinds = seats as SeatKind[];
    if (!kinds.every((k) => k === 'human' || k === 'easy' || k === 'medium')) throw new RoomError('Unknown seat type.');
    if (kinds[0] !== 'human') throw new RoomError('The first seat is yours and must be human.');
    if (this.rooms.size >= this.maxRooms) throw new RoomError('The server is full right now. Try again later.');
    this.leave(c, true);

    const code = this.newCode();
    const room: Room = {
      code,
      hostToken: c.token!,
      seats: kinds.map((kind, i) => ({
        kind,
        token: i === 0 ? c.token : null,
        name: i === 0 ? cleanName(name, 'Player 1') : kind === 'human' ? '' : BOT_NAMES[kind],
      })),
      status: 'lobby',
      session: null,
      aiTimer: null,
      lastActive: this.now(),
    };
    this.rooms.set(code, room);
    this.attach(c, room);
  }

  private join(c: Client, rawCode: unknown, name: unknown) {
    const code = normalizeCode(String(rawCode ?? ''));
    const room = this.rooms.get(code);
    if (!room) throw new RoomError(`No room with code ${code || '(empty)'}. Check the code with your host.`);
    const mine = room.seats.find((s) => s.token === c.token);
    if (mine) return this.attach(c, room); // rejoining
    if (room.status !== 'lobby') throw new RoomError('That game has already started.');
    const open = room.seats.find((s) => s.kind === 'human' && !s.token);
    if (!open) throw new RoomError('That room is full.');
    this.leave(c, true);
    open.token = c.token;
    open.name = cleanName(name, `Player ${room.seats.indexOf(open) + 1}`);
    this.attach(c, room);
  }

  /** Leave the current room. In the lobby the seat opens up; in a game the seat is kept for rejoining. */
  private leave(c: Client, quiet = false) {
    const room = c.room ? this.rooms.get(c.room) : undefined;
    c.room = null;
    if (!quiet) c.send({ t: 'left' });
    if (!room) return;
    // other tabs of the same player stay attached; only free the seat if this was a lobby
    if (room.status === 'lobby') {
      const seat = room.seats.find((s) => s.token === c.token);
      if (seat) {
        seat.token = null;
        seat.name = '';
        for (const other of this.clients.values()) if (other.token === c.token && other.room === room.code) other.room = null;
      }
      if (room.hostToken === c.token) {
        const next = room.seats.find((s) => s.token);
        if (!next) return this.deleteRoom(room);
        room.hostToken = next.token!;
      }
    }
    room.lastActive = this.now();
    this.broadcast(room);
  }

  private start(c: Client) {
    const room = this.roomOf(c);
    if (room.hostToken !== c.token) throw new RoomError('Only the host can start the game.');
    if (room.status !== 'lobby') throw new RoomError('The game has already started.');
    if (room.seats.some((s) => s.kind === 'human' && !s.token)) throw new RoomError('Wait until every human seat is filled, or switch empty seats to bots.');
    this.newGameIn(room);
  }

  private rematch(c: Client) {
    const room = this.roomOf(c);
    if (room.hostToken !== c.token) throw new RoomError('Only the host can start a rematch.');
    if (room.session?.state.phase !== 'gameover') throw new RoomError('Finish the current game first.');
    this.newGameIn(room);
  }

  private newGameIn(room: Room) {
    const seats: SeatConfig[] = room.seats.map((s) => ({ name: s.name, controller: s.kind }));
    const state = createGame(seats, Math.floor(this.random() * 2 ** 31) + 1);
    room.session = { state, turnStart: state, undoBlocked: false };
    room.status = 'playing';
    room.lastActive = this.now();
    this.broadcast(room);
    this.scheduleAi(room);
  }

  /** Host turns a seat into a Medium bot: fill an empty lobby seat, or replace someone who left mid-game. */
  private botify(c: Client, seatIndex: unknown) {
    const room = this.roomOf(c);
    if (room.hostToken !== c.token) throw new RoomError('Only the host can change seats.');
    const i = Number(seatIndex);
    const seat = room.seats[i];
    if (!seat || seat.kind !== 'human' || seat.token === room.hostToken) throw new RoomError('That seat cannot be given to a bot.');
    if (room.status === 'playing' && seat.token && this.connectedTokens(room).has(seat.token))
      throw new RoomError('That player is still connected.');
    seat.kind = 'medium';
    seat.token = null;
    seat.name = BOT_NAMES.medium;
    if (room.session) {
      for (const s of [room.session.state, room.session.turnStart]) {
        s.players[i].controller = 'medium';
        s.players[i].name = BOT_NAMES.medium;
      }
    }
    this.broadcast(room);
    this.scheduleAi(room);
  }

  // -------------------------------------------------------------------------
  // play

  private act(c: Client, action: unknown) {
    const room = this.roomOf(c);
    const session = this.sessionOf(room);
    const seat = room.seats.findIndex((s) => s.token === c.token);
    if (seat !== session.state.current) throw new RoomError("It isn't your turn.");
    if (!action || typeof action !== 'object') throw new RoomError('Malformed action.');
    this.apply(room, action as Action);
  }

  private undo(c: Client) {
    const room = this.roomOf(c);
    const session = this.sessionOf(room);
    const seat = room.seats.findIndex((s) => s.token === c.token);
    if (seat !== session.state.current) throw new RoomError("It isn't your turn.");
    if (session.undoBlocked) throw new RoomError('Undo is unavailable after drawing a face-down card.');
    if (session.state.phase === 'action') throw new RoomError('Nothing to undo yet.');
    session.state = session.turnStart;
    this.broadcast(room);
  }

  private apply(room: Room, action: Action) {
    const session = this.sessionOf(room);
    const prev = session.state;
    const state = applyAction(prev, action); // throws IllegalActionError with a readable reason
    if (state.log.length > MAX_LOG) state.log = state.log.slice(-MAX_LOG);
    const turnEnded = action.type === 'endTurn' || state.current !== prev.current;
    room.session = {
      state,
      turnStart: turnEnded ? state : session.turnStart,
      undoBlocked: turnEnded ? false : session.undoBlocked || (action.type === 'reserve' && action.source.kind === 'deck'),
    };
    room.lastActive = this.now();
    this.broadcast(room);
    this.scheduleAi(room);
  }

  private scheduleAi(room: Room) {
    if (room.aiTimer) clearTimeout(room.aiTimer);
    room.aiTimer = null;
    const s = room.session?.state;
    if (!s || s.phase === 'gameover' || s.players[s.current].controller === 'human') return;
    const delay = s.phase === 'confirm' ? Math.round(this.aiDelayMs * 0.6) : this.aiDelayMs;
    room.aiTimer = setTimeout(() => {
      room.aiTimer = null;
      if (!this.rooms.has(room.code) || room.session?.state !== s) return;
      this.apply(room, chooseAiAction(s, this.random));
    }, delay);
  }

  // -------------------------------------------------------------------------
  // views

  private attach(c: Client, room: Room) {
    c.room = room.code;
    room.lastActive = this.now();
    this.broadcast(room);
  }

  private broadcast(room: Room) {
    const connected = this.connectedTokens(room);
    for (const c of this.clients.values()) {
      if (c.room !== room.code) continue;
      c.send({ t: 'room', room: this.viewFor(room, c.token, connected) });
    }
  }

  private viewFor(room: Room, token: string | null, connected: Set<string>): RoomView {
    const you = room.seats.findIndex((s) => s.token !== null && s.token === token);
    const session = room.session;
    const state = session && room.status === 'playing' ? redact(session.state, you >= 0 ? you : null) : null;
    return {
      code: room.code,
      status: room.status,
      you: you >= 0 ? you : null,
      seats: room.seats.map((s) => ({
        name: s.name,
        kind: s.kind,
        taken: s.kind !== 'human' || !!s.token,
        connected: s.kind !== 'human' || (!!s.token && connected.has(s.token)),
        isHost: !!s.token && s.token === room.hostToken,
      })),
      state,
      canUndo:
        !!session &&
        you === session.state.current &&
        !session.undoBlocked &&
        session.state.phase !== 'action' &&
        session.state.phase !== 'gameover',
    };
  }

  private connectedTokens(room: Room): Set<string> {
    const set = new Set<string>();
    for (const c of this.clients.values()) if (c.room === room.code && c.token) set.add(c.token);
    return set;
  }

  // -------------------------------------------------------------------------
  // helpers

  private roomOf(c: Client): Room {
    const room = c.room ? this.rooms.get(c.room) : undefined;
    if (!room) throw new RoomError('You are not in a room.');
    return room;
  }

  private sessionOf(room: Room): Session {
    if (room.status !== 'playing' || !room.session) throw new RoomError('The game has not started yet.');
    return room.session;
  }

  private deleteRoom(room: Room) {
    if (room.aiTimer) clearTimeout(room.aiTimer);
    this.rooms.delete(room.code);
    for (const c of this.clients.values()) if (c.room === room.code) c.room = null;
  }

  private newCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[Math.floor(this.random() * ROOM_CODE_ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
  }
}

class RoomError extends Error {}

function cleanName(name: unknown, fallback: string): string {
  const s = typeof name === 'string' ? name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_NAME_LENGTH) : '';
  return s || fallback;
}

/**
 * The state as one seat may see it: other players' face-down reserved cards become
 * `hidden:<tier>`, deck order is replaced by placeholders (counts stay), and the RNG state is
 * dropped. Once the game is over everything is revealed.
 */
export function redact(state: GameState, seat: number | null): GameState {
  if (state.phase === 'gameover') return state;
  const s: GameState = structuredClone(state);
  s.players.forEach((p, i) => {
    if (i === seat) return;
    p.reserved = p.reserved.map((r) => (r.hidden ? { cardId: `${HIDDEN_PREFIX}${getCard(r.cardId).tier}`, hidden: true } : r));
  });
  s.decks = s.decks.map((d) => d.map(() => DECK_PLACEHOLDER)) as GameState['decks'];
  s.rngState = 0;
  return s;
}
