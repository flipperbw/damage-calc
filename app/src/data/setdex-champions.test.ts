import { describe, expect, it } from 'vitest';

import { getBuild, getBuildsForSpecies, SETDEX_CHAMPIONS, type ChampionsBuild } from '@/data/setdex-champions';

describe('SETDEX_CHAMPIONS', () => {
  it('contains Charizard with multiple builds', () => {
    const charizard = SETDEX_CHAMPIONS['Charizard'];
    expect(charizard).toBeDefined();
    expect(Object.keys(charizard).length).toBeGreaterThan(5);
  });

  it('builds have the expected shape', () => {
    const build: ChampionsBuild | undefined = SETDEX_CHAMPIONS['Charizard']?.['SM OU Dragon Dance'];
    expect(build).toBeDefined();
    expect(build!.item).toBe('Charizardite X');
    expect(build!.moves).toContain('Dragon Dance');
  });
});

describe('getBuildsForSpecies', () => {
  it('returns build names for a species', () => {
    const names = getBuildsForSpecies('Garchomp');
    expect(names).toBeInstanceOf(Array);
  });
  it('returns empty array for unknown species', () => {
    expect(getBuildsForSpecies('Missingno')).toEqual([]);
  });
});

describe('mostly-mega mons default to their mega set', () => {
  // These species run their mega stone as the overwhelmingly most-used item on
  // Pikalytics, but their base-forme tournament sheets (the scraper's usual
  // variant source) don't contain the stone - it lives under the separate
  // "<Mon>-Mega" endpoint. The scraper's mega-forme correction folds the
  // dominant stone back in so the default (first build) is the mega set. Guard
  // against a future re-scrape silently regressing that to a rare base build.
  const MOSTLY_MEGA = ['Staraptor', 'Scrafty', 'Tyranitar', 'Dragonite', 'Aerodactyl', 'Blaziken', 'Kangaskhan', 'Venusaur'];
  for (const species of MOSTLY_MEGA) {
    it(`${species}'s first build is a mega set`, () => {
      const first = getBuildsForSpecies(species)[0];
      expect(first).toBeDefined();
      const build = getBuild(species, first);
      expect(build?.mega).toBeTruthy();
    });
  }
});

describe('getBuild', () => {
  it('returns a specific build', () => {
    const b = getBuild('Charizard', 'SM OU Dragon Dance');
    expect(b?.nature).toBe('Jolly');
  });
  it('returns undefined for unknown', () => {
    expect(getBuild('Missingno', 'whatever')).toBeUndefined();
  });
});
