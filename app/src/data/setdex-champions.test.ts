import { describe, it, expect } from 'vitest';
import { SETDEX_CHAMPIONS, getBuildsForSpecies, getBuild } from './setdex-champions';
import type { ChampionsBuild } from './setdex-champions';

describe('SETDEX_CHAMPIONS', () => {
  it('contains Charizard with multiple builds', () => {
    const charizard = SETDEX_CHAMPIONS['Charizard'];
    expect(charizard).toBeDefined();
    expect(Object.keys(charizard).length).toBeGreaterThan(5);
  });

  it('builds have the expected shape', () => {
    const build: ChampionsBuild | undefined =
      SETDEX_CHAMPIONS['Charizard']?.['SM OU Dragon Dance'];
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

describe('getBuild', () => {
  it('returns a specific build', () => {
    const b = getBuild('Charizard', 'SM OU Dragon Dance');
    expect(b?.nature).toBe('Jolly');
  });
  it('returns undefined for unknown', () => {
    expect(getBuild('Missingno', 'whatever')).toBeUndefined();
  });
});
