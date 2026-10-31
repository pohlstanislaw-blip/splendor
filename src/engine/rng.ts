/** Small seeded PRNG (mulberry32). State is a plain number so it serializes with the game. */
export function nextRandom(state: number): [number, number] {
  let t = (state + 0x6d2b79f5) | 0;
  const newState = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, newState];
}

export function shuffle<T>(items: readonly T[], state: number): [T[], number] {
  const arr = items.slice();
  let s = state;
  for (let i = arr.length - 1; i > 0; i--) {
    const [r, ns] = nextRandom(s);
    s = ns;
    const j = Math.floor(r * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return [arr, s];
}

export function randomInt(max: number, state: number): [number, number] {
  const [r, s] = nextRandom(state);
  return [Math.floor(r * max), s];
}
