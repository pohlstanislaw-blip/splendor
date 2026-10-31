import { describe, expect, it } from 'vitest';
import { CARDS, PATRONS } from './data';
import {
  IllegalActionError,
  applyAction,
  bonuses,
  computeWinners,
  createGame,
  emptyTokens,
  legalMainActions,
  paymentFor,
  prestige,
  tokenTotal,
  validate,
} from './game';
import { chooseAiAction } from './ai';
import { GEMS, type Action, type Gem, type GameState, type SeatConfig, type TokenCounts } from './types';

const seats = (n: number): SeatConfig[] =>
  Array.from({ length: n }, (_, i) => ({ name: `P${i + 1}`, controller: 'human' as const }));

/** Fresh game with player 0 to move and a deterministic layout. */
function game(n = 2, seed = 42): GameState {
  const s = createGame(seats(n), seed);
  s.current = 0;
  s.startPlayer = 0;
  return s;
}

function tokens(t: Partial<TokenCounts>): TokenCounts {
  return { ...emptyTokens(), ...t };
}

/** Card ids giving the requested bonuses (uses cheap tier 1 cards). */
function bonusCards(b: Partial<Record<Gem, number>>): string[] {
  const ids: string[] = [];
  for (const g of GEMS) {
    const pool = CARDS.filter((c) => c.bonus === g && c.tier === 1);
    for (let i = 0; i < (b[g] ?? 0); i++) ids.push(pool[i].id);
  }
  return ids;
}

function cardWithCost(predicate: (c: (typeof CARDS)[number]) => boolean) {
  const c = CARDS.find(predicate);
  if (!c) throw new Error('no such card');
  return c;
}

/** Put a specific card into market slot (tier,0), removing it from decks if present. */
function placeInMarket(s: GameState, cardId: string, slot = 0) {
  const card = CARDS.find((c) => c.id === cardId)!;
  const t = card.tier - 1;
  s.decks[t] = s.decks[t].filter((x) => x !== cardId);
  const old = s.market[t][slot];
  if (old && old !== cardId) s.decks[t].unshift(old);
  s.market[t] = s.market[t].map((x, i) => (i !== slot && x === cardId ? s.decks[t].pop() ?? null : x));
  s.market[t][slot] = cardId;
}

function act(s: GameState, a: Action): GameState {
  return applyAction(s, a);
}
/** Apply a main action and confirm the turn (when no sub-step is pending). */
function turn(s: GameState, a: Action): GameState {
  const after = applyAction(s, a);
  return after.phase === 'confirm' ? applyAction(after, { type: 'endTurn' }) : after;
}

// ---------------------------------------------------------------------------

describe('card data', () => {
  it('has the right tier sizes and color spread', () => {
    const t = (n: number) => CARDS.filter((c) => c.tier === n);
    expect(t(1)).toHaveLength(40);
    expect(t(2)).toHaveLength(30);
    expect(t(3)).toHaveLength(20);
    for (const g of GEMS) {
      expect(t(1).filter((c) => c.bonus === g)).toHaveLength(8);
      expect(t(2).filter((c) => c.bonus === g)).toHaveLength(6);
      expect(t(3).filter((c) => c.bonus === g)).toHaveLength(4);
    }
  });

  it('respects point and cost ranges per tier', () => {
    const total = (c: (typeof CARDS)[number]) => Object.values(c.cost).reduce((a, b) => a + (b ?? 0), 0);
    const ranges = { 1: [0, 1, 3, 5], 2: [1, 3, 5, 8], 3: [3, 5, 7, 14] } as const;
    for (const c of CARDS) {
      const [pmin, pmax, cmin, cmax] = ranges[c.tier];
      expect(c.points).toBeGreaterThanOrEqual(pmin);
      expect(c.points).toBeLessThanOrEqual(pmax);
      expect(total(c)).toBeGreaterThanOrEqual(cmin);
      expect(total(c)).toBeLessThanOrEqual(cmax);
    }
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
  });

  it('has 10 patrons requiring 4+4 or 3+3+3 bonuses', () => {
    expect(PATRONS).toHaveLength(10);
    for (const p of PATRONS) {
      const v = Object.values(p.requires).sort();
      expect([JSON.stringify([4, 4]), JSON.stringify([3, 3, 3])]).toContain(JSON.stringify(v));
      expect(p.points).toBe(3);
    }
  });
});

