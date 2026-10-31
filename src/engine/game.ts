import { CARD_BY_ID, CARDS, PATRON_BY_ID, PATRONS } from './data';
import { randomInt, shuffle } from './rng';
import {
  GEMS,
  TOKENS,
  type Action,
  type Card,
  type CardSource,
  type Gem,
  type GameState,
  type GemCounts,
  type PlayerState,
  type SeatConfig,
  type Tier,
  type Token,
  type TokenCounts,
} from './types';

export const MAX_TOKENS = 10;
export const MAX_RESERVED = 3;
export const WIN_POINTS = 15;
export const MARKET_SIZE = 4;
export const GOLD_SUPPLY = 5;
export const TAKE_TWO_MIN_PILE = 4;

export class IllegalActionError extends Error {}

export const GEM_LABEL: Record<Token, string> = {
  garnet: 'Garnet',
  lapis: 'Lapis',
  jade: 'Jade',
  obsidian: 'Obsidian',
  moonstone: 'Moonstone',
  gold: 'Gold',
};

export function gemSupplyFor(playerCount: number): number {
  if (playerCount === 2) return 4;
  if (playerCount === 3) return 5;
  if (playerCount === 4) return 7;
  throw new Error(`Facets supports 2–4 players, got ${playerCount}`);
}

export function emptyGems(): GemCounts {
  return { garnet: 0, lapis: 0, jade: 0, obsidian: 0, moonstone: 0 };
}
export function emptyTokens(): TokenCounts {
  return { ...emptyGems(), gold: 0 };
}

export function tokenTotal(t: TokenCounts): number {
  return TOKENS.reduce((s, k) => s + t[k], 0);
}

export function getCard(id: string): Card {
  const c = CARD_BY_ID[id];
  if (!c) throw new Error(`Unknown card ${id}`);
  return c;
}

export function bonuses(p: PlayerState): GemCounts {
  const b = emptyGems();
  for (const id of p.cards) b[getCard(id).bonus]++;
  return b;
}

export function prestige(p: PlayerState): number {
  let pts = 0;
  for (const id of p.cards) pts += getCard(id).points;
  for (const id of p.patrons) pts += PATRON_BY_ID[id].points;
  return pts;
}

/**
 * Tokens the player would hand back to buy `card`: own gem tokens first, Gold for any shortfall.
 * Returns null when the card is unaffordable.
 */
export function paymentFor(p: PlayerState, card: Card): TokenCounts | null {
  const b = bonuses(p);
  const pay = emptyTokens();
  let goldNeeded = 0;
  for (const g of GEMS) {
    const need = Math.max(0, (card.cost[g] ?? 0) - b[g]);
    const fromGem = Math.min(need, p.tokens[g]);
    pay[g] = fromGem;
    goldNeeded += need - fromGem;
  }
  if (goldNeeded > p.tokens.gold) return null;
  pay.gold = goldNeeded;
  return pay;
}

/** Gems still missing (after bonuses, tokens and gold) to buy a card; 0 means affordable. */
export function shortfall(p: PlayerState, card: Card): number {
  const b = bonuses(p);
  let missing = 0;
  for (const g of GEMS) missing += Math.max(0, (card.cost[g] ?? 0) - b[g] - p.tokens[g]);
  return Math.max(0, missing - p.tokens.gold);
}

