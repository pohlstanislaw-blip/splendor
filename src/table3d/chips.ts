// The game state only stores token COUNTS. To animate chips flying between piles each chip needs a
// stable identity, so we keep "chip i of gem g is at location L" and, when counts change, move as
// few chips as possible. Pure: unit-tested in layout.test.ts.

/** Location of a chip: 'supply' or a seat index as a string. */
export type ChipLocation = string;

/**
 * Returns the new location of every chip of one gem.
 * `prev[i]` is where chip i was; `counts` is how many chips each location must hold now.
 * Chips stay put where possible; surplus chips move to locations that are short.
 */
export function assignChips(prev: ChipLocation[] | undefined, counts: Record<ChipLocation, number>): ChipLocation[] {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const need: Record<ChipLocation, number> = { ...counts };
  const next: (ChipLocation | null)[] = Array.from({ length: total }, () => null);
  // 1. keep chips that are already somewhere that still needs them
  if (prev) {
    for (let i = 0; i < Math.min(prev.length, total); i++) {
      const loc = prev[i];
      if ((need[loc] ?? 0) > 0) {
        next[i] = loc;
        need[loc]--;
      }
    }
  }
  // 2. hand the rest to whoever is short, in a stable order
  const short = Object.keys(need).sort();
  for (let i = 0; i < total; i++) {
    if (next[i] !== null) continue;
    const loc = short.find((l) => need[l] > 0)!;
    next[i] = loc;
    need[loc]--;
  }
  return next as ChipLocation[];
}

/** Position of chip `i` inside its pile: its rank among the chips at the same location. */
export function stackIndex(locations: ChipLocation[], i: number): number {
  let rank = 0;
  for (let k = 0; k < i; k++) if (locations[k] === locations[i]) rank++;
  return rank;
}