describe('setup', () => {
  it.each([
    [2, 4],
    [3, 5],
    [4, 7],
  ])('%i players → %i of each gem, 5 gold, %i+1 patrons', (n, per) => {
    const s = createGame(seats(n), 7);
    for (const g of GEMS) expect(s.supply[g]).toBe(per);
    expect(s.supply.gold).toBe(5);
    expect(s.patrons).toHaveLength(n + 1);
  });

  it('deals 4 face-up cards per tier and keeps the rest in decks', () => {
    const s = createGame(seats(2), 1);
    expect(s.market.map((r) => r.filter(Boolean).length)).toEqual([4, 4, 4]);
    expect(s.decks.map((d) => d.length)).toEqual([36, 26, 16]);
    s.market.forEach((row, i) => row.forEach((id) => expect(id!.startsWith(`t${i + 1}-`)).toBe(true)));
  });

  it('rejects unsupported player counts', () => {
    expect(() => createGame(seats(1))).toThrow();
    expect(() => createGame(seats(5))).toThrow();
  });

  it('is deterministic for a seed and picks varied random starting players', () => {
    expect(createGame(seats(3), 99)).toEqual(createGame(seats(3), 99));
    const starts = new Set(Array.from({ length: 40 }, (_, i) => createGame(seats(4), i + 1).startPlayer));
    expect(starts.size).toBeGreaterThan(1);
    for (const st of starts) expect(st).toBeGreaterThanOrEqual(0);
  });
});

describe('take 3 different gems', () => {
  it('moves 3 different gems from supply to player', () => {
    const s = act(game(), { type: 'take3', gems: ['garnet', 'lapis', 'jade'] });
    expect(s.players[0].tokens).toMatchObject({ garnet: 1, lapis: 1, jade: 1 });
    expect(s.supply).toMatchObject({ garnet: 3, lapis: 3, jade: 3, obsidian: 4 });
    expect(s.phase).toBe('confirm');
  });

  it('rejects duplicates, wrong counts, gold and empty piles', () => {
    const s = game();
    expect(validate(s, { type: 'take3', gems: ['garnet', 'garnet', 'jade'] })).toMatch(/different/);
    expect(validate(s, { type: 'take3', gems: ['garnet', 'jade'] })).toMatch(/exactly 3/);
    expect(validate(s, { type: 'take3', gems: ['garnet', 'jade', 'gold' as Gem] })).toMatch(/Gold/);
    s.supply.jade = 0;
    expect(validate(s, { type: 'take3', gems: ['garnet', 'lapis', 'jade'] })).toMatch(/No Jade/);
    expect(() => act(s, { type: 'take3', gems: ['garnet', 'lapis', 'jade'] })).toThrow(IllegalActionError);
  });
});

describe('take 2 of the same gem', () => {
  it('is allowed when the pile has exactly 4', () => {
    const s = game();
    expect(s.supply.lapis).toBe(4);
    const after = act(s, { type: 'take2', gem: 'lapis' });
    expect(after.players[0].tokens.lapis).toBe(2);
    expect(after.supply.lapis).toBe(2);
  });

  it('is refused when the pile has fewer than 4', () => {
    const s = game();
    s.supply.lapis = 3;
    expect(validate(s, { type: 'take2', gem: 'lapis' })).toMatch(/at least 4/);
    expect(legalMainActions(s).some((a) => a.type === 'take2' && a.gem === 'lapis')).toBe(false);
  });

  it('is refused for gold', () => {
    expect(validate(game(), { type: 'take2', gem: 'gold' as Gem })).toMatch(/Gold/);
  });
});

