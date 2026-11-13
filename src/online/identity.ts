// Who this browser tab is, as an online player.
//
// - Each TAB is its own player: its token lives in sessionStorage (kept across a refresh, new for
//   every new tab or window). So a friend on the same computer, or a second tab, can join a room
//   from an invite link as a separate player.
// - The browser also remembers the seats it chose (create / join / rejoin) in localStorage, most
//   recent first. Opening the site again without an invite link, after closing the tab, puts you
//   back in the most recent one.
// - Opening an invite link for a room this browser already has seats in lets the player choose:
//   rejoin as one of them, or join as a new player (see `seatsToOffer`).

export interface KV {
  get(key: string): string | null;
  set(key: string, value: string | null): void;
}
export interface Stores {
  local: KV;
  session: KV;
}
export interface Seat {
  code: string;
  token: string;
  name: string;
}

const TAB_TOKEN = 'facets-online-token';
const TAB_ROOM = 'facets-online-room';
const SEATS = 'facets-online-seats';
const MAX_SEATS = 8;
// version 1 kept one token and room per browser in localStorage
const OLD_TOKEN = 'facets-online-token';
const OLD_ROOM = 'facets-online-room';
const NAME = 'facets-online-name';

export const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

export function newToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Seats this browser chose, most recent first. */
export function savedSeats(stores: Stores): Seat[] {
  try {
    const list = JSON.parse(stores.local.get(SEATS) ?? '[]') as Seat[];
    return Array.isArray(list) ? list.filter((s) => s && typeof s.code === 'string' && TOKEN_RE.test(s.token)) : [];
  } catch {
    return [];
  }
}
export function savedSeat(stores: Stores): Seat | null {
  return savedSeats(stores)[0] ?? null;
}
function writeSeats(stores: Stores, list: Seat[]) {
  stores.local.set(SEATS, list.length ? JSON.stringify(list.slice(0, MAX_SEATS)) : null);
}

/** Decide this tab's player token, and which room (if any) to rejoin automatically. */
export function initialIdentity(stores: Stores, invite: string | null, make: () => string = newToken): { token: string; rejoin: string | null } {
  // move the version-1 per-browser identity into the remembered seat
  const oldToken = stores.local.get(OLD_TOKEN);
  const oldRoom = stores.local.get(OLD_ROOM);
  if (oldToken && TOKEN_RE.test(oldToken) && oldRoom && !savedSeat(stores)) {
    writeSeats(stores, [{ code: oldRoom, token: oldToken, name: stores.local.get(NAME) ?? '' }]);
  }
  if (oldToken || oldRoom) {
    stores.local.set(OLD_TOKEN, null);
    stores.local.set(OLD_ROOM, null);
  }

  const tabToken = stores.session.get(TAB_TOKEN);
  if (tabToken && TOKEN_RE.test(tabToken)) return { token: tabToken, rejoin: stores.session.get(TAB_ROOM) };

  const seat = savedSeat(stores);
  if (!invite && seat) {
    // came back to the site (not via an invite link): take your old seat again
    stores.session.set(TAB_TOKEN, seat.token);
    stores.session.set(TAB_ROOM, seat.code);
    return { token: seat.token, rejoin: seat.code };
  }
  const token = make();
  stores.session.set(TAB_TOKEN, token);
  return { token, rejoin: null };
}

/** This tab chose to sit in `code`: remember it for this tab and as the browser's latest seat. */
export function rememberSeat(stores: Stores, code: string, token: string, name: string) {
  stores.session.set(TAB_TOKEN, token);
  stores.session.set(TAB_ROOM, code);
  writeSeats(stores, [{ code, token, name }, ...savedSeats(stores).filter((s) => s.token !== token)]);
}

/** This tab left its seat (or the room no longer exists). */
export function forgetSeat(stores: Stores, code: string | null, token: string) {
  stores.session.set(TAB_ROOM, null);
  writeSeats(stores, savedSeats(stores).filter((s) => s.token !== token && (code === null || s.code !== code || s.token !== token)));
}

/** A room that no longer exists: forget every seat in it. */
export function forgetRoom(stores: Stores, code: string) {
  writeSeats(stores, savedSeats(stores).filter((s) => s.code !== code));
}

/** Switch this tab to an earlier seat's identity (the "Rejoin as …" choice). */
export function adoptSeat(stores: Stores, seat: Seat) {
  stores.session.set(TAB_TOKEN, seat.token);
  stores.session.set(TAB_ROOM, seat.code);
}

/**
 * When opening an invite link for a room this browser already has seats in (other tabs or earlier
 * visits), offer to rejoin as one of them instead of joining as a new player.
 */
export function seatsToOffer(stores: Stores, inviteCode: string | null, tabToken: string): Seat[] {
  if (!inviteCode) return [];
  return savedSeats(stores).filter((s) => s.code === inviteCode && s.token !== tabToken);
}

/** The real browser stores, tolerating blocked storage. */
function kv(get: () => Storage): KV {
  return {
    get: (k) => {
      try {
        return get().getItem(k);
      } catch {
        return null;
      }
    },
    set: (k, v) => {
      try {
        if (v === null) get().removeItem(k);
        else get().setItem(k, v);
      } catch {
        /* storage unavailable */
      }
    },
  };
}
export const browserStores: Stores = { local: kv(() => localStorage), session: kv(() => sessionStorage) };
