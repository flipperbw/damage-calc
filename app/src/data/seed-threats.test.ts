import { describe, expect, it } from 'vitest';

import { buildSeedThreatLists } from '@/data/seed-threats';

describe('buildSeedThreatLists', () => {
  it('returns the three curated lists, all flagged as seeds', () => {
    const lists = buildSeedThreatLists();
    expect(lists).toHaveLength(3);
    for (const list of lists) {
      expect(list.isSeed).toBe(true);
      expect(list.id).toBeTruthy();
      expect(list.mons.length).toBeGreaterThan(0);
      // Each mon should have a unique id (uuid-driven).
      const ids = list.mons.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('Singles list applies the Charizard-Y mega override', () => {
    const lists = buildSeedThreatLists();
    const singles = lists.find((l) => l.seedKey === 'singles')!;
    expect(singles).toBeTruthy();
    expect(singles.format).toBe('singles');
    const zard = singles.mons.find((m) => m.species === 'Charizard');
    expect(zard?.mega).toBe('mega-y');
    expect(zard?.item).toBe('Charizardite Y');
  });

  it('Most-Used list contains Incineroar / Kingambit / Garchomp', () => {
    const lists = buildSeedThreatLists();
    const mu = lists.find((l) => l.seedKey === 'most-used')!;
    expect(mu).toBeTruthy();
    const species = mu.mons.map((m) => m.species).sort();
    expect(species).toEqual(['Garchomp', 'Incineroar', 'Kingambit']);
  });
});