describe('reserving', () => {
  it('takes a face-up card, gives 1 gold and refills the slot', () => {
    const s = game();
    const id = s.market[1][2]!;
    const nextTop = s.decks[1][s.decks[1].length - 1];
    const after = act(s, { type: 'reserve', source: { kind: 'market', tier: 2, slot: 2 } });
    expect(after.players[0].reserved).toEqual([{ cardId: id, hidden: false }]);
    expect(after.players[0].tokens.gold).toBe(1);
    expect(after.supply.gold).toBe(4);
    expect(after.market[1][2]).toBe(nextTop);
    expect(after.decks[1]).toHaveLength(25);
  });

  it('takes the top of a deck hidden', () => {
    const s = game();
    const top = s.decks[2][s.decks[2].length - 1];
    const after = act(s, { type: 'reserve', source: { kind: 'deck', tier: 3 } });
    expect(after.players[0].reserved[0]).toEqual({ cardId: top, hidden: true });
    expect(after.log.at(-1)!.text).not.toContain(CARDS.find((c) => c.id === top)!.name);
  });

  it('gives no gold when none remain but still reserves', () => {
    const s = game();
    s.supply.gold = 0;
    const after = act(s, { type: 'reserve', source: { kind: 'market', tier: 1, slot: 0 } });
    expect(after.players[0].reserved).toHaveLength(1);
    expect(after.players[0].tokens.gold).toBe(0);
  });

  it('enforces the 3-card limit', () => {
    let s = game();
    s.players[0].reserved = s.decks[0].splice(0, 3).map((cardId) => ({ cardId, hidden: true }));
    expect(validate(s, { type: 'reserve', source: { kind: 'market', tier: 1, slot: 0 } })).toMatch(/3 reserved/);
    expect(validate(s, { type: 'reserve', source: { kind: 'deck', tier: 1 } })).toMatch(/3 reserved/);
    expect(legalMainActions(s).some((a) => a.type === 'reserve')).toBe(false);
    s = { ...s, players: [{ ...s.players[0], reserved: s.players[0].reserved.slice(0, 2) }, s.players[1]] };
    expect(validate(s, { type: 'reserve', source: { kind: 'deck', tier: 1 } })).toBeNull();
  });

  it('leaves a blank slot when the deck is empty, and refuses empty deck/slot', () => {
    let s = game();
    s.decks[2] = [];
    s = act(s, { type: 'reserve', source: { kind: 'market', tier: 3, slot: 1 } });
    expect(s.market[2][1]).toBeNull();
    s = act(s, { type: 'endTurn' });
    expect(validate(s, { type: 'reserve', source: { kind: 'market', tier: 3, slot: 1 } })).toMatch(/empty/);
    expect(validate(s, { type: 'reserve', source: { kind: 'deck', tier: 3 } })).toMatch(/empty/);
    expect(validate(s, { type: 'buy', source: { kind: 'market', tier: 3, slot: 1 } })).toMatch(/no card/);
  });

  it('reserved cards can only leave by being bought', () => {
    const s = game();
    s.players[0].reserved = [{ cardId: s.decks[0].pop()!, hidden: false }];
    expect(validate(s, { type: 'reserve', source: { kind: 'reserved', index: 0 } })).toBeTruthy();
    expect(validate(s, { type: 'buy', source: { kind: 'deck', tier: 1 } })).toMatch(/reserve it first/);
  });
});

