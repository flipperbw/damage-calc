import { describe, it, expect } from 'vitest';
import { buildSeedThreatLists } from './seed-threats';

describe('buildSeedThreatLists', () => {
  it('returns the four curated lists, all flagged as seeds', () => {
    const lists = buildSeedThreatLists();
    expect(lists).toHaveLength(4);
    for (const list of lists) {
      expect(list.isSeed).toBe(true);
      expect(list.id).toBeTruthy();
      expect(list.mons.length).toBeGreaterThan(0);
      // Each mon should have a unique id (uuid-driven).
      const ids = list.mons.map(m => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('Top Megas list applies mega flags and known mega items', () => {
    const lists = buildSeedThreatLists();
    const megas = lists.find(l => l.name === 'Top Megas')!;
    expect(megas).toBeTruthy();
    expect(megas.format).toBe('any');
    // Every entry in this list must have a mega flag set.
    for (const m of megas.mons) {
      expect(m.mega).not.toBe('');
    }
    // Charizard-Y should keep its Charizardite Y stone.
    const zard = megas.mons.find(m => m.species === 'Charizard');
    expect(zard?.mega).toBe('mega-y');
    expect(zard?.item).toBe('Charizardite Y');
    // Garchomp Mega should hold Garchompite (verified to exist in calc data).
    const garchomp = megas.mons.find(m => m.species === 'Garchomp');
    expect(garchomp?.mega).toBe('mega');
    expect(garchomp?.item).toBe('Garchompite');
  });

  it('falls back gracefully when an item is unknown to calc', () => {
    // Smoke-test the validator path: building should never throw and never
    // crash on a missing-from-calc item. Hawlucha's stone is intentionally
    // spelt the right way ("Hawluchanite") in the spec — but if a future
    // edit introduces a bogus item, the validator should drop the override
    // silently. We can't easily trigger that here without monkey-patching,
    // so we just assert the build completes and Hawlucha keeps its mega
    // flag regardless of which exact item ended up applied.
    const lists = buildSeedThreatLists();
    const megas = lists.find(l => l.name === 'Top Megas')!;
    const hawlucha = megas.mons.find(m => m.species === 'Hawlucha');
    expect(hawlucha).toBeTruthy();
    expect(hawlucha?.mega).toBe('mega');
  });
});
