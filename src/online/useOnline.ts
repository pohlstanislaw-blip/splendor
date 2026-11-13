import { useCallback, useEffect, useRef, useState } from 'react';
import type { Action } from '../engine';
import { adoptSeat, browserStores, forgetRoom, forgetSeat, initialIdentity, rememberSeat, seatsToOffer, type Seat } from './identity';
import { normalizeCode, type ClientMsg, type RoomView, type SeatKind, type ServerMsg } from './protocol';

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'unavailable';

const NAME_KEY = 'facets-online-name';

function storageGet(key: string): string | null {
  return browserStores.local.get(key);
}
function storageSet(key: string, value: string | null) {
  browserStores.local.set(key, value);
}

export function savedName(): string {
  return storageGet(NAME_KEY) ?? '';
}

function socketUrl() {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
}

/** Invite code from the page address (`?room=ABCDE`), if any. */
export function inviteCodeFromUrl(): string | null {
  try {
    const code = new URLSearchParams(location.search).get('room');
    return code ? normalizeCode(code) : null;
  } catch {
    return null;
  }
}

export function inviteLink(code: string): string {
  return `${location.origin}${location.pathname}?room=${code}`;
}

export function useOnline() {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [room, setRoom] = useState<RoomView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const queue = useRef<ClientMsg[]>([]);
  const everOpened = useRef(false);
  const retry = useRef<{ timer?: number; attempt: number }>({ attempt: 0 });
  const closing = useRef(false);
  const inRoom = useRef(false);
  // this tab's player identity (see identity.ts), decided once per page load
  const identity = useRef<{ token: string; rejoin: string | null } | null>(null);
  identity.current ??= initialIdentity(browserStores, inviteCodeFromUrl());
  /** set when this tab asks for a seat (create / join / rejoin): the next room update is remembered as "my seat" */
  const claiming = useRef(false);
  const [offers, setOffers] = useState<Seat[]>(() => seatsToOffer(browserStores, inviteCodeFromUrl(), identity.current!.token));

  const connect = useCallback(() => {
    const cur = ws.current;
    if (cur && (cur.readyState === WebSocket.OPEN || cur.readyState === WebSocket.CONNECTING)) return;
    closing.current = false;
    let sock: WebSocket;
    try {
      sock = new WebSocket(socketUrl());
    } catch {
      setStatus('unavailable');
      return;
    }
    ws.current = sock;
    setStatus(everOpened.current ? 'reconnecting' : 'connecting');

    sock.onopen = () => {
      everOpened.current = true;
      retry.current.attempt = 0;
      setStatus('open');
      sock.send(JSON.stringify({ t: 'hello', token: identity.current!.token } satisfies ClientMsg));
      const saved = identity.current!.rejoin;
      const queued = queue.current.splice(0);
      // rejoin the saved room unless this batch already joins/creates one
      if (saved && !queued.some((m) => m.t === 'join' || m.t === 'create'))
        sock.send(JSON.stringify({ t: 'join', code: saved, name: savedName() } satisfies ClientMsg));
      for (const m of queued) sock.send(JSON.stringify(m));
    };
    sock.onmessage = (ev) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (msg.t === 'room') {
        inRoom.current = true;
        setRoom(msg.room);
        const me = msg.room.you !== null ? msg.room.seats[msg.room.you].name : '';
        identity.current!.rejoin = msg.room.code;
        // Only a seat this tab just asked for becomes the browser's remembered seat; routine
        // updates in other open tabs must not overwrite it.
        if (claiming.current) {
          claiming.current = false;
          rememberSeat(browserStores, msg.room.code, identity.current!.token, me);
        } else {
          adoptSeat(browserStores, { code: msg.room.code, token: identity.current!.token, name: me });
        }
        setOffers([]);
      } else if (msg.t === 'left') {
        inRoom.current = false;
        setRoom(null);
        forgetSeat(browserStores, identity.current!.rejoin, identity.current!.token);
        identity.current!.rejoin = null;
      } else if (msg.t === 'error') {
        // a saved room that no longer exists (the server restarted): forget it quietly
        if (/^No room/.test(msg.message) && !inRoom.current && identity.current!.rejoin) {
          forgetRoom(browserStores, identity.current!.rejoin);
          identity.current!.rejoin = null;
          setOffers([]);
          if (!queue.current.length) return;
        }
        setError(msg.message);
      }
    };
    sock.onclose = () => {
      if (ws.current !== sock) return;
      ws.current = null;
      if (closing.current) return setStatus('idle');
      if (!everOpened.current) return setStatus('unavailable');
      // dropped: reconnect with backoff while we still belong to a room
      if (!identity.current!.rejoin) return setStatus('idle');
      setStatus('reconnecting');
      const wait = Math.min(10_000, 1000 * 2 ** retry.current.attempt++);
      retry.current.timer = window.setTimeout(connect, wait);
    };
  }, []);

  const send = useCallback(
    (msg: ClientMsg) => {
      const sock = ws.current;
      setError(null);
      if (sock && sock.readyState === WebSocket.OPEN) sock.send(JSON.stringify(msg));
      else {
        queue.current.push(msg);
        connect();
      }
    },
    [connect],
  );

  // Rejoin automatically after a refresh, or when coming back to the site.
  useEffect(() => {
    if (identity.current!.rejoin) connect();
    return () => {
      closing.current = true;
      window.clearTimeout(retry.current.timer);
      ws.current?.close();
    };
  }, [connect]);

  const setName = (name: string) => storageSet(NAME_KEY, name);

  return {
    status,
    room,
    error,
    clearError: () => setError(null),
    connect,
    create: (name: string, seats: SeatKind[]) => {
      setName(name);
      claiming.current = true;
      send({ t: 'create', name, seats });
    },
    join: (code: string, name: string) => {
      setName(name);
      claiming.current = true;
      send({ t: 'join', code: normalizeCode(code), name });
    },
    start: () => send({ t: 'start' }),
    act: (action: Action) => send({ t: 'action', action }),
    undo: () => send({ t: 'undo' }),
    rematch: () => send({ t: 'rematch' }),
    botify: (seat: number) => send({ t: 'botify', seat }),
    leave: () => {
      send({ t: 'leave' });
      inRoom.current = false;
      setRoom(null);
      forgetSeat(browserStores, identity.current!.rejoin, identity.current!.token);
      identity.current!.rejoin = null;
    },
    /** seats this browser already has in the invited room (other tabs or earlier visits) */
    offers,
    /** take that seat in this tab instead of joining as a new player */
    rejoinAs: (seat: Seat) => {
      adoptSeat(browserStores, seat);
      identity.current = { token: seat.token, rejoin: seat.code };
      claiming.current = true;
      setOffers([]);
      const sock = ws.current;
      if (sock && sock.readyState === WebSocket.OPEN) {
        sock.send(JSON.stringify({ t: 'hello', token: seat.token } satisfies ClientMsg));
        sock.send(JSON.stringify({ t: 'join', code: seat.code, name: seat.name } satisfies ClientMsg));
      } else connect();
    },
  };
}

export type OnlineApi = ReturnType<typeof useOnline>;
