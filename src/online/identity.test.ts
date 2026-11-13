import { describe, expect, it } from 'vitest';
import { adoptSeat, forgetRoom, forgetSeat, initialIdentity, rememberSeat, savedSeat, seatsToOffer, type KV, type Stores } from './identity';

function mem(): KV & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, get: (k) => data.get(k) ?? null, set: (k, v) => (v === null ? data.delete(k) : data.set(k, v)) as unknown as void };
}
/** One browser = shared localStorage; each tab = its own sessionStorage. */
function browser() {
  const local = mem();
  let n = 0;
  const tokens = () => `token_${String(++n).padStart(14, '0')}`;
  return { local, tab: (): Stores => ({ local, session: mem() }), tokens };
}

describe('online identity', () => {
  it('gives every new tab its own player, so a second tab can join as a new player', () => {
    const b = browser();
    const host = b.tab();
    const a = initialIdentity(host, null, b.tokens);
    rememberSeat(host, 'ROOMA', a.token, 'Host');
    const friendTab = b.tab();
    const f = initialIdentity(friendTab, 'ROOMA', b.tokens);
    expect(f.token).not.toBe(a.token);
    expect(f.rejoin).toBeNull();
  });

  it('keeps the same player across a refresh of the same tab', () => {
    const b = browser();
    const tab = b.tab();
    const first = initialIdentity(tab, null, b.tokens);
    rememberSeat(tab, 'ROOMA', first.token, 'Host');
    expect(initialIdentity(tab, 'ROOMA', b.tokens)).toEqual({ token: first.token, rejoin: 'ROOMA' });
  });

  it('puts you back in your seat when you come back without an invite link', () => {
    const b = browser();
    const old = b.tab();
    const id = initialIdentity(old, null, b.tokens);
    rememberSeat(old, 'ROOMA', id.token, 'Host');
    const later = b.tab(); // tab was closed, site opened again
    expect(initialIdentity(later, null, b.tokens)).toEqual({ token: id.token, rejoin: 'ROOMA' });
  });

  it('offers "rejoin as" when an invite link points at a room this browser already sits in', () => {
    const b = browser();
    const host = b.tab();
    const id = initialIdentity(host, null, b.tokens);
    rememberSeat(host, 'ROOMA', id.token, 'Host');
    const tab2 = b.tab();
    const t2 = initialIdentity(tab2, 'ROOMA', b.tokens);
    expect(seatsToOffer(tab2, 'ROOMA', t2.token)).toMatchObject([{ code: 'ROOMA', name: 'Host' }]);
    expect(seatsToOffer(tab2, 'OTHER', t2.token)).toEqual([]);
    expect(seatsToOffer(host, 'ROOMA', id.token)).toEqual([]); // already that player
    adoptSeat(tab2, savedSeat(tab2)!);
    expect(initialIdentity(tab2, 'ROOMA', b.tokens)).toEqual({ token: id.token, rejoin: 'ROOMA' });
  });

  it('remembers every seat this browser chose, latest first, and offers each on an invite link', () => {
    const b = browser();
    const host = b.tab();
    const h = initialIdentity(host, null, b.tokens);
    rememberSeat(host, 'ROOMA', h.token, 'Host');
    const friend = b.tab();
    const f = initialIdentity(friend, 'ROOMA', b.tokens);
    rememberSeat(friend, 'ROOMA', f.token, 'Friend');
    const third = b.tab();
    const t = initialIdentity(third, 'ROOMA', b.tokens);
    expect(seatsToOffer(third, 'ROOMA', t.token).map((s) => s.name)).toEqual(['Friend', 'Host']);
    // coming back without a link takes the latest chosen seat
    expect(initialIdentity(b.tab(), null, b.tokens)).toEqual({ token: f.token, rejoin: 'ROOMA' });
    forgetRoom(third, 'ROOMA');
    expect(seatsToOffer(third, 'ROOMA', t.token)).toEqual([]);
  });

  it('forgets the seat on leaving', () => {
    const b = browser();
    const tab = b.tab();
    const id = initialIdentity(tab, null, b.tokens);
    rememberSeat(tab, 'ROOMA', id.token, 'Host');
    forgetSeat(tab, 'ROOMA', id.token);
    expect(savedSeat(tab)).toBeNull();
    expect(initialIdentity(b.tab(), null, b.tokens).rejoin).toBeNull();
  });

  it('carries over the identity saved by the previous version', () => {
    const b = browser();
    b.local.set('facets-online-token', 'oldtoken_0123456789');
    b.local.set('facets-online-room', 'ROOMB');
    b.local.set('facets-online-name', 'Ana');
    const id = initialIdentity(b.tab(), null, b.tokens);
    expect(id).toEqual({ token: 'oldtoken_0123456789', rejoin: 'ROOMB' });
    expect(b.local.get('facets-online-room')).toBeNull();
  });
});