describe('buying and gold payment', () => {
  const card = cardWithCost((c) => c.tier === 1 && c.points === 0 && Object.keys(c.cost).length === 3 && Object.values(c.cost).every((v) => v === 1));

  it('pays exact gems and refills the market', () => {
    const s = game();
    placeInMarket(s, card.id);
    s.players[0].tokens = tokens(Object.fromEntries(Object.keys(card.cost).map((g) => [g, 1])));
    for (const g of Object.keys(card.cost)) s.supply[g as Gem]--;
    const after = act(s, { type: 'buy', source: { kind: 'market', tier: 1, slot: 0 } });
    expect(after.players[0].cards).toEqual([card.id]);
    expect(tokenTotal(after.players[0].tokens)).toBe(0);
    for (const g of GEMS) expect(after.supply[g]).toBe(4);
    expect(after.market[0][0]).not.toBe(card.id);
    expect(after.market[0][0]).toBeTruthy();
  });

  it('uses gold for missing gems', () => {
    const s = game();
    placeInMarket(s, card.id);
    const [g1, g2, g3] = Object.keys(card.cost) as Gem[];
    s.players[0].tokens = tokens({ [g1]: 1, gold: 2 });
    s.supply[g1]--;
    s.supply.gold -= 2;
    const pay = paymentFor(s.players[0], card)!;
    expect(pay).toMatchObject({ [g1]: 1, [g2]: 0, [g3]: 0, gold: 2 });
    const after = act(s, { type: 'buy', source: { kind: 'market', tier: 1, slot: 0 } });
    expect(after.players[0].tokens.gold).toBe(0);
    expect(after.supply.gold).toBe(5);
    expect(after.supply[g1]).toBe(4);
  });

  it('prefers colored tokens over gold', () => {
    const s = game();
    const [g1, g2, g3] = Object.keys(card.cost) as Gem[];
    s.players[0].tokens = tokens({ [g1]: 1, [g2]: 1, [g3]: 1, gold: 2 });
    expect(paymentFor(s.players[0], card)!.gold).toBe(0);
  });

  it('refuses when gems + gold are insufficient', () => {
    const s = game();
    placeInMarket(s, card.id);
    const [g1] = Object.keys(card.cost) as Gem[];
    s.players[0].tokens = tokens({ [g1]: 1, gold: 1 });
    expect(validate(s, { type: 'buy', source: { kind: 'market', tier: 1, slot: 0 } })).toMatch(/missing 1/);
  });

  it('subtracts permanent bonuses from the cost', () => {
    const s = game();
    placeInMarket(s, card.id);
    const [g1, g2, g3] = Object.keys(card.cost) as Gem[];
    s.players[0].cards = bonusCards({ [g1]: 1, [g2]: 1 });
    s.players[0].tokens = tokens({ [g3]: 1 });
    expect(paymentFor(s.players[0], card)).toMatchObject({ [g1]: 0, [g2]: 0, [g3]: 1, gold: 0 });
    s.players[0].tokens = tokens({});
    s.players[0].cards = bonusCards({ [g1]: 1, [g2]: 1, [g3]: 1 });
    const after = act(s, { type: 'buy', source: { kind: 'market', tier: 1, slot: 0 } });
    expect(after.players[0].cards).toContain(card.id);
  });

  it('can buy own reserved cards (removing them from hand)', () => {
    const s = game();
    s.decks[0] = s.decks[0].filter((x) => x !== card.id);
    s.market[0] = s.market[0].map((x) => (x === card.id ? s.decks[0].pop()! : x));
    s.players[0].reserved = [{ cardId: card.id, hidden: true }];
    s.players[0].tokens = tokens({ gold: 3 });
    s.supply.gold = 2;
    const after = act(s, { type: 'buy', source: { kind: 'reserved', index: 0 } });
    expect(after.players[0].reserved).toEqual([]);
    expect(after.players[0].cards).toEqual([card.id]);
    expect(after.supply.gold).toBe(5);
  });
});

