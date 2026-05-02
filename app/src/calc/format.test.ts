import { describe, it, expect, vi } from 'vitest';
import { koTagFromText, priorityFlag, sturdyWarning } from './format';
import type { SavedMon } from '../types';

void vi;

describe('koTagFromText', () => {
  it('maps "guaranteed OHKO" to OHKO', () => {
    expect(koTagFromText('guaranteed OHKO')).toEqual({ label: 'OHKO', kind: 'ohko' });
  });
  it('maps "guaranteed 2HKO" to 2HKO', () => {
    expect(koTagFromText('guaranteed 2HKO')).toEqual({ label: '2HKO', kind: 'thko' });
  });
  it('maps "44.5% chance to 2HKO" to chance', () => {
    expect(koTagFromText('44.5% chance to 2HKO')).toEqual({ label: '44% 2HKO', kind: 'chance' });
  });
  it('returns null for empty', () => {
    expect(koTagFromText('')).toBeNull();
  });
});

describe('priorityFlag', () => {
  it('flags positive priority', () => {
    expect(priorityFlag(1)).toBe('+1');
    expect(priorityFlag(2)).toBe('+2');
  });
  it('returns null for 0', () => {
    expect(priorityFlag(0)).toBeNull();
  });
  it('flags negative priority', () => {
    expect(priorityFlag(-6)).toBe('-6');
  });
});

describe('sturdyWarning', () => {
  const mon = (over: Partial<SavedMon> = {}): SavedMon => ({
    id: 'x',
    species: 'Skarmory',
    nature: 'Hardy',
    sps: {},
    moves: ['', '', '', ''],
    isMega: false,
    boosts: {},
    ...over,
  });
  it('flags Sturdy at full HP', () => {
    expect(sturdyWarning(mon({ ability: 'Sturdy' }))).toBe(true);
  });
  it('does not flag Sturdy when damaged', () => {
    expect(sturdyWarning(mon({ ability: 'Sturdy', currentHp: 1 }))).toBe(false);
  });
  it('does not flag without Sturdy', () => {
    expect(sturdyWarning(mon())).toBe(false);
  });
});
