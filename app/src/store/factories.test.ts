import { describe, expect, it } from 'vitest';

import { getBuild, getBuildsForSpecies } from '@/data/setdex-champions';
import { defaultOpponentMon, emptyMon, monFromBuild } from '@/store/factories';

describe('emptyMon', () => {
  it('returns a blank mon with the given species', () => {
    const m = emptyMon('Charizard');
    expect(m.species).toBe('Charizard');
    expect(m.nature).toBe('Hardy');
    expect(m.moves).toEqual(['', '', '', '']);
    expect(m.mega).toBe('');
    expect(m.sps).toEqual({});
    expect(m.boosts).toEqual({});
    expect(m.id).toBeTruthy();
  });
});

describe('monFromBuild', () => {
  it('hydrates from a curated build', () => {
    const builds = getBuildsForSpecies('Charizard');
    expect(builds.length).toBeGreaterThan(0);
    const name = builds[0];
    const m = monFromBuild('Charizard', name);
    expect(m).not.toBeNull();
    const expected = getBuild('Charizard', name)!;
    expect(m!.species).toBe('Charizard');
    expect(m!.buildName).toBe(name);
    expect(m!.item).toBe(expected.item);
    expect(m!.ability).toBe(expected.ability);
    expect(m!.nature).toBe(expected.nature);
    expect(m!.sps).toEqual(expected.sps);
    expect(m!.moves).toEqual([expected.moves[0] ?? '', expected.moves[1] ?? '', expected.moves[2] ?? '', expected.moves[3] ?? '']);
  });

  it('returns null when the build does not exist', () => {
    expect(monFromBuild('Charizard', 'No Such Build')).toBeNull();
  });
});

describe('defaultOpponentMon', () => {
  it('uses the first curated build when one exists', () => {
    const builds = getBuildsForSpecies('Garchomp');
    expect(builds.length).toBeGreaterThan(0);
    const m = defaultOpponentMon('Garchomp');
    const expected = getBuild('Garchomp', builds[0])!;
    expect(m.species).toBe('Garchomp');
    expect(m.buildName).toBe(builds[0]);
    expect(m.item).toBe(expected.item);
    expect(m.ability).toBe(expected.ability);
    expect(m.nature).toBe(expected.nature);
    // Lowest-indexed entry: confirm by sps shape match.
    expect(m.sps).toEqual(expected.sps);
  });

  it('falls back to emptyMon when the species has no curated builds', () => {
    // A species we know has no builds in the curated set. Pick something
    // sufficiently obscure; verify by checking the build list is empty.
    // If this assertion ever flakes when builds are added, we'll just
    // pick a different species - the contract under test is the fallback.
    const candidates = ['Mr. Mime', 'Sunkern', 'Unown', 'Caterpie'];
    const noBuildSpecies = candidates.find((c) => getBuildsForSpecies(c).length === 0);
    expect(noBuildSpecies).toBeDefined();
    const m = defaultOpponentMon(noBuildSpecies!);
    expect(m.species).toBe(noBuildSpecies);
    expect(m.buildName).toBeUndefined();
    expect(m.moves).toEqual(['', '', '', '']);
  });
});
