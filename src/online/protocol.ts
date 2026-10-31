// Messages between the browser and the Facets game server (JSON over WebSocket at /ws).
import type { Action, GameState } from '../engine';

export type SeatKind = 'human' | 'easy' | 'medium';

export interface SeatView {
  name: string;
  kind: SeatKind;
  /** a human seat someone has claimed */
  taken: boolean;
  /** that person currently has the page open */
  connected: boolean;
  isHost: boolean;
}

export interface RoomView {
  code: string;
  status: 'lobby' | 'playing';
  seats: SeatView[];
  /** your seat index, or null if you are not seated */
  you: number | null;
  /** game state as YOU may see it (others' face-down cards and deck order removed); null in the lobby */
  state: GameState | null;
  canUndo: boolean;
}

export type ClientMsg =
  | { t: 'hello'; token: string }
  | { t: 'create'; name: string; seats: SeatKind[] }
  | { t: 'join'; code: string; name: string }
  | { t: 'start' }
  | { t: 'action'; action: Action }
  | { t: 'undo' }
  | { t: 'leave' }
  | { t: 'rematch' }
  | { t: 'botify'; seat: number };

export type ServerMsg =
  | { t: 'room'; room: RoomView }
  | { t: 'left' }
  | { t: 'error'; message: string };

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 5;
export const MAX_NAME_LENGTH = 16;

/** Placeholder id for a face-down reserved card the viewer may not see: `hidden:<tier>`. */
export const HIDDEN_PREFIX = 'hidden:';
/** Placeholder for every card in a deck (only the count is shared). */
export const DECK_PLACEHOLDER = '?';

export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LENGTH);
}
