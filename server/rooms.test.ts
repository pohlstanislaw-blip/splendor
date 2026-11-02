import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { CARDS } from '../src/engine/data';
import type { RoomView, ServerMsg } from '../src/online/protocol';
import { startServer } from './index';
import { RoomManager, redact } from './rooms';

/** A fake client: records messages, exposes its latest room view. */
function client(rm: RoomManager, id: string, token = `tok_${id}_0123456789abcdef`) {
  const inbox: ServerMsg[] = [];
  rm.connect(id, (m) => inbox.push(structuredClone(m)));
  rm.handle(id, { t: 'hello', token });
  return {
    inbox,
    send: (m: unknown) => rm.handle(id, m),
    room: (): RoomView => {
      const r = [...inbox].reverse().find((m) => m.t === 'room');
      if (!r || r.t !== 'room') throw new Error('no room yet');
      return r.room;
    },
    lastError: () => [...inbox].reverse().find((m) => m.t === 'error') as { message: string } | undefined,
  };
}

let seed = 1;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

describe('rooms', () => {
  beforeEach(() => {
    seed = 1;
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  function twoHumans() {
    const rm = new RoomManager({ aiDelayMs: 10, random: rand });
    const a = client(rm, 'a');
    const b = client(rm, 'b');
    a.send({ t: 'create', name: 'Ana', seats: ['human', 'human'] });
    const code = a.room().code;
    b.send({ t: 'join', code: code.toLowerCase(), name: 'Ben' });
    return { rm, a, b, code };
  }

  it('creates a room and lets a second player join by code', () => {
    const { a, b, code } = twoHumans();
    expect(code).toMatch(/^[A-Z0-9]{5}$/);
    expect(a.room().seats.map((s) => s.name)).toEqual(['Ana', 'Ben']);
    expect(a.room().you).toBe(0);
    expect(b.room().you).toBe(1);
    expect(a.room().seats[0].isHost).toBe(true);
    expect(b.room().status).toBe('lobby');
  });

  it('rejects unknown codes, full rooms, and joining after start', () => {
    const { rm, a } = twoHumans();
    const c = client(rm, 'c');
    c.send({ t: 'join', code: 'ZZZZZ', name: 'Cy' });
    expect(c.lastError()?.message).toMatch(/No room/);
    c.send({ t: 'join', code: a.room().code, name: 'Cy' });
    expect(c.lastError()?.message).toMatch(/full/);
  });

  it('only the host starts, and only when human seats are filled', () => {
    const rm = new RoomManager({ aiDelayMs: 10, random: rand });
    const a = client(rm, 'a');
    a.send({ t: 'create', name: 'Ana', seats: ['human', 'human', 'easy'] });
    a.send({ t: 'start' });
    expect(a.lastError()?.message).toMatch(/every human seat/);
    const b = client(rm, 'b');
    b.send({ t: 'join', code: a.room().code, name: 'Ben' });
    b.send({ t: 'start' });
    expect(b.lastError()?.message).toMatch(/Only the host/);
    a.send({ t: 'start' });
    expect(a.room().status).toBe('playing');
    expect(b.room().state!.players.map((p) => p.name)).toEqual(['Ana', 'Ben', 'Bot (Easy)']);
  });

  it('only the current player may act, and moves reach everyone', () => {
    const { a, b } = twoHumans();
    a.send({ t: 'start' });
    const s = a.room().state!;
    const [mover, waiter] = s.current === 0 ? [a, b] : [b, a];
    waiter.send({ t: 'action', action: { type: 'take2', gem: 'jade' } });
    expect(waiter.lastError()?.message).toMatch(/isn't your turn/);
    mover.send({ t: 'action', action: { type: 'take2', gem: 'jade' } });
    expect(waiter.room().state!.supply.jade).toBe(2);
    expect(waiter.room().state!.phase).toBe('confirm');
    mover.send({ t: 'action', action: { type: 'take2', gem: 'lapis' } }); // second action is illegal
    expect(mover.lastError()?.message).toMatch(/already took your action/);
    mover.send({ t: 'action', action: { type: 'endTurn' } });
    expect(waiter.room().state!.current).toBe(1 - s.current);
  });

  it('supports undo before ending the turn, but not after a blind draw', () => {
    const { a, b } = twoHumans();
    a.send({ t: 'start' });
    const mover = a.room().state!.current === 0 ? a : b;
    mover.send({ t: 'action', action: { type: 'take3', gems: ['garnet', 'lapis', 'jade'] } });
    expect(mover.room().canUndo).toBe(true);
    mover.send({ t: 'undo' });
    expect(mover.room().state!.phase).toBe('action');
    expect(mover.room().state!.supply.garnet).toBe(4);
    mover.send({ t: 'action', action: { type: 'reserve', source: { kind: 'deck', tier: 1 } } });
    expect(mover.room().canUndo).toBe(false);
    mover.send({ t: 'undo' });
    expect(mover.lastError()?.message).toMatch(/face-down/);
  });

  it("hides other players' face-down cards and the deck order", () => {
    const { a, b } = twoHumans();
    a.send({ t: 'start' });
    const moverIdx = a.room().state!.current;
    const [mover, other] = moverIdx === 0 ? [a, b] : [b, a];
    mover.send({ t: 'action', action: { type: 'reserve', source: { kind: 'deck', tier: 3 } } });
    const mine = mover.room().state!.players[moverIdx].reserved[0];
    const theirs = other.room().state!.players[moverIdx].reserved[0];
    expect(CARDS.some((c) => c.id === mine.cardId)).toBe(true);
    expect(theirs).toEqual({ cardId: 'hidden:3', hidden: true });
    expect(other.room().state!.decks[0].every((x) => x === '?')).toBe(true);
    expect(other.room().state!.decks[2]).toHaveLength(15);
    expect(JSON.stringify(other.room())).not.toContain(mine.cardId);
  });

  it('plays AI seats on the server', async () => {
    const rm = new RoomManager({ aiDelayMs: 5, random: rand });
    const a = client(rm, 'a');
    a.send({ t: 'create', name: 'Ana', seats: ['human', 'medium'] });
    a.send({ t: 'start' });
    // let the bot move until it's the human's turn
    for (let i = 0; i < 20 && a.room().state!.current !== 0; i++) await vi.advanceTimersByTimeAsync(10);
    expect(a.room().state!.current).toBe(0);
    // human moves; the bot answers by itself
    a.send({ t: 'action', action: { type: 'take3', gems: ['garnet', 'lapis', 'jade'] } });
    a.send({ t: 'action', action: { type: 'endTurn' } });
    expect(a.room().state!.current).toBe(1);
    for (let i = 0; i < 20 && a.room().state!.current !== 0; i++) await vi.advanceTimersByTimeAsync(10);
    expect(a.room().state!.current).toBe(0);
    expect(a.room().state!.log.some((l) => l.text.startsWith('Bot (Medium)'))).toBe(true);
  });

  it('keeps your seat across a reconnect and lets the host replace a player who left', () => {
    const { rm, a, b, code } = twoHumans();
    a.send({ t: 'start' });
    rm.disconnect('b');
    expect(a.room().seats[1].connected).toBe(false);
    const b2 = client(rm, 'b2', 'tok_b_0123456789abcdef'); // same token, new connection
    b2.send({ t: 'join', code, name: 'whatever' });
    expect(b2.room().you).toBe(1);
    expect(a.room().seats[1].connected).toBe(true);
    a.send({ t: 'botify', seat: 1 });
    expect(a.lastError()?.message).toMatch(/still connected/);
    rm.disconnect('b2');
    a.send({ t: 'botify', seat: 1 });
    expect(a.room().seats[1].kind).toBe('medium');
    expect(a.room().state!.players[1].controller).toBe('medium');
    void b;
  });

  it('frees lobby seats on leave and hands the host role on', () => {
    const { a, b } = twoHumans();
    a.send({ t: 'leave' });
    expect(b.room().seats[0].taken).toBe(false);
    expect(b.room().seats[1].isHost).toBe(true);
  });

  it('keeps names unique within a room', () => {
    const rm = new RoomManager({ aiDelayMs: 10, random: rand });
    const a = client(rm, 'a');
    a.send({ t: 'create', name: 'Ana', seats: ['human', 'human', 'medium', 'medium'] });
    const b = client(rm, 'b');
    b.send({ t: 'join', code: a.room().code, name: 'ana' });
    const names = b.room().seats.map((s) => s.name);
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(4);
    expect(names[1]).toBe('ana 2');
  });

  it('ignores malformed messages', () => {
    const rm = new RoomManager();
    const a = client(rm, 'a');
    a.send(null);
    a.send({ t: 42 });
    a.send({ t: 'create', name: 'x', seats: ['medium', 'human'] });
    expect(a.lastError()?.message).toMatch(/must be human/);
    a.send({ t: 'create', name: 'x', seats: ['human', 'robot'] });
    expect(a.lastError()?.message).toMatch(/Unknown seat/);
  });

  it('reveals everything once the game is over', () => {
    const { a } = twoHumans();
    a.send({ t: 'start' });
    const s = structuredClone(a.room().state!);
    s.phase = 'gameover';
    expect(redact(s, 0)).toBe(s);
  });
});

describe('server end to end', () => {
  it('two browsers create, join, start and play over WebSocket', async () => {
    const srv = startServer(0, { quiet: true, aiDelayMs: 5 });
    await new Promise((r) => srv.http.once('listening', r));
    const port = (srv.http.address() as { port: number }).port;
    const open = (token: string) =>
      new Promise<{ ws: WebSocket; next: (pred: (m: ServerMsg) => boolean) => Promise<ServerMsg> }>((resolve) => {
        const ws = new WebSocket(`ws://localhost:${port}/ws`);
        const msgs: ServerMsg[] = [];
        const waiters: { pred: (m: ServerMsg) => boolean; done: (m: ServerMsg) => void }[] = [];
        ws.on('message', (d) => {
          const m = JSON.parse(String(d)) as ServerMsg;
          msgs.push(m);
          for (const w of [...waiters]) if (w.pred(m)) (waiters.splice(waiters.indexOf(w), 1), w.done(m));
        });
        ws.on('open', () => {
          ws.send(JSON.stringify({ t: 'hello', token }));
          resolve({
            ws,
            next: (pred) =>
              new Promise((done) => {
                const hit = msgs.find(pred);
                if (hit) return done(hit);
                waiters.push({ pred, done });
              }),
          });
        });
      });
    try {
      const a = await open('tok_alpha_0123456789');
      a.ws.send(JSON.stringify({ t: 'create', name: 'Ana', seats: ['human', 'human'] }));
      const created = (await a.next((m) => m.t === 'room')) as Extract<ServerMsg, { t: 'room' }>;
      const b = await open('tok_bravo_0123456789');
      b.ws.send(JSON.stringify({ t: 'join', code: created.room.code, name: 'Ben' }));
      await b.next((m) => m.t === 'room' && m.room.you === 1);
      a.ws.send(JSON.stringify({ t: 'start' }));
      const started = (await b.next((m) => m.t === 'room' && m.room.status === 'playing')) as Extract<ServerMsg, { t: 'room' }>;
      const mover = started.room.state!.current === 0 ? a : b;
      mover.ws.send(JSON.stringify({ t: 'action', action: { type: 'take2', gem: 'moonstone' } }));
      const seen = await (mover === a ? b : a).next((m) => m.t === 'room' && m.room.state?.supply.moonstone === 2);
      expect(seen.t).toBe('room');

      const health = await fetch(`http://localhost:${port}/healthz`).then((r) => r.json());
      expect(health).toEqual({ ok: true, rooms: 1 });
      a.ws.close();
      b.ws.close();
    } finally {
      await srv.close();
    }
  });
});
