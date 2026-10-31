// Design rules for the card & patron data. Used by unit tests and `npm run balance`.
import { GEMS, type Card, type Patron, type Tier } from './types';

export const TIER_SPEC: Record<Tier, { perColor: number; points: [number, number]; cost: [number, number] }> = {
  1: { perColor: 8, points: [0, 1], cost: [3, 5] },
  2: { perColor: 6, points: [1, 3], cost: [5, 8] },
  3: { perColor: 4, points: [3, 5], cost: [7, 14] },
};

/** Max share of a card's cost that may be its own bonus color ("mostly other colours"). */
export const MAX_OWN_COLOR_SHARE = 1 / 3;

export const totalCost = (c: Card) => GEMS.reduce((s, g) => s + (c.cost[g] ?? 0), 0);
export const maxColor = (c: Card) => Math.max(0, ...GEMS.map((g) => c.cost[g] ?? 0));
export const colorCount = (c: Card) => GEMS.filter((g) => c.cost[g]).length;
export const ownShare = (c: Card) => (c.cost[c.bonus] ?? 0) / totalCost(c);

/** Colour-independent description of a card: points, own-colour cost, sorted other costs. */
export function cardShape(c: Card): string {
  const others = GEMS.filter((g) => g !== c.bonus)
    .map((g) => c.cost[g] ?? 0)
    .filter(Boolean)
    .sort((a, b) => b - a);
  return `${c.points}pt own${c.cost[c.bonus] ?? 0} [${others.join(',')}]`;
}

/** Returns a list of human-readable rule violations (empty = all good). */
export function checkDesignRules(cards: Card[], patrons: Patron[]): string[] {
  const problems: string[] = [];
  for (const tier of [1, 2, 3] as Tier[]) {
    const spec = TIER_SPEC[tier];
    const inTier = cards.filter((c) => c.tier === tier);

    for (const g of GEMS) {
      const n = inTier.filter((c) => c.bonus === g).length;
      if (n !== spec.perColor) problems.push(`tier ${tier}: ${g} has ${n} cards, expected ${spec.perColor}`);
    }
    for (const c of inTier) {
      if (c.points < spec.points[0] || c.points > spec.points[1])
        problems.push(`${c.id}: ${c.points} points outside ${spec.points.join('–')}`);
      const t = totalCost(c);
      if (t < spec.cost[0] || t > spec.cost[1]) problems.push(`${c.id}: total cost ${t} outside ${spec.cost.join('–')}`);
      if (ownShare(c) > MAX_OWN_COLOR_SHARE + 1e-9)
        problems.push(
          `${c.id}: ${Math.round(ownShare(c) * 100)}% of its cost is its own colour (max ${Math.round(MAX_OWN_COLOR_SHARE * 100)}%)`,
        );
    }

    // Symmetric across colours: same multiset of cost shapes and equal total demand per gem.
    const shapesOf = (g: string) =>
      inTier
        .filter((c) => c.bonus === g)
        .map(cardShape)
        .sort()
        .join(' | ');
    const ref = shapesOf(GEMS[0]);
    for (const g of GEMS.slice(1))
      if (shapesOf(g) !== ref) problems.push(`tier ${tier}: ${g} cards are not the same set of cost shapes as ${GEMS[0]}`);
    const demand = GEMS.map((g) => inTier.reduce((s, c) => s + (c.cost[g] ?? 0), 0));
    if (new Set(demand).size > 1)
      problems.push(`tier ${tier}: uneven gem demand ${GEMS.map((g, i) => `${g}:${demand[i]}`).join(' ')}`);

    // More points ⇒ higher total cost, or a cost concentrated in fewer colours.
    for (const hi of inTier)
      for (const lo of inTier)
        if (
          hi.points > lo.points &&
          totalCost(hi) <= totalCost(lo) &&
          maxColor(hi) <= maxColor(lo) &&
          colorCount(hi) >= colorCount(lo)
        )
          problems.push(`${hi.id} (${hi.points}pt) is no harder to buy than ${lo.id} (${lo.points}pt)`);
  }

  // Patrons: every colour demanded equally, and equally often.
  const patronDemand = GEMS.map((g) => patrons.reduce((s, p) => s + (p.requires[g] ?? 0), 0));
  const patronCount = GEMS.map((g) => patrons.filter((p) => p.requires[g]).length);
  if (new Set(patronDemand).size > 1) problems.push(`patrons: uneven total requirement per colour (${patronDemand.join(', ')})`);
  if (new Set(patronCount).size > 1) problems.push(`patrons: colours appear unevenly (${patronCount.join(', ')})`);
  for (const p of patrons) {
    const v = Object.values(p.requires).sort().join('+');
    if (v !== '4+4' && v !== '3+3+3') problems.push(`${p.id}: requires ${v}, expected 4+4 or 3+3+3`);
  }
  return problems;
}
