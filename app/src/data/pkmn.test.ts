import { describe, it, expect } from 'vitest';
import {
  canLearn,
  getLearnableMoveIds,
  moveDescription,
  abilityDescription,
  preloadPkmn,
  priorityOverride,
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

describe('priorityOverride', () => {
  it('returns -7 for Trick Room after preload', async () => {
    await preloadPkmn();
    expect(priorityOverride('Trick Room')).toBe(-7);
  });

  it('returns the right priority for other audited moves', async () => {
    await preloadPkmn();
    // calc's gen-0 data already includes Sucker Punch / Quick Attack at +1,
    // so the override is incidental, but pkmn-data should agree.
    expect(priorityOverride('Sucker Punch')).toBe(1);
    expect(priorityOverride('Quick Attack')).toBe(1);
    // Roar / Whirlwind are -6 in real games but calc reports 0 (status moves
    // with no priority field). The override fills the gap.
    expect(priorityOverride('Roar')).toBe(-6);
    expect(priorityOverride('Whirlwind')).toBe(-6);
  });

  it('returns null for plain moves with no special priority', async () => {
    await preloadPkmn();
    expect(priorityOverride('Earthquake')).toBeNull();
    expect(priorityOverride('Tackle')).toBeNull();
  });

  it('returns null for unknown moves', async () => {
    await preloadPkmn();
    expect(priorityOverride('NotAMove12345')).toBeNull();
  });
});
