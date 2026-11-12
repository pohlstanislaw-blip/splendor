import { describe, expect, it } from 'vitest';
import { GEMS } from '../engine';
import { assignChips, stackIndex } from './chips';
import { boughtPose, marketPose, relativeSeat, reservedPose, seatFrame, seatTokenBase, tableSize, toWorld } from './layout';
import { pickAction, togglePick } from '../picks';

describe('seats around the table', () => {
  it('puts the viewer at the near edge and others around in turn order', () => {
    expect(seatFrame(2, 2, 4).slot).toBe('self');
    expect([3, 0, 1].map((s) => seatFrame(s, 2, 4).slot)).toEqual(['left', 'opposite', 'right']);
    expect(seatFrame(0, 1, 2).slot).toBe('opposite');
    expect([1, 2].map((s) => seatFrame(s, 0, 3).slot)).toEqual(['left', 'right']);
    expect(relativeSeat(0, 3, 4)).toBe(1);
  });

  it("each seat's local +z points at its owner, away from the table centre", () => {
    for (const [seat, n] of [[1, 2], [1, 4], [2, 4], [3, 4]] as const) {
      const f = seatFrame(seat, 0, n);
      const near = toWorld(f, [0, 0, 0]);
      const far = toWorld(f, [0, 0, 3]);
      expect(Math.hypot(far[0], far[2])).toBeGreaterThan(Math.hypot(near[0], near[2]));
    }
  });

  it('keeps every seat area on the table and clear of the market', () => {
    for (const n of [2, 3, 4]) {
      const t = tableSize(n);
      for (let seat = 0; seat < n; seat++) {
        const f = seatFrame(seat, 0, n);
        const pts = [
          ...GEMS.map((g) => boughtPose(f, g, 0, 1).pos),
          ...[0, 1, 2].map((i) => reservedPose(f, i, true).pos),
          seatTokenBase(f, 'gold'),
          seatTokenBase(f, 'garnet'),
        ];
        for (const [x, , z] of pts) {
          expect(Math.abs(x)).toBeLessThan(t.halfWidth);
          expect(z).toBeGreaterThan(t.zFar);
          expect(z).toBeLessThan(t.zNear);
          // not inside the market block
          const inMarket = x > -3.7 && x < 2.9 && z > -3.4 && z < 1.5;
          expect(inMarket).toBe(false);
        }
      }
    }
  });

  it('stacks bought cards so each later card sits lower toward the owner', () => {
    const f = seatFrame(0, 0, 2);
    const a = boughtPose(f, 'jade', 0, 3).pos;
    const b = boughtPose(f, 'jade', 1, 3).pos;
    expect(b[2]).toBeGreaterThan(a[2]);
    expect(b[1]).toBeGreaterThan(a[1]);
    expect(b[0]).toBeCloseTo(a[0]);
    expect(boughtPose(f, 'garnet', 0, 1).pos[0]).toBeLessThan(boughtPose(f, 'moonstone', 0, 1).pos[0]);
    expect(marketPose(3, 0).pos[2]).toBeLessThan(marketPose(1, 0).pos[2]);
  });
});

describe('chip identities', () => {
  it('moves only the chips that changed hands', () => {
    const start = assignChips(undefined, { supply: 4, '0': 0, '1': 0 });
    expect(start).toEqual(['supply', 'supply', 'supply', 'supply']);
    const afterTake = assignChips(start, { supply: 2, '0': 2, '1': 0 });
    expect(afterTake.filter((l) => l === 'supply')).toHaveLength(2);
    expect(afterTake.filter((l) => l === '0')).toHaveLength(2);
    const afterPay = assignChips(afterTake, { supply: 3, '0': 1, '1': 0 });
    // exactly one chip moved, from seat 0 back to the supply
    expect(afterPay.filter((l, i) => l !== afterTake[i])).toEqual(['supply']);
    expect(stackIndex(['supply', '0', 'supply', '0'], 3)).toBe(1);
    expect(stackIndex(['supply', '0', 'supply', '0'], 2)).toBe(1);
  });
});

describe('gem picking', () => {
  it('builds take-3 and take-2 selections', () => {
    let p = togglePick([], 'jade');
    expect(pickAction(p)).toBeNull();
    p = togglePick(p, 'jade');
    expect(pickAction(p)).toEqual({ type: 'take2', gem: 'jade' });
    p = togglePick(p, 'lapis'); // starts over from a pair
    expect(p).toEqual(['lapis']);
    p = togglePick(togglePick(p, 'garnet'), 'jade');
    expect(pickAction(p)).toEqual({ type: 'take3', gems: ['lapis', 'garnet', 'jade'] });
    expect(togglePick(p, 'obsidian')).toEqual(p); // already 3
    expect(togglePick(p, 'garnet')).toEqual(['lapis', 'jade']);
  });
});
