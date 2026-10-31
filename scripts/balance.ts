// Prints a balance summary of the Facets card data: color distribution and point-to-cost ratios.
import { CARDS, PATRONS } from '../src/engine/data';
import { GEMS, type Card } from '../src/engine/types';

const total = (c: Card) => Object.values(c.cost).reduce((a, b) => a + (b ?? 0), 0);
const maxColor = (c: Card) => Math.max(...Object.values(c.cost).map((v) => v ?? 0));
const concentration = (c: Card) => maxColor(c) / total(c);
let problems = 0;
const warn = (msg: string) => { problems++; console.log(`  ⚠ ${msg}`); };

const spec = { 1: { n: 40, pts: [0, 1], cost: [3, 5] }, 2: { n: 30, pts: [1, 3], cost: [5, 8] }, 3: { n: 20, pts: [3, 5], cost: [7, 14] } } as const;

for (const tier of [1, 2, 3] as const) {
  const cards = CARDS.filter((c) => c.tier === tier);
  const s = spec[tier];
  console.log(`\nTier ${tier} — ${cards.length} cards`);
  if (cards.length !== s.n) warn(`expected ${s.n} cards`);

  // color distribution: bonus colors and how much of each gem the tier demands
  const bonusLine = GEMS.map((g) => `${g}:${cards.filter((c) => c.bonus === g).length}`).join('  ');
  const demandLine = GEMS.map((g) => `${g}:${cards.reduce((a, c) => a + (c.cost[g] ?? 0), 0)}`).join('  ');
  console.log(`  bonus colors  ${bonusLine}`);
  console.log(`  gem demand    ${demandLine}`);
  const perColor = s.n / 5;
  for (const g of GEMS) if (cards.filter((c) => c.bonus === g).length !== perColor) warn(`${g} should have ${perColor} cards`);
  const demands = GEMS.map((g) => cards.reduce((a, c) => a + (c.cost[g] ?? 0), 0));
  if (Math.max(...demands) - Math.min(...demands) > 0) warn('gem demand is uneven across colors');

  // points vs cost
  console.log('  pts | cards | avg cost | avg concentration | cost per point');
  const byPts = new Map<number, Card[]>();
  for (const c of cards) byPts.set(c.points, [...(byPts.get(c.points) ?? []), c]);
  let prevCost = -1;
  let prevConc = -1;
  for (const pts of [...byPts.keys()].sort((a, b) => a - b)) {
    const group = byPts.get(pts)!;
    const avgCost = group.reduce((a, c) => a + total(c), 0) / group.length;
    const avgConc = group.reduce((a, c) => a + concentration(c), 0) / group.length;
    const cpp = pts ? (avgCost / pts).toFixed(2) : '—';
    console.log(`  ${String(pts).padStart(3)} | ${String(group.length).padStart(5)} | ${avgCost.toFixed(2).padStart(8)} | ${avgConc.toFixed(2).padStart(17)} | ${cpp}`);
    // higher points must be more expensive or more concentrated
    if (avgCost < prevCost && avgConc <= prevConc) warn(`${pts}-point cards are cheaper AND less concentrated than lower-point cards`);
    prevCost = avgCost;
    prevConc = avgConc;
  }
  for (const c of cards) {
    if (c.points < s.pts[0] || c.points > s.pts[1]) warn(`${c.id} points ${c.points} out of range`);
    if (total(c) < s.cost[0] || total(c) > s.cost[1]) warn(`${c.id} cost ${total(c)} out of range`);
  }
}

console.log(`\nPatrons — ${PATRONS.length}`);
for (const p of PATRONS) console.log(`  ${p.name.padEnd(24)} ${Object.entries(p.requires).map(([g, n]) => `${n} ${g}`).join(' + ')}`);
const patronDemand = GEMS.map((g) => `${g}:${PATRONS.reduce((a, p) => a + (p.requires[g] ?? 0), 0)}`).join('  ');
console.log(`  demand        ${patronDemand}`);

console.log(problems ? `\n${problems} issue(s) found.` : '\nBalance checks passed.');
process.exitCode = problems ? 1 : 0;
