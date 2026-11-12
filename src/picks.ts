// Gem-picking rules for the "take tokens" actions, shared by the classic and table views.
import type { Action, Gem } from './engine';

/** Click behaviour: click a gem to add it, click the same single gem again to take 2 of it. */
export function togglePick(picked: Gem[], g: Gem): Gem[] {
  if (picked.length === 2 && picked[0] === picked[1]) return [g];
  if (picked.length === 1 && picked[0] === g) return [g, g];
  if (picked.includes(g)) return picked.filter((x) => x !== g);
  if (picked.length < 3) return [...picked, g];
  return picked;
}

/** The action the current selection stands for, or null while it is incomplete. */
export function pickAction(picked: Gem[]): Action | null {
  if (picked.length === 3) return { type: 'take3', gems: picked };
  if (picked.length === 2 && picked[0] === picked[1]) return { type: 'take2', gem: picked[0] };
  return null;
}

export const PICK_HINT = 'Pick 3 different gems, or click one gem twice to take 2.';
