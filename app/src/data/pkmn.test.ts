import { describe, it, expect } from 'vitest';
import {
  canLearn,
  getLearnableMoveIds,
  moveDescription,
  abilityDescription,
} from './pkmn';

/**
 * These tests exercise the live @pkmn/data + @pkmn/dex bundle (gen 7). They
 * do real dynamic imports the first time around, so we bump the suite-wide
 * timeout. The data is small enough to load in well under a second once
 * cached, but cold start during a fresh `vitest run` can take a beat.
 */

describe('getLearnableMoveIds', () => {
  it('returns a non-empty Set including known Garchomp moves', async () => {
    const ids = await getLearnableMoveIds('Garchomp');
    expect(ids).toBeInstanceOf(Set);
    expect(ids.size).toBeGreaterThan(0);
    expect(ids.has('earthquake')).toBe(true);
    expect(ids.has('outrage')).toBe(true);
  });

  it('does NOT include moves Garchomp cannot learn', async () => {
    const ids = await getLearnableMoveIds('Garchomp');
    expect(ids.has('softboiled')).toBe(false);
    expect(ids.has('recover')).toBe(false);
  });

  it('returns an empty set for unknown species', async () => {
    const ids = await getLearnableMoveIds('NotAPokemon12345');
    expect(ids).toBeInstanceOf(Set);
    expect(ids.size).toBe(0);
  });
});

describe('canLearn', () => {
  it('Garchomp can learn Earthquake', async () => {
    expect(await canLearn('Garchomp', 'Earthquake')).toBe(true);
  });

  it('Pikachu cannot learn Outrage', async () => {
    expect(await canLearn('Pikachu', 'Outrage')).toBe(false);
  });
});

describe('moveDescription', () => {
  it('returns non-empty desc and shortDesc for Earthquake', async () => {
    const d = await moveDescription('Earthquake');
    expect(d.short).toBeTruthy();
    expect(d.full).toBeTruthy();
    // Earthquake's PS shortDesc mentions hitting Dig users / doubling damage.
    expect((d.short ?? '').length).toBeGreaterThan(0);
    expect((d.full ?? '').length).toBeGreaterThan(0);
  });

  it('returns empty pair for unknown move (no throw)', async () => {
    const d = await moveDescription('NotAMove12345');
    expect(d.short).toBeUndefined();
    expect(d.full).toBeUndefined();
  });
});

describe('abilityDescription', () => {
  it('returns prose for a known ability', async () => {
    const d = await abilityDescription('Levitate');
    expect(d.short).toBeTruthy();
  });

  it('returns empty pair for unknown ability', async () => {
    const d = await abilityDescription('NotAnAbility12345');
    expect(d.short).toBeUndefined();
    expect(d.full).toBeUndefined();
  });
});
