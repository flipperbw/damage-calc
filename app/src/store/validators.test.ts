import { describe, it, expect } from 'vitest';
import { validateSps, addRecent } from './validators';
import type { SavedMon, RecentOpponent } from '../types';
import { RECENT_OPPONENT_CAP } from '../types';

describe('validateSps', () => {
  it('passes a clean allocation', () => {
    expect(validateSps({ atk: 32, spe: 32 })).toEqual({ ok: true, total: 64 });
  });
  it('flags per-stat over 32', () => {
    expect(validateSps({ atk: 33 })).toEqual({
      ok: false, total: 33, error: 'atk exceeds 32',
    });
  });
  it('flags total over 66', () => {
    expect(validateSps({ atk: 32, spe: 32, hp: 10 })).toEqual({
      ok: false, total: 74, error: 'total exceeds 66',
    });
  });
  it('passes empty allocation', () => {
    expect(validateSps({})).toEqual({ ok: true, total: 0 });
  });
});

describe('addRecent', () => {
  const mon = (species: string): SavedMon => ({
    id: species, species, nature: 'Hardy', sps: {},
    moves: ['','','',''], isMega: false, boosts: {},
  });

  it('adds new recent at the head', () => {
    const list = addRecent([], mon('Skarmory'), 100);
    expect(list).toHaveLength(1);
    expect(list[0].mon.species).toBe('Skarmory');
    expect(list[0].useCount).toBe(1);
  });

  it('bumps existing recent and increments useCount', () => {
    const list1 = addRecent([], mon('Skarmory'), 100);
    const list2 = addRecent(list1, mon('Skarmory'), 200);
    expect(list2).toHaveLength(1);
    expect(list2[0].useCount).toBe(2);
    expect(list2[0].lastUsed).toBe(200);
  });

  it('moves bumped recent to head', () => {
    let list: RecentOpponent[] = [];
    list = addRecent(list, mon('Skarmory'), 100);
    list = addRecent(list, mon('Clefable'), 200);
    list = addRecent(list, mon('Skarmory'), 300);
    expect(list.map(r => r.mon.species)).toEqual(['Skarmory', 'Clefable']);
  });

  it('caps at RECENT_OPPONENT_CAP, evicts oldest', () => {
    let list: RecentOpponent[] = [];
    for (let i = 0; i < RECENT_OPPONENT_CAP + 5; i++) {
      list = addRecent(list, mon(`Mon${i}`), i);
    }
    expect(list).toHaveLength(RECENT_OPPONENT_CAP);
    expect(list[0].mon.species).toBe(`Mon${RECENT_OPPONENT_CAP + 4}`);
    expect(list[list.length - 1].mon.species).toBe('Mon5');
  });
});
