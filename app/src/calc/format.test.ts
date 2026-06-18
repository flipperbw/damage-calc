import { describe, expect, it, vi } from 'vitest';

import { effectivenessBadge, koTagFromText, priorityFlag, sturdyWarning } from '@/calc/format';
import type { SavedMon } from '@/types';

void vi;

describe('koTagFromText', () => {
  it('maps "guaranteed OHKO" to OHKO', () => {
    expect(koTagFromText('guaranteed OHKO')).toEqual({ label: 'OHKO', kind: 'ohko' });
  });
  it('maps "guaranteed 2HKO" to 2HKO', () => {
    expect(koTagFromText('guaranteed 2HKO')).toEqual({ label: '2HKO', kind: 'thko' });
  });
  it('maps "44.5% chance to 2HKO" to chance (ceiling)', () => {
    expect(koTagFromText('44.5% chance to 2HKO')).toEqual({ label: '45% 2HKO', kind: 'chance' });
  });
  it('maps a chance to OHKO to its own chanceOhko tier', () => {
    expect(koTagFromText('7% chance to OHKO')).toEqual({ label: '7% OHKO', kind: 'chanceOhko' });
  });
  it('rounds up tiny probabilities so 0.6% does not display as 0%', () => {
    expect(koTagFromText('0.6% chance to 4HKO')).toEqual({ label: '1% 4HKO', kind: 'chance' });
  });
  it('caps near-certain chances at 99% so a non-guaranteed KO never shows 100%', () => {
    // @smogon/calc clamps to 99.9% max for non-guaranteed KOs; ceil() must not
    // bump that back to a misleading "100%".
    expect(koTagFromText('99.9% chance to 2HKO')).toEqual({ label: '99% 2HKO', kind: 'chance' });
    expect(koTagFromText('99.9% chance to OHKO')).toEqual({ label: '99% OHKO', kind: 'chanceOhko' });
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
    mega: '',
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

describe('effectivenessBadge', () => {
  it('returns null for status moves', () => {
    expect(effectivenessBadge(2, true)).toBeNull();
    expect(effectivenessBadge(0, true)).toBeNull();
  });
  it('returns null for neutral 1x', () => {
    expect(effectivenessBadge(1, false)).toBeNull();
  });
  it('flags Immune for 0', () => {
    expect(effectivenessBadge(0, false)?.label).toBe('Immune');
  });
  it('flags 4x', () => {
    expect(effectivenessBadge(4, false)?.label).toBe('4×');
  });
  it('flags 2x', () => {
    expect(effectivenessBadge(2, false)?.label).toBe('2×');
  });
  it('flags 1/2x', () => {
    expect(effectivenessBadge(0.5, false)?.label).toBe('½×');
  });
  it('flags 1/4x', () => {
    expect(effectivenessBadge(0.25, false)?.label).toBe('¼×');
  });
});
