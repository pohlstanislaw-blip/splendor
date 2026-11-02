// Turning a shared game state into one player's point of view (online play).
import type { GameState } from '../engine';

/** Seat indices in turn order starting with `you` (you first, then whoever plays after you). */
export function seatOrderFrom(playerCount: number, you: number | null): number[] {
  const start = you ?? 0;
  return Array.from({ length: playerCount }, (_, k) => (start + k) % playerCount);
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Rewrites a log line so the viewer's own name reads as "you":
 * "Ana took 2 Jade." → "You took 2 Jade.", "Lady Thane visits Ana" → "Lady Thane visits you".
 */
export function personalizeLog(text: string, myName: string | null): string {
  if (!myName) return text;
  const name = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(myName)}(?=$|[^\\p{L}\\p{N}])`, 'gu');
  let out = text.replace(name, (_m, pre: string) => `${pre}you`);
  if (out === text) return text;
  // capitalise "you" at the start of a sentence or a list, then fix verb agreement
  out = out
    .replace(/(^|\. |: )you\b/g, (_m, pre: string) => `${pre}You`)
    .replace(/\bYou wins!/, 'You win!')
    .replace(/\bYou goes first\b/, 'You go first');
  return out;
}

/** "1st", "2nd", … for result lines. */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** The viewer's finishing place (1-based, ties share a place) in a finished game. */
export function placeOf(state: GameState, seat: number, score: (i: number) => [number, number]): number {
  const [pts, cards] = score(seat);
  let better = 0;
  state.players.forEach((_, i) => {
    const [p, c] = score(i);
    if (p > pts || (p === pts && c < cards)) better++;
  });
  return better + 1;
}
