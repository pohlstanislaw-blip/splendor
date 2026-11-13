import { describe, expect, it } from 'vitest';
import { normalizeSettings } from './settings';

describe('display settings', () => {
  it('undoes the old automatic Classic fallback that version 1 saved', () => {
    expect(normalizeSettings({ view: 'classic', reduceMotion: null, sound: false }).view).toBe('auto');
  });
  it('keeps a Classic view the player chose under version 2', () => {
    expect(normalizeSettings({ v: 2, view: 'classic' }).view).toBe('classic');
  });
  it('fills defaults', () => {
    expect(normalizeSettings({})).toEqual({ v: 2, view: 'auto', reduceMotion: null, sound: false, plates: 'full' });
    expect(normalizeSettings({ view: 'table', sound: true })).toMatchObject({ view: 'table', sound: true });
  });
});
