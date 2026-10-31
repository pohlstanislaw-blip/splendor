import { PATRON_BY_ID } from './data';
import {
  MAX_RESERVED,
  MAX_TOKENS,
  TAKE_TWO_MIN_PILE,
  bonuses,
  getCard,
  legalMainActions,
  paymentFor,
  tokenTotal,
} from './game';
import { GEMS, TOKENS, type Action, type Card, type CardSource, type Gem, type GameState, type GemCounts, type PlayerState, type Tier, type Token } from './types';

export type RandomFn = () => number;

function pick<T>(items: T[], rand: RandomFn): T {
  return items[Math.floor(rand() * items.length)];
}

/** Chooses the next action for the current player, whatever phase the turn is in. */
export function chooseAiAction(state: GameState, rand: RandomFn = Math.random): Action {
  const p = state.players[state.current];
  const level = p.controller === 'medium' ? 'medium' : 'easy';
  switch (state.phase) {
    case 'confirm':
      return { type: 'endTurn' };
    case 'patron':
      return { type: 'choosePatron', patronId: level === 'easy' ? pick(state.patronChoices, rand) : state.patronChoices[0] };
    case 'discard':
      return level === 'easy' ? randomDiscard(p, rand) : smartDiscard(state, p);
    case 'action':
      return level === 'easy' ? pick(legalMainActions(state), rand) : mediumAction(state, rand);
    default:
      throw new Error('No action available: game is over');
  }
}

function randomDiscard(p: PlayerState, rand: RandomFn): Action {
  const excess = tokenTotal(p.tokens) - MAX_TOKENS;
  const pool: Token[] = [];
  for (const k of TOKENS) for (let i = 0; i < p.tokens[k]; i++) pool.push(k);
  const tokens: Partial<Record<Token, number>> = {};
  for (let i = 0; i < excess; i++) {
    const idx = Math.floor(rand() * pool.length);
    const [k] = pool.splice(idx, 1);
    tokens[k] = (tokens[k] ?? 0) + 1;
  }
  return { type: 'discard', tokens };
}

// ---------------------------------------------------------------------------
// Medium: greedy heuristic
// ---------------------------------------------------------------------------

interface Candidate {
  card: Card;
  source: CardSource;
}

function visibleCandidates(state: GameState, p: PlayerState): Candidate[] {
  const out: Candidate[] = [];
  for (const tier of [1, 2, 3] as Tier[]) {
    state.market[tier - 1].forEach((id, slot) => {
      if (id) out.push({ card: getCard(id), source: { kind: 'market', tier, slot } });
    });
  }
  p.reserved.forEach((r, index) => out.push({ card: getCard(r.cardId), source: { kind: 'reserved', index } }));
  return out;
}

/** How much a card is worth to this player: prestige plus bonus usefulness for patrons. */
function cardValue(state: GameState, p: PlayerState, card: Card): number {
  const b = bonuses(p);
  let patronHelp = 0;
  for (const id of state.patrons) {
    const req = PATRON_BY_ID[id].requires;
    const need = req[card.bonus] ?? 0;
    if (need > b[card.bonus]) {
      // closer patrons are worth more
      const remaining = GEMS.reduce((s, g) => s + Math.max(0, (req[g] ?? 0) - b[g]), 0);
      patronHelp += 3 / Math.max(1, remaining);
    }
  }
  const engineCount = p.cards.length;
  const engineValue = engineCount < 8 ? 0.6 : 0.2; // early bonuses are worth more
  return card.points * 2 + patronHelp + engineValue;
}

function missingGems(p: PlayerState, card: Card): GemCounts {
  const b = bonuses(p);
  const m = {} as GemCounts;
  for (const g of GEMS) m[g] = Math.max(0, (card.cost[g] ?? 0) - b[g] - p.tokens[g]);
  return m;
}

function distance(p: PlayerState, card: Card): number {
  const m = missingGems(p, card);
  const total = GEMS.reduce((s, g) => s + m[g], 0);
  return Math.max(0, total - p.tokens.gold);
}

