import { describe, expect, it } from 'vitest';

import { clampMoveStateValue, getMoveStateSpec, moveStateBasePower } from '@/calc/move-state';

describe('getMoveStateSpec', () => {
  it('resolves qualifying moves regardless of casing/spacing', () => {
    expect(getMoveStateSpec('Last Respects')?.label).toBe('Allies fainted');
    expect(getMoveStateSpec('last respects')?.label).toBe('Allies fainted');
    expect(getMoveStateSpec('Rage Fist')?.label).toBe('Times hit');
  });

  it('returns undefined for ordinary moves and empty input', () => {
    expect(getMoveStateSpec('Earthquake')).toBeUndefined();
    expect(getMoveStateSpec('')).toBeUndefined();
    expect(getMoveStateSpec(undefined)).toBeUndefined();
  });
});

describe('bp formulas', () => {
  it('Last Respects = 50 * (fainted + 1)', () => {
    const spec = getMoveStateSpec('Last Respects')!;
    expect(spec.bp(0)).toBe(50);
    expect(spec.bp(3)).toBe(200);
    expect(spec.bp(5)).toBe(300);
  });

  it('Rage Fist = 50 + 50 * hits', () => {
    const spec = getMoveStateSpec('Rage Fist')!;
    expect(spec.bp(0)).toBe(50);
    expect(spec.bp(1)).toBe(100);
    expect(spec.bp(6)).toBe(350);
  });
});

describe('clampMoveStateValue', () => {
  const spec = getMoveStateSpec('Rage Fist')!;
  it('clamps into range and rounds', () => {
    expect(clampMoveStateValue(spec, -3)).toBe(0);
    expect(clampMoveStateValue(spec, 99)).toBe(6);
    expect(clampMoveStateValue(spec, 2.4)).toBe(2);
  });
  it('falls back to default for non-finite input', () => {
    expect(clampMoveStateValue(spec, NaN)).toBe(spec.default);
  });
});

describe('moveStateBasePower', () => {
  it('returns undefined for non-registry moves', () => {
    expect(moveStateBasePower('Earthquake', { moveState: {} })).toBeUndefined();
  });

  it('uses the stored value when present', () => {
    expect(moveStateBasePower('Rage Fist', { moveState: { ragefist: 4 } })).toBe(250);
    expect(moveStateBasePower('Last Respects', { moveState: { lastrespects: 2 } })).toBe(150);
  });

  it('falls back to the spec default when no value is stored', () => {
    expect(moveStateBasePower('Rage Fist', { moveState: {} })).toBe(50);
    expect(moveStateBasePower('Rage Fist', {})).toBe(50);
  });

  it('clamps an out-of-range stored value', () => {
    expect(moveStateBasePower('Rage Fist', { moveState: { ragefist: 100 } })).toBe(350);
  });
});
