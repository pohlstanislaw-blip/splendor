export const GEMS = ['garnet', 'lapis', 'jade', 'obsidian', 'moonstone'] as const;
export type Gem = (typeof GEMS)[number];
export type Token = Gem | 'gold';
export const TOKENS: readonly Token[] = [...GEMS, 'gold'];

export type GemCounts = Record<Gem, number>;
export type TokenCounts = Record<Token, number>;
export type Tier = 1 | 2 | 3;

export interface Card {
  id: string;
  tier: Tier;
  name: string;
  cost: Partial<GemCounts>;
  bonus: Gem;
  points: number;
}

export interface Patron {
  id: string;
  name: string;
  requires: Partial<GemCounts>;
  points: number;
}

export type Controller = 'human' | 'easy' | 'medium';

export interface ReservedCard {
  cardId: string;
  /** true when drawn blind from a deck: opponents must not see it */
  hidden: boolean;
}

export interface PlayerState {
  name: string;
  controller: Controller;
  tokens: TokenCounts;
  cards: string[]; // purchased card ids
  reserved: ReservedCard[];
  patrons: string[];
}

export type Phase = 'action' | 'discard' | 'patron' | 'confirm' | 'gameover';

export interface LogEntry {
  turn: number;
  player: number;
  text: string;
}

export interface GameState {
  players: PlayerState[];
  supply: TokenCounts;
  decks: [string[], string[], string[]]; // index 0 = tier 1; top of deck = last element
  market: [(string | null)[], (string | null)[], (string | null)[]];
  patrons: string[]; // available patron ids
  current: number;
  startPlayer: number;
  turn: number; // 1-based global turn counter
  round: number; // 1-based
  phase: Phase;
  finalRound: boolean;
  /** patron ids the current player may choose between (phase 'patron') */
  patronChoices: string[];
  log: LogEntry[];
  rngState: number;
  winners: number[]; // filled at game over
}

export type CardSource =
  | { kind: 'market'; tier: Tier; slot: number }
  | { kind: 'deck'; tier: Tier }
  | { kind: 'reserved'; index: number };

export type Action =
  | { type: 'take3'; gems: Gem[] }
  | { type: 'take2'; gem: Gem }
  | { type: 'reserve'; source: CardSource }
  | { type: 'buy'; source: CardSource }
  | { type: 'discard'; tokens: Partial<TokenCounts> }
  | { type: 'choosePatron'; patronId: string }
  | { type: 'pass' }
  | { type: 'endTurn' };

export interface SeatConfig {
  name: string;
  controller: Controller;
}
