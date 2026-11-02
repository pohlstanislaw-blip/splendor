import { describe, expect, it } from 'vitest';
import { createGame } from '../engine';
import { ordinal, personalizeLog, placeOf, seatOrderFrom } from './perspective';

describe('seatOrderFrom', () => {
  it('starts with you and follows turn order', () => {
    expect(seatOrderFrom(4, 2)).toEqual([2, 3, 0, 1]);
    expect(seatOrderFrom(3, 0)).toEqual([0, 1, 2]);
    expect(seatOrderFrom(2, null)).toEqual([0, 1]);
  });
});

describe('personalizeLog', () => {
  it('rewrites your own name as "you"', () => {
    expect(personalizeLog('Ana took 2 Jade.', 'Ana')).toBe('You took 2 Jade.');
    expect(personalizeLog('Lady Orvelle Thane visits Ana (+3 prestige).', 'Ana')).toBe('Lady Orvelle Thane visits you (+3 prestige).');
    expect(personalizeLog('New game. Ana goes first.', 'Ana')).toBe('New game. You go first.');
    expect(personalizeLog('Ana wins!', 'Ana')).toBe('You win!');
    expect(personalizeLog('Shared victory: Ana & Ben!', 'Ana')).toBe('Shared victory: You & Ben!');
    expect(personalizeLog('Shared victory: Ben & Ana!', 'Ana')).toBe('Shared victory: Ben & you!');
  });

  it("leaves other players' lines and partial matches alone", () => {
    expect(personalizeLog('Ben took 2 Jade.', 'Ana')).toBe('Ben took 2 Jade.');
    expect(personalizeLog('Anabel took 2 Jade.', 'Ana')).toBe('Anabel took 2 Jade.');
    expect(personalizeLog('Ana 2 took 2 Jade.', 'Ana 2')).toBe('You took 2 Jade.');
    expect(personalizeLog('Bot (Medium) bought Ivy Run.', 'Bot (Medium)')).toBe('You bought Ivy Run.');
    expect(personalizeLog('Ana took 2 Jade.', null)).toBe('Ana took 2 Jade.');
  });
});

describe('placing', () => {
  it('ranks by points, then fewer cards, with ties sharing a place', () => {
    const s = createGame([{ name: 'A', controller: 'human' }, { name: 'B', controller: 'human' }, { name: 'C', controller: 'human' }], 1);
    const scores: [number, number][] = [[15, 9], [15, 7], [12, 3]];
    const score = (i: number) => scores[i];
    expect(placeOf(s, 1, score)).toBe(1);
    expect(placeOf(s, 0, score)).toBe(2);
    expect(placeOf(s, 2, score)).toBe(3);
    expect(ordinal(1) + ordinal(2) + ordinal(3) + ordinal(4) + ordinal(11)).toBe('1st2nd3rd4th11th');
  });
});
