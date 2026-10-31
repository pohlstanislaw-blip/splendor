// Static balance summary of src/engine/data.json: design rules, colour spread, cost-per-point,
// and how the data differs from the reference list in data/cards.csv.
// For play-tested numbers run `npm run simulate`.
import { readFileSync } from 'node:fs';
import { CARDS, PATRONS, TIER_NAMES } from '../src/engine/data';
import { cardShape, checkDesignRules, colorCount, maxColor, ownShare, totalCost } from '../src/engine/designRules';
import { GEMS, type Tier } from '../src/engine/types';

for (const tier of [1, 2, 3] as Tier[]) {
  const cards = CARDS.filter((c) => c.tier === tier);
  console.log(`\nTier ${tier} · ${TIER_NAMES[tier]} — ${cards.length} cards`);
  console.log(`  bonus colours  ${GEMS.map((g) => `${g}:${cards.filter((c) => c.bonus === g).length}`).join('  ')}`);
  console.log(`  gem demand     ${GEMS.map((g) => `${g}:${cards.reduce((a, c) => a + (c.cost[g] ?? 0), 0)}`).join('  ')}`);
  console.log('  shape (same for every colour)          total  max  colours  own%  cost/pt');
  const seen = new Set<string>();
  for (const c of cards.filter((x) => x.bonus === GEMS[0])) {
    const shape = cardShape(c);
    if (seen.has(shape)) continue;
    seen.add(shape);
    const cpp = c.points ? (totalCost(c) / c.points).toFixed(2) : '—';
    console.log(
      `  ${shape.padEnd(38)} ${String(totalCost(c)).padStart(5)} ${String(maxColor(c)).padStart(4)} ${String(colorCount(c)).padStart(8)} ${String(Math.round(ownShare(c) * 100)).padStart(5)} ${cpp.padStart(8)}`,
    );
  }
}

console.log(`\nPatrons — ${PATRONS.length}`);
for (const p of PATRONS)
  console.log(`  ${p.name.padEnd(24)} ${p.title.padEnd(22)} ${Object.entries(p.requires).map(([g, n]) => `${n} ${g}`).join(' + ')}`);
console.log(`  demand per colour  ${GEMS.map((g) => `${g}:${PATRONS.reduce((a, p) => a + (p.requires[g] ?? 0), 0)}`).join('  ')}`);

// Difference from the reference CSV (compared per tier & colour as multisets of points+cost).
try {
  const MAP: Record<string, string> = { white: 'moonstone', blue: 'lapis', green: 'jade', red: 'garnet', black: 'obsidian' };
  const [header, ...lines] = readFileSync('data/cards.csv', 'utf8').trim().split(/\r?\n/);
  const cols = header.split(',');
  const key = (tier: number, bonus: string, pts: number, cost: Record<string, number>) =>
    `${tier}|${bonus}|${pts}|${GEMS.map((g) => cost[g] ?? 0).join(',')}`;
  const ref = new Map<string, number>();
  for (const l of lines) {
    const r = Object.fromEntries(l.split(',').map((v, i) => [cols[i], v]));
    const cost: Record<string, number> = {};
    for (const [c, g] of Object.entries(MAP)) cost[g] = Number(r[`cost_${c}`]);
    const k = key(Number(r.level), MAP[r.bonus_color], Number(r.points), cost);
    ref.set(k, (ref.get(k) ?? 0) + 1);
  }
  let same = 0;
  for (const c of CARDS) {
    const k = key(c.tier, c.bonus, c.points, c.cost as Record<string, number>);
    if (ref.get(k)) {
      same++;
      ref.set(k, ref.get(k)! - 1);
    }
  }
  console.log(`\nCompared with data/cards.csv: ${same} cards identical, ${CARDS.length - same} changed (see BALANCE.md).`);
} catch {
  /* reference CSV not present */
}

const problems = checkDesignRules(CARDS, PATRONS);
for (const p of problems) console.log(`  ⚠ ${p}`);
console.log(problems.length ? `\n${problems.length} design-rule violation(s).` : '\nAll design rules pass.');
process.exitCode = problems.length ? 1 : 0;