function goldUsed(p: PlayerState, card: Card): number {
  return paymentFor(p, card)?.gold ?? 0;
}

function mediumAction(state: GameState, rand: RandomFn): Action {
  const p = state.players[state.current];
  const legal = legalMainActions(state);
  const candidates = visibleCandidates(state, p);

  // 1. Buy the most valuable affordable card.
  const affordable = candidates.filter((c) => paymentFor(p, c.card));
  if (affordable.length) {
    const best = maxBy(affordable, (c) => cardValue(state, p, c.card) - goldUsed(p, c.card) * 0.25 + (c.source.kind === 'reserved' ? 0.3 : 0));
    return { type: 'buy', source: best.source };
  }

  // 2. Choose a target: best value per gem still missing.
  const target = maxBy(candidates, (c) => cardValue(state, p, c.card) / (1 + distance(p, c.card)));
  if (target) {
    const missing = missingGems(p, target.card);
    const room = MAX_TOKENS - tokenTotal(p.tokens);

    // take 2 of one color when we need 2+ of it
    const needTwo = GEMS.filter((g) => missing[g] >= 2 && state.supply[g] >= TAKE_TWO_MIN_PILE);
    const take3Options = legal.filter((a): a is Extract<Action, { type: 'take3' }> => a.type === 'take3');
    const scoreTake3 = (gems: Gem[]) =>
      gems.reduce((s, g) => s + (missing[g] > 0 ? 3 : 0) + secondaryNeed(state, p, g) * 0.2, 0);
    const best3 = take3Options.length ? maxBy(take3Options, (a) => scoreTake3(a.gems)) : undefined;
    const best3Useful = best3 ? best3.gems.filter((g) => missing[g] > 0).length : 0;

    if (needTwo.length && best3Useful < 2) {
      const g = maxBy(needTwo, (x) => missing[x]);
      return { type: 'take2', gem: g };
    }
    if (best3 && best3Useful > 0 && room >= 1) return best3;

    // nothing useful to collect: reserve the target if it is in the market (also grabs gold)
    if (target.source.kind === 'market' && p.reserved.length < MAX_RESERVED) {
      return { type: 'reserve', source: target.source };
    }
    if (best3) return best3;
    if (needTwo.length) return { type: 'take2', gem: needTwo[0] };
  }

  const nonReserve = legal.filter((a) => a.type !== 'reserve');
  return pick(nonReserve.length ? nonReserve : legal, rand);
}

/** Generic demand for a gem across visible high-value cards (for tie-breaking token picks). */
function secondaryNeed(state: GameState, p: PlayerState, g: Gem): number {
  let need = 0;
  for (const c of visibleCandidates(state, p)) need += missingGems(p, c.card)[g] > 0 ? 1 + c.card.points * 0.3 : 0;
  return need;
}

function smartDiscard(state: GameState, p: PlayerState): Action {
  const excess = tokenTotal(p.tokens) - MAX_TOKENS;
  const candidates = visibleCandidates(state, p);
  const target = candidates.length
    ? maxBy(candidates, (c) => cardValue(state, p, c.card) / (1 + distance(p, c.card)))
    : undefined;
  const b = bonuses(p);
  const left = { ...p.tokens };
  const tokens: Partial<Record<Token, number>> = {};
  for (let i = 0; i < excess; i++) {
    // keep gold; drop the gem the target needs least (most surplus)
    const options = GEMS.filter((g) => left[g] > 0);
    const surplus = (g: Gem) => left[g] + b[g] - (target ? target.card.cost[g] ?? 0 : 0) - secondaryNeed(state, p, g) * 0.1;
    const g: Token = options.length ? maxBy(options, surplus) : 'gold';
    left[g]--;
    tokens[g] = (tokens[g] ?? 0) + 1;
  }
  return { type: 'discard', tokens };
}

function maxBy<T>(items: T[], f: (t: T) => number): T {
  let best = items[0];
  let bestScore = -Infinity;
  for (const it of items) {
    const s = f(it);
    if (s > bestScore) {
      bestScore = s;
      best = it;
    }
  }
  return best;
}