describe('one action per turn & phases', () => {
  it('forbids a second main action before ending the turn', () => {
    const s = act(game(), { type: 'take2', gem: 'jade' });
    expect(validate(s, { type: 'take2', gem: 'lapis' })).toMatch(/already/);
    const next = act(s, { type: 'endTurn' });
    expect(next.current).toBe(1);
    expect(next.phase).toBe('action');
    expect(validate(next, { type: 'endTurn' })).toBeTruthy();
  });

  it('does not mutate the previous state (enables undo)', () => {
    const s = game();
    const snapshot = structuredClone(s);
    act(s, { type: 'take3', gems: ['garnet', 'lapis', 'jade'] });
    expect(s).toEqual(snapshot);
  });
});

describe('10-token limit', () => {
  it('requires returning tokens down to exactly 10', () => {
    const s = game();
    s.players[0].tokens = tokens({ garnet: 3, lapis: 3, obsidian: 2, gold: 1 }); // 9
    s.supply.garnet = 1; s.supply.lapis = 1; s.supply.obsidian = 2; s.supply.gold = 4;
    const after = act(s, { type: 'take3', gems: ['jade', 'moonstone', 'obsidian'] }); // 12
    expect(after.phase).toBe('discard');
    expect(validate(after, { type: 'endTurn' })).toBeTruthy();
    expect(validate(after, { type: 'discard', tokens: { garnet: 1 } })).toMatch(/exactly 2/);
    expect(validate(after, { type: 'discard', tokens: { garnet: 4 } })).toMatch(/only have/);
    const done = act(after, { type: 'discard', tokens: { gold: 1, garnet: 1 } });
    expect(tokenTotal(done.players[0].tokens)).toBe(10);
    expect(done.supply.gold).toBe(5);
    expect(done.supply.garnet).toBe(2);
    expect(done.phase).toBe('confirm');
  });

  it('counts gold from reserving', () => {
    const s = game();
    s.players[0].tokens = tokens({ garnet: 2, lapis: 2, jade: 2, obsidian: 2, moonstone: 2 });
    const after = act(s, { type: 'reserve', source: { kind: 'deck', tier: 1 } });
    expect(after.phase).toBe('discard');
  });

  it('does not trigger at exactly 10', () => {
    const s = game();
    s.players[0].tokens = tokens({ garnet: 2, lapis: 2, jade: 2, obsidian: 1 });
    expect(act(s, { type: 'take3', gems: ['garnet', 'lapis', 'jade'] }).phase).toBe('confirm');
  });
});

