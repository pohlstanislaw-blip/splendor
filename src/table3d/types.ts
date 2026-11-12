import type { Tier } from '../engine';

/** What the player clicked on the 3D table; the board shows it in the inspector panel. */
export type TableSelection =
  | { kind: 'market'; tier: Tier; slot: number; cardId: string }
  | { kind: 'deck'; tier: Tier }
  | { kind: 'reserved'; index: number; cardId: string }
  | { kind: 'card'; cardId: string }
  | { kind: 'patron'; patronId: string };
