// Where everything sits on the 3D table. Pure math, no three.js: unit-tested in layout.test.ts.
//
// World axes: x to the viewer's right, y up, z toward the viewer. The table top is y = 0.
// Each player has a "seat frame": a local copy of the same layout (stacks, tokens, hand), placed
// and rotated so local +z points at that player. The viewer's own frame is the near edge.
import { GEMS, TOKENS, type Gem, type Tier, type Token } from '../engine';

export type Vec3 = [number, number, number];
/** rot is an Euler triple applied in YXZ order: [x, y, z]. */
export interface Pose {
  pos: Vec3;
  rot: Vec3;
  scale: number;
}

export const CARD = { w: 1, h: 1.4, t: 0.018 };
export const CHIP = { r: 0.29, h: 0.075 };
const FLAT_UP = -Math.PI / 2; // lying on the table, face up
const FLAT_DOWN = Math.PI / 2; // lying on the table, face down

export type SeatSlot = 'self' | 'left' | 'opposite' | 'right';
const SLOTS: Record<number, SeatSlot[]> = {
  2: ['self', 'opposite'],
  3: ['self', 'left', 'right'],
  4: ['self', 'left', 'opposite', 'right'],
};

export interface SeatFrame {
  slot: SeatSlot;
  origin: Vec3;
  rotY: number;
  scale: number;
}

const FRAMES: Record<SeatSlot, Omit<SeatFrame, 'slot'>> = {
  self: { origin: [0, 0, 2.95], rotY: 0, scale: 1 },
  opposite: { origin: [0, 0, -4.8], rotY: Math.PI, scale: 0.62 },
  left: { origin: [-6.75, 0, -0.9], rotY: -Math.PI / 2, scale: 0.62 },
  right: { origin: [6.75, 0, -0.9], rotY: Math.PI / 2, scale: 0.62 },
};

/** How many seats clockwise from the viewer a seat is (0 = the viewer). */
export function relativeSeat(seat: number, viewer: number, playerCount: number): number {
  return (seat - viewer + playerCount) % playerCount;
}

export function seatFrame(seat: number, viewer: number, playerCount: number): SeatFrame {
  const slot = SLOTS[playerCount][relativeSeat(seat, viewer, playerCount)];
  return { slot, ...FRAMES[slot] };
}

/** Seat-local point → world point. */
export function toWorld(f: SeatFrame, local: Vec3): Vec3 {
  const [x, y, z] = [local[0] * f.scale, local[1] * f.scale, local[2] * f.scale];
  const c = Math.cos(f.rotY);
  const s = Math.sin(f.rotY);
  return [f.origin[0] + x * c + z * s, f.origin[1] + y, f.origin[2] - x * s + z * c];
}

export function tableSize(playerCount: number) {
  return { halfWidth: playerCount === 2 ? 6.4 : 8.5, zFar: -6.1, zNear: 5.3 };
}

export function cameraFor(playerCount: number, aspect: number) {
  const wide = playerCount > 2;
  // pull back on narrow windows so the table still fits
  const squeeze = Math.max(1, (wide ? 1.75 : 1.45) / Math.max(aspect, 0.8));
  return {
    // about 12% closer than before, so card costs read more easily
    pos: [0, (wide ? 7.95 : 7.3) * squeeze, (wide ? 7.85 : 7.75) * squeeze] as Vec3,
    target: [0, 0, wide ? -0.6 : -0.45] as Vec3,
    fov: wide ? 53 : 47,
  };
}

// ---------------------------------------------------------------------------
// shared table: market, decks, supply, patrons

const ROW_Z: Record<Tier, number> = { 3: -2.55, 2: -0.95, 1: 0.65 };
const SLOT_X = [-1.55, -0.3, 0.95, 2.2];
const DECK_X = -3.0;

export function marketPose(tier: Tier, slot: number): Pose {
  return { pos: [SLOT_X[slot], 0.012, ROW_Z[tier]], rot: [FLAT_UP, 0, 0], scale: 1 };
}

/** Top of a deck pile holding `count` cards (the pile's height shows how many are left). */
export function deckPose(tier: Tier, count: number): Pose {
  return { pos: [DECK_X, 0.012 + Math.min(count, 40) * 0.006, ROW_Z[tier]], rot: [FLAT_DOWN, 0, 0], scale: 1 };
}

export const SUPPLY_X = 3.95;
export function supplyStackPos(token: Token): Vec3 {
  return [SUPPLY_X, 0, -2.9 + TOKENS.indexOf(token) * 0.72];
}

export function chipPose(base: Vec3, indexInStack: number, lift = 0, scale = 1): Pose {
  return { pos: [base[0], base[1] + (indexInStack + 0.5) * CHIP.h * scale + lift, base[2]], rot: [0, 0, 0], scale };
}

/** Patron tiles still available: propped up along the left of the market. */
export function patronPose(index: number): Pose {
  return { pos: [-4.8, 0.22, -2.9 + index * 1.32], rot: [FLAT_UP + 0.34, 0, 0], scale: 1 };
}

// ---------------------------------------------------------------------------
// per-seat areas (seat-local coordinates, see toWorld)

const STACK_SCALE = 0.78;

function seatPose(f: SeatFrame, local: Vec3, rotX: number, scale: number): Pose {
  return { pos: toWorld(f, local), rot: [rotX, f.rotY, 0], scale: scale * f.scale };
}

/**
 * A bought card: one column per gem colour; within a column each later card sits lower and closer
 * to the owner, so every card's top band (points + gem) stays visible.
 */
export function boughtPose(f: SeatFrame, gem: Gem, indexInStack: number, stackSize: number): Pose {
  const step = Math.min(0.25, 1.7 / Math.max(1, stackSize - 1));
  const x = (GEMS.indexOf(gem) - 2) * 1.12;
  return seatPose(f, [x, 0.012 + indexInStack * 0.014, -0.55 + indexInStack * step], FLAT_UP, STACK_SCALE);
}

/** A reserved card. The viewer's own stand upright like a hand; others lie in front of their owner. */
export function reservedPose(f: SeatFrame, index: number, faceUp: boolean): Pose {
  const x = -3.65 - index * 1.08;
  if (f.slot === 'self') return seatPose(f, [x, 0.66, 0.15], -0.38, 0.92);
  return seatPose(f, [x, 0.012, 0], faceUp ? FLAT_UP : FLAT_DOWN, STACK_SCALE);
}

export function seatTokenBase(f: SeatFrame, token: Token): Vec3 {
  const k = TOKENS.indexOf(token);
  return toWorld(f, [3.5 + (k % 3) * 0.66, 0, -0.55 + Math.floor(k / 3) * 0.66]);
}

/** A patron this player has been visited by: laid beside their tokens. */
export function ownedPatronPose(f: SeatFrame, index: number): Pose {
  return seatPose(f, [3.6 + index * 0.85, 0.014 + index * 0.01, 1.05], FLAT_UP, 0.72);
}

/** Where an opponent's figure stands (behind their edge of the table), facing the centre. */
export function figurePose(f: SeatFrame): { pos: Vec3; rotY: number } {
  return { pos: toWorld(f, [0, 0, 3.4]), rotY: f.rotY + Math.PI };
}

/** Name plate anchor: at the table edge in front of an opponent, like a place card. */
export function platePos(f: SeatFrame): Vec3 {
  const p = toWorld(f, [0, 0, 2.5]);
  return [p[0], 0.75, p[2]];
}