describe('patrons', () => {
  it('visits automatically when exactly one qualifies', () => {
    const s = game();
    const patron = PATRONS.find((p) => Object.keys(p.requires).length === 2)!;
    s.patrons = [patron.id, ...s.patrons.filter((x) => x !== patron.id)].slice(0, 3);
    s.players[0].cards = bonusCards(patron.requires);
    const after = act(s, { type: 'take3', gems: ['garnet', 'lapis', 'jade'] });
    expect(after.phase).toBe('confirm');
    expect(after.players[0].patrons).toEqual([patron.id]);
    expect(after.patrons).not.toContain(patron.id);
    expect(prestige(after.players[0])).toBe(3 + after.players[0].cards.reduce((a, id) => a + CARDS.find((c) => c.id === id)!.points, 0));
  });

  it('awards only one per turn, letting the player choose', () => {
    const s = game();
    const a = PATRONS.find((p) => p.id === 'patron-1')!; // garnet 4 + lapis 4
    const b = PATRONS.find((p) => p.id === 'patron-2')!; // lapis 4 + jade 4
    s.patrons = [a.id, b.id, 'patron-4'];
    s.players[0].cards = bonusCards({ garnet: 4, lapis: 4, jade: 4 });
    const after = act(s, { type: 'take2', gem: 'obsidian' });
    expect(after.phase).toBe('patron');
    expect(after.patronChoices.sort()).toEqual([a.id, b.id].sort());
    expect(validate(after, { type: 'choosePatron', patronId: 'patron-4' })).toBeTruthy();
    expect(validate(after, { type: 'endTurn' })).toBeTruthy();
    const chosen = act(after, { type: 'choosePatron', patronId: b.id });
    expect(chosen.players[0].patrons).toEqual([b.id]);
    expect(chosen.patrons).toContain(a.id);
    expect(chosen.phase).toBe('confirm');
    // the other one comes next turn
    let s2 = act(chosen, { type: 'endTurn' });
    s2 = turn(s2, { type: 'take3', gems: ['garnet', 'lapis', 'jade'] });
    s2 = act(s2, { type: 'take3', gems: ['garnet', 'lapis', 'jade'] });
    expect(s2.players[0].patrons).toEqual([b.id, a.id]);
  });

  it('ignores tokens: only card bonuses count', () => {
    const s = game();
    s.patrons = ['patron-1'];
    s.players[0].tokens = tokens({ garnet: 4, lapis: 4 });
    s.players[0].cards = bonusCards({ garnet: 3, lapis: 4 });
    expect(act(s, { type: 'take2', gem: 'jade' }).players[0].patrons).toEqual([]);
  });

  it('happens after discarding', () => {
    const s = game();
    s.patrons = ['patron-1'];
    s.players[0].cards = bonusCards({ garnet: 4, lapis: 4 });
    s.players[0].tokens = tokens({ jade: 4, obsidian: 4, moonstone: 2 });
    s.supply.jade = 0; s.supply.obsidian = 0; s.supply.moonstone = 2;
    const d = act(s, { type: 'take2', gem: 'garnet' });
    expect(d.phase).toBe('discard');
    expect(d.players[0].patrons).toEqual([]);
    const after = act(d, { type: 'discard', tokens: { garnet: 2 } });
    expect(after.players[0].patrons).toEqual(['patron-1']);
  });
});

describe('passing', () => {
  it('is only allowed when no other action is possible', () => {
    const s = game();
    expect(validate(s, { type: 'pass' })).toMatch(/only pass/);
    for (const g of GEMS) s.supply[g] = 0;
    s.players[0].reserved = s.decks[0].splice(0, 3).map((cardId) => ({ cardId, hidden: true }));
    // empty pockets → nothing affordable (every card costs something)
    expect(legalMainActions(s)).toEqual([{ type: 'pass' }]);
    const after = turn(s, { type: 'pass' });
    expect(after.current).toBe(1);
  });
});

