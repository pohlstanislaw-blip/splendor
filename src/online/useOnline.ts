import { useCallback, useEffect, useRef, useState } from 'react';
import type { Action } from '../engine';
import { normalizeCode, type ClientMsg, type RoomView, type SeatKind, type ServerMsg } from './protocol';

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'unavailable';

const TOKEN_KEY = 'facets-online-token';
const ROOM_KEY = 'facets-online-room';
const NAME_KEY = 'facets-online-name';

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function storageSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

/** A random id that identifies this browser as a player across reconnects. */
function playerToken(): string {
  let t = storageGet(TOKEN_KEY);
  if (!t || !/^[A-Za-z0-9_-]{16,64}$/.test(t)) {
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    t = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    storageSet(TOKEN_KEY, t);
  }
  return t;
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
      sock.send(JSON.stringify({ t: 'hello', token: playerToken() } satisfies ClientMsg));
      const saved = storageGet(ROOM_KEY);
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
        storageSet(ROOM_KEY, msg.room.code);
      } else if (msg.t === 'left') {
        inRoom.current = false;
        setRoom(null);
        storageSet(ROOM_KEY, null);
      } else if (msg.t === 'error') {
        setError(msg.message);
        // a saved room that no longer exists (server restarted): forget it quietly
        if (/^No room/.test(msg.message) && !inRoom.current) storageSet(ROOM_KEY, null);
      }
    };
    sock.onclose = () => {
      if (ws.current !== sock) return;
      ws.current = null;
      if (closing.current) return setStatus('idle');
      if (!everOpened.current) return setStatus('unavailable');
      // dropped: reconnect with backoff while we still belong to a room
      if (!storageGet(ROOM_KEY)) return setStatus('idle');
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

  // Rejoin automatically after a refresh if this browser was in a room.
  useEffect(() => {
    if (storageGet(ROOM_KEY)) connect();
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
      send({ t: 'create', name, seats });
    },
    join: (code: string, name: string) => {
      setName(name);
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
      storageSet(ROOM_KEY, null);
    },
  };
}

export type OnlineApi = ReturnType<typeof useOnline>;