export function meetsPatron(p: PlayerState, patronId: string): boolean {
  const b = bonuses(p);
  const req = PATRON_BY_ID[patronId].requires;
  return GEMS.every((g) => b[g] >= (req[g] ?? 0));
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export function createGame(seats: SeatConfig[], seed: number = Date.now()): GameState {
  const n = seats.length;
  const perGem = gemSupplyFor(n);
  let rng = seed >>> 0 || 1;

  const decks: [string[], string[], string[]] = [[], [], []];
  const market: GameState['market'] = [[], [], []];
  for (const tier of [1, 2, 3] as Tier[]) {
    const ids = CARDS.filter((c) => c.tier === tier).map((c) => c.id);
    const [shuffled, s] = shuffle(ids, rng);
    rng = s;
    const deck = shuffled;
    const row: (string | null)[] = [];
    for (let i = 0; i < MARKET_SIZE; i++) row.push(deck.pop() ?? null);
    decks[tier - 1] = deck;
    market[tier - 1] = row;
  }

  const [patronOrder, s2] = shuffle(
    PATRONS.map((p) => p.id),
    rng,
  );
  rng = s2;
  const [start, s3] = randomInt(n, rng);
  rng = s3;

  const supply = emptyTokens();
  for (const g of GEMS) supply[g] = perGem;
  supply.gold = GOLD_SUPPLY;

  const players: PlayerState[] = seats.map((seat) => ({
    name: seat.name,
    controller: seat.controller,
    tokens: emptyTokens(),
    cards: [],
    reserved: [],
    patrons: [],
  }));

  return {
    players,
    supply,
    decks,
    market,
    patrons: patronOrder.slice(0, n + 1),
    current: start,
    startPlayer: start,
    turn: 1,
    round: 1,
    phase: 'action',
    finalRound: false,
    patronChoices: [],
    log: [{ turn: 1, player: start, text: `New game. ${players[start].name} goes first.` }],
    rngState: rng,
    winners: [],
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function sourceCardId(state: GameState, source: CardSource): string | null {
  const p = state.players[state.current];
  switch (source.kind) {
    case 'market':
      return state.market[source.tier - 1]?.[source.slot] ?? null;
    case 'deck': {
      const d = state.decks[source.tier - 1];
      return d.length ? d[d.length - 1] : null;
    }
    case 'reserved':
      return p.reserved[source.index]?.cardId ?? null;
  }
}

const MAIN_ACTIONS = new Set(['take3', 'take2', 'reserve', 'buy', 'pass']);

/** Returns null when the action is legal, otherwise a human-readable reason. */
export function validate(state: GameState, action: Action): string | null {
  const p = state.players[state.current];
  if (state.phase === 'gameover') return 'The game is over.';

  if (MAIN_ACTIONS.has(action.type) && state.phase !== 'action') {
    if (state.phase === 'discard') return 'Return tokens down to 10 first.';
    if (state.phase === 'patron') return 'Choose a patron first.';
    return 'You already took your action this turn — confirm or undo.';
  }

  switch (action.type) {
    case 'take3': {
      const gems = action.gems;
      if (gems.length !== 3) return 'Pick exactly 3 gems of different colors.';
      if (new Set(gems).size !== 3) return 'The 3 gems must all be different colors.';
      for (const g of gems) {
        if (!(GEMS as readonly string[]).includes(g)) return 'Gold cannot be taken directly.';
        if (state.supply[g] < 1) return `No ${GEM_LABEL[g]} left in the supply.`;
      }
      return null;
    }
    case 'take2': {
      const g = action.gem;
      if (!(GEMS as readonly string[]).includes(g)) return 'Gold cannot be taken directly.';
      if (state.supply[g] < TAKE_TWO_MIN_PILE)
        return `Taking 2 ${GEM_LABEL[g]} needs at least ${TAKE_TWO_MIN_PILE} in the pile (has ${state.supply[g]}).`;
      return null;
    }
    case 'reserve': {
      if (action.source.kind === 'reserved') return 'That card is already reserved.';
      if (p.reserved.length >= MAX_RESERVED) return `You already hold ${MAX_RESERVED} reserved cards.`;
      if (!sourceCardId(state, action.source))
        return action.source.kind === 'deck' ? 'That deck is empty.' : 'That market slot is empty.';
      return null;
    }
    case 'buy': {
      if (action.source.kind === 'deck') return 'You cannot buy straight from a deck — reserve it first.';
      const id = sourceCardId(state, action.source);
      if (!id) return 'There is no card there.';
      const card = getCard(id);
      if (!paymentFor(p, card)) {
        return `Not enough gems: missing ${shortfall(p, card)} after bonuses and Gold.`;
      }
      return null;
    }
    case 'pass': {
      if (hasAnyMainAction(state)) return 'You can only pass when no other action is possible.';
      return null;
    }
    case 'discard': {
      if (state.phase !== 'discard') return 'No tokens need to be returned.';
      const excess = tokenTotal(p.tokens) - MAX_TOKENS;
      let total = 0;
      for (const [k, v] of Object.entries(action.tokens) as [Token, number][]) {
        if (!TOKENS.includes(k)) return `Unknown token ${k}.`;
        if (!Number.isInteger(v) || v < 0) return 'Invalid token count.';
        if (v > p.tokens[k]) return `You only have ${p.tokens[k]} ${GEM_LABEL[k]}.`;
        total += v;
      }
      if (total !== excess) return `Return exactly ${excess} token${excess === 1 ? '' : 's'}.`;
      return null;
    }
    case 'choosePatron': {
      if (state.phase !== 'patron') return 'No patron choice is pending.';
      if (!state.patronChoices.includes(action.patronId)) return 'That patron is not visiting you.';
      return null;
    }
    case 'endTurn': {
      if (state.phase !== 'confirm') return 'Finish your turn first.';
      return null;
    }
  }
}

/** All legal main actions (take/reserve/buy, or pass when nothing else is possible). */
export function legalMainActions(state: GameState): Action[] {
  if (state.phase !== 'action') return [];
  const out: Action[] = [];
  const p = state.players[state.current];

  // take 3 different
  for (let a = 0; a < GEMS.length; a++)
    for (let b = a + 1; b < GEMS.length; b++)
      for (let c = b + 1; c < GEMS.length; c++) {
        const gems = [GEMS[a], GEMS[b], GEMS[c]];
        if (gems.every((g) => state.supply[g] >= 1)) out.push({ type: 'take3', gems });
      }
  for (const g of GEMS) if (state.supply[g] >= TAKE_TWO_MIN_PILE) out.push({ type: 'take2', gem: g });

  if (p.reserved.length < MAX_RESERVED) {
    for (const tier of [1, 2, 3] as Tier[]) {
      state.market[tier - 1].forEach((id, slot) => {
        if (id) out.push({ type: 'reserve', source: { kind: 'market', tier, slot } });
      });
      if (state.decks[tier - 1].length) out.push({ type: 'reserve', source: { kind: 'deck', tier } });
    }
  }
  for (const tier of [1, 2, 3] as Tier[]) {
    state.market[tier - 1].forEach((id, slot) => {
      if (id && paymentFor(p, getCard(id))) out.push({ type: 'buy', source: { kind: 'market', tier, slot } });
    });
  }
  p.reserved.forEach((r, index) => {
    if (paymentFor(p, getCard(r.cardId))) out.push({ type: 'buy', source: { kind: 'reserved', index } });
  });

  if (out.length === 0) out.push({ type: 'pass' });
  return out;
}

function hasAnyMainAction(state: GameState): boolean {
  const acts = legalMainActions(state);
  return !(acts.length === 1 && acts[0].type === 'pass');
}

// ---------------------------------------------------------------------------
// Applying actions
// ---------------------------------------------------------------------------

function describeTokens(t: Partial<TokenCounts>): string {
  const parts: string[] = [];
  for (const k of TOKENS) if (t[k]) parts.push(`${t[k]} ${GEM_LABEL[k]}`);
  return parts.join(', ') || 'nothing';
}

function log(state: GameState, text: string) {
  state.log.push({ turn: state.turn, player: state.current, text });
}

export function applyAction(prev: GameState, action: Action): GameState {
  const reason = validate(prev, action);
  if (reason) throw new IllegalActionError(reason);
  const state: GameState = structuredClone(prev);
  const p = state.players[state.current];

  switch (action.type) {
    case 'take3': {
      for (const g of action.gems) {
        state.supply[g]--;
        p.tokens[g]++;
      }
      log(state, `${p.name} took ${action.gems.map((g) => GEM_LABEL[g]).join(', ')}.`);
      afterMainAction(state);
      break;
    }
    case 'take2': {
      state.supply[action.gem] -= 2;
      p.tokens[action.gem] += 2;
      log(state, `${p.name} took 2 ${GEM_LABEL[action.gem]}.`);
      afterMainAction(state);
      break;
    }
    case 'reserve': {
      const src = action.source;
      let id: string;
      let hidden = false;
      if (src.kind === 'deck') {
        id = state.decks[src.tier - 1].pop()!;
        hidden = true;
      } else if (src.kind === 'market') {
        id = state.market[src.tier - 1][src.slot]!;
        refillSlot(state, src.tier, src.slot);
      } else throw new IllegalActionError('Cannot reserve a reserved card.');
      p.reserved.push({ cardId: id, hidden });
      let goldText = '';
      if (state.supply.gold > 0) {
        state.supply.gold--;
        p.tokens.gold++;
        goldText = ' and gained 1 Gold';
      }
      log(
        state,
        hidden
          ? `${p.name} reserved a face-down card from the tier ${src.tier} deck${goldText}.`
          : `${p.name} reserved ${getCard(id).name}${goldText}.`,
      );
      afterMainAction(state);
      break;
    }
    case 'buy': {
      const src = action.source;
      let id: string;
      if (src.kind === 'market') {
        id = state.market[src.tier - 1][src.slot]!;
      } else if (src.kind === 'reserved') {
        id = p.reserved[src.index].cardId;
      } else throw new IllegalActionError('Cannot buy from a deck.');
      const card = getCard(id);
      const pay = paymentFor(p, card)!;
      for (const k of TOKENS) {
        p.tokens[k] -= pay[k];
        state.supply[k] += pay[k];
      }
      if (src.kind === 'market') refillSlot(state, src.tier, src.slot);
      else p.reserved.splice(src.index, 1);
      p.cards.push(id);
      const ptsText = card.points ? ` (+${card.points} prestige)` : '';
      log(state, `${p.name} bought ${card.name}${ptsText}, paying ${describeTokens(pay)}.`);
      afterMainAction(state);
      break;
    }
    case 'pass': {
      log(state, `${p.name} had no legal action and passed.`);
      afterMainAction(state);
      break;
    }
    case 'discard': {
      for (const [k, v] of Object.entries(action.tokens) as [Token, number][]) {
        p.tokens[k] -= v;
        state.supply[k] += v;
      }
      log(state, `${p.name} returned ${describeTokens(action.tokens)}.`);
      resolvePatrons(state);
      break;
    }
    case 'choosePatron': {
      awardPatron(state, action.patronId);
      state.phase = 'confirm';
      break;
    }
    case 'endTurn': {
      endTurn(state);
      break;
    }
  }
  return state;
}

function refillSlot(state: GameState, tier: Tier, slot: number) {
  state.market[tier - 1][slot] = state.decks[tier - 1].pop() ?? null;
}

function afterMainAction(state: GameState) {
  const p = state.players[state.current];
  if (tokenTotal(p.tokens) > MAX_TOKENS) {
    state.phase = 'discard';
    return;
  }
  resolvePatrons(state);
}

function resolvePatrons(state: GameState) {
  const p = state.players[state.current];
  const qualifying = state.patrons.filter((id) => meetsPatron(p, id));
  if (qualifying.length === 0) {
    state.phase = 'confirm';
  } else if (qualifying.length === 1) {
    awardPatron(state, qualifying[0]);
    state.phase = 'confirm';
  } else {
    state.patronChoices = qualifying;
    state.phase = 'patron';
  }
}

function awardPatron(state: GameState, id: string) {
  const p = state.players[state.current];
  state.patrons = state.patrons.filter((x) => x !== id);
  p.patrons.push(id);
  state.patronChoices = [];
  log(state, `${PATRON_BY_ID[id].name} visits ${p.name} (+${PATRON_BY_ID[id].points} prestige).`);
}

function endTurn(state: GameState) {
  const n = state.players.length;
  const p = state.players[state.current];
  if (!state.finalRound && prestige(p) >= WIN_POINTS) {
    state.finalRound = true;
    log(state, `${p.name} reached ${prestige(p)} prestige — the round will be finished.`);
  }
  const next = (state.current + 1) % n;
  if (state.finalRound && next === state.startPlayer) {
    state.phase = 'gameover';
    state.winners = computeWinners(state);
    const names = state.winners.map((i) => state.players[i].name).join(' & ');
    state.log.push({
      turn: state.turn,
      player: state.current,
      text: state.winners.length > 1 ? `Shared victory: ${names}!` : `${names} wins!`,
    });
    return;
  }
  state.current = next;
  state.turn++;
  if (next === state.startPlayer) state.round++;
  state.phase = 'action';
}

/** Highest prestige; tie → fewest purchased cards; still tied → all share the win. */
export function computeWinners(state: GameState): number[] {
  const scored = state.players.map((p, i) => ({ i, pts: prestige(p), cards: p.cards.length }));
  const best = Math.max(...scored.map((s) => s.pts));
  const top = scored.filter((s) => s.pts === best);
  const fewest = Math.min(...top.map((s) => s.cards));
  return top.filter((s) => s.cards === fewest).map((s) => s.i);
}

export function isGem(t: Token): t is Gem {
  return t !== 'gold';
}