describe('game end', () => {
  function withPoints(s: GameState, idx: number, pts: number, cardCount = 0) {
    // build a hand of cards with the given point total & count using 0/1-point cards
    const ones = CARDS.filter((c) => c.points === 1);
    const zeros = CARDS.filter((c) => c.points === 0);
    const pointCards = CARDS.filter((c) => c.points >= 1).sort((a, b) => b.points - a.points);
    const hand: string[] = [];
    let left = pts;
    for (const c of pointCards) if (c.points <= left && hand.length < Math.max(cardCount, 1) * 10) { hand.push(c.id); left -= c.points; }
    expect(left).toBe(0);
    while (hand.length < cardCount) hand.push(zeros[hand.length].id);
    void ones;
    s.players[idx].cards = hand;
  }

  it('finishes the round once someone reaches 15, so all have equal turns', () => {
    let s = game(3);
    s.patrons = [];
    s.startPlayer = 1;
    s.current = 1;
    withPoints(s, 1, 15);
    s = turn(s, { type: 'take3', gems: ['garnet', 'lapis', 'jade'] }); // P2 triggers
    expect(s.finalRound).toBe(true);
    expect(s.phase).toBe('action');
    expect(s.current).toBe(2);
    s = turn(s, { type: 'take3', gems: ['garnet', 'lapis', 'jade'] }); // P3
    expect(s.current).toBe(0);
    expect(s.phase).toBe('action');
    s = turn(s, { type: 'take3', gems: ['obsidian', 'lapis', 'moonstone'] }); // P1 last in round
    expect(s.phase).toBe('gameover');
    expect(s.winners).toEqual([1]);
  });

  it('ends immediately when the last seat of the round triggers it', () => {
    let s = game(2);
    s.patrons = [];
    s.current = 1; // start player is 0, so seat 1 closes the round
    withPoints(s, 1, 16);
    s = turn(s, { type: 'take2', gem: 'jade' });
    expect(s.phase).toBe('gameover');
  });

  it('allows a later player to overtake in the final round', () => {
    let s = game(2);
    s.patrons = [];
    withPoints(s, 0, 15);
    withPoints(s, 1, 17);
    s = turn(s, { type: 'take2', gem: 'jade' });
    expect(s.phase).toBe('action');
    s = turn(s, { type: 'take2', gem: 'lapis' });
    expect(s.phase).toBe('gameover');
    expect(s.winners).toEqual([1]);
  });

  it('breaks ties by fewest purchased cards', () => {
    const s = game(3);
    withPoints(s, 0, 15, 9);
    withPoints(s, 1, 15, 7);
    withPoints(s, 2, 12, 3);
    expect(computeWinners(s)).toEqual([1]);
  });

  it('shares victory when still tied', () => {
    const s = game(3);
    withPoints(s, 0, 15, 7);
    withPoints(s, 1, 15, 7);
    withPoints(s, 2, 15, 8);
    expect(computeWinners(s)).toEqual([0, 1]);
  });

  it('counts patrons toward prestige', () => {
    const s = game(2);
    withPoints(s, 0, 12, 5);
    s.players[0].patrons = ['patron-3'];
    expect(prestige(s.players[0])).toBe(15);
  });

  it('rejects actions after game over', () => {
    let s = game(2);
    s.current = 1;
    withPoints(s, 1, 15);
    s = turn(s, { type: 'take2', gem: 'jade' });
    expect(validate(s, { type: 'take2', gem: 'lapis' })).toMatch(/over/);
  });
});

describe('bonuses helper', () => {
  it('counts one bonus per purchased card', () => {
    const s = game();
    s.players[0].cards = bonusCards({ jade: 2, moonstone: 1 });
    expect(bonuses(s.players[0])).toEqual({ garnet: 0, lapis: 0, jade: 2, obsidian: 0, moonstone: 1 });
  });
});

describe('AI', () => {
  function simulate(controllers: ('easy' | 'medium')[], seed: number) {
    let s = createGame(controllers.map((c, i) => ({ name: `AI${i}`, controller: c })), seed);
    let r = seed;
    const rand = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
    let steps = 0;
    while (s.phase !== 'gameover' && steps < 5000) {
      const a = chooseAiAction(s, rand);
      expect(validate(s, a)).toBeNull();
      s = applyAction(s, a);
      // token conservation
      for (const k of [...GEMS, 'gold' as const]) {
        const total = s.supply[k] + s.players.reduce((acc, p) => acc + p.tokens[k], 0);
        expect(total).toBe(k === 'gold' ? 5 : s.players.length === 2 ? 4 : s.players.length === 3 ? 5 : 7);
      }
      steps++;
    }
    return s;
  }

  it('easy AI only plays legal moves', () => {
    simulate(['easy', 'easy', 'easy'], 3);
  });

  it('medium AI finishes games and beats easy AI most of the time', () => {
    let mediumWins = 0;
    let finished = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const s = simulate(['medium', 'easy'], seed);
      if (s.phase === 'gameover') {
        finished++;
        if (s.winners.includes(0)) mediumWins++;
      }
    }
    expect(finished).toBeGreaterThanOrEqual(18);
    expect(mediumWins).toBeGreaterThanOrEqual(15);
  });

  it('medium AI vs medium AI games end', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const s = simulate(['medium', 'medium', 'medium', 'medium'], seed);
      expect(s.phase).toBe('gameover');
    }
  });
});
