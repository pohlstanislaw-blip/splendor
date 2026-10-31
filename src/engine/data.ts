// Card and patron data live in data.json (easy to edit; see README → "Editing data.json").
// This module types the JSON and checks its shape when the game loads.
import raw from './data.json';
import { GEMS, type Card, type Gem, type Patron, type Tier } from './types';

interface DataFile {
  tiers: Record<'1' | '2' | '3', string>;
  cards: Card[];
  patrons: Patron[];
}

function check(data: DataFile): DataFile {
  const isGem = (g: string): g is Gem => (GEMS as readonly string[]).includes(g);
  const ids = new Set<string>();
  for (const c of data.cards) {
    if (ids.has(c.id)) throw new Error(`data.json: duplicate card id ${c.id}`);
    ids.add(c.id);
    if (![1, 2, 3].includes(c.tier)) throw new Error(`data.json: card ${c.id} has bad tier ${c.tier}`);
    if (!isGem(c.bonus)) throw new Error(`data.json: card ${c.id} has unknown bonus "${c.bonus}"`);
    for (const [g, n] of Object.entries(c.cost))
      if (!isGem(g) || !Number.isInteger(n) || n! < 0) throw new Error(`data.json: card ${c.id} has bad cost ${g}: ${n}`);
  }
  for (const p of data.patrons)
    for (const g of Object.keys(p.requires)) if (!isGem(g)) throw new Error(`data.json: patron ${p.id} requires unknown gem "${g}"`);
  return data;
}

const data = check(raw as DataFile);

export const CARDS: Card[] = data.cards;
export const PATRONS: Patron[] = data.patrons;
export const TIER_NAMES: Record<Tier, string> = { 1: data.tiers['1'], 2: data.tiers['2'], 3: data.tiers['3'] };

export const CARD_BY_ID: Record<string, Card> = Object.fromEntries(CARDS.map((c) => [c.id, c]));
export const PATRON_BY_ID: Record<string, Patron> = Object.fromEntries(PATRONS.map((p) => [p.id, p]));
