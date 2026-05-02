import { describe, it, expect } from 'vitest';
import { isImportShape } from './SettingsScreen';

describe('isImportShape', () => {
  it('accepts an empty object', () => {
    // No required keys; accepting empty is fine — it merges nothing.
    expect(isImportShape({})).toBe(true);
  });

  it('accepts a clean persisted slice', () => {
    expect(isImportShape({
      teams: [],
      activeTeamId: null,
      activeMonIndex: 0,
      opponent: null,
      recentOpponents: [],
      field: { yourSide: {}, oppSide: {} },
      notation: 'percent',
    })).toBe(true);
  });

  it('rejects null/undefined/non-objects', () => {
    expect(isImportShape(null)).toBe(false);
    expect(isImportShape(undefined)).toBe(false);
    expect(isImportShape(42)).toBe(false);
    expect(isImportShape('json')).toBe(false);
  });

  it('rejects when teams is not an array', () => {
    expect(isImportShape({ teams: 'oops' })).toBe(false);
  });

  it('rejects when notation is invalid', () => {
    expect(isImportShape({ notation: 'wrong' })).toBe(false);
  });

  it('rejects when an action function snuck in', () => {
    expect(isImportShape({ teams: [], setOpponent: () => {} })).toBe(false);
  });

  it('rejects when activeTeamId has wrong type', () => {
    expect(isImportShape({ activeTeamId: 42 })).toBe(false);
  });

  it('accepts pixels notation', () => {
    expect(isImportShape({ notation: 'pixels' })).toBe(true);
  });
});
