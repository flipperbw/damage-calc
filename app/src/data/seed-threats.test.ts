import { describe, expect, it } from 'vitest';

import { buildSeedThreatLists } from '@/data/seed-threats';

describe('buildSeedThreatLists', () => {
  it('returns the curated seed lists, all flagged as seeds', () => {
    const lists = buildSeedThreatLists();
    expect(lists.length).toBeGreaterThan(0);
    for (const list of lists) {
      expect(list.isSeed).toBe(true);
      expect(list.id).toBeTruthy();
      expect(list.mons.length).toBeGreaterThan(0);
      // Each mon should have a unique id (uuid-driven).
      const ids = list.mons.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('Doubles is the first seeded list (Champions is a doubles-first format)', () => {
    const lists = buildSeedThreatLists();
    expect(lists[0]?.seedKey).toBe('doubles');
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
});
