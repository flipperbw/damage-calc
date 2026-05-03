import { describe, expect, it } from 'vitest';

import { suggestAdditions } from '@/calc/suggestions';
import { TOP_POOL, type TopPoolEntry } from '@/data/top-pool';
import type { SavedMon } from '@/types';

function mon(species: string): SavedMon {
  return {
    id: species.toLowerCase(),
    species,
    nature: 'Hardy',
    sps: {},
    moves: ['', '', '', ''],
    mega: '',
    boosts: {},
  };
}

const SMALL_POOL: readonly TopPoolEntry[] = [
  { species: 'Garchomp', types: ['Dragon', 'Ground'] },
  { species: 'Heatran', types: ['Fire', 'Steel'] },
  { species: 'Ferrothorn', types: ['Grass', 'Steel'] },
  { species: 'Clefable', types: ['Fairy'] },
  { species: 'Toxapex', types: ['Poison', 'Water'] },
  { species: 'Rotom-Wash', types: ['Electric', 'Water'] },
];

describe('suggestAdditions', () => {
  it('TOP_POOL has expected size and entries are well-formed', () => {
    // Every entry built by `top-pool.ts` must have a non-empty types tuple
    // and a calc-resolved species name.
    expect(TOP_POOL.length).toBeGreaterThan(20);
    for (const e of TOP_POOL) {
      expect(typeof e.species).toBe('string');
      expect(e.species.length).toBeGreaterThan(0);
      expect(e.types.length).toBeGreaterThan(0);
    }
  });

  it('returns suggestions for an all-Water team that close common gaps', () => {
    const team = [mon('Vaporeon'), mon('Politoed'), mon('Milotic')];
    const threats: SavedMon[] = [];
    const out = suggestAdditions(team, threats, SMALL_POOL);
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThanOrEqual(8);

    // Sorted by score desc.
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1].score >= out[i].score).toBe(true);
    }

    // Ferrothorn (Grass/Steel) covers Grass-gap and resists Electric/Grass.
    // Clefable (Fairy) covers Dragon-gap. Both should rank high enough to
    // be in the result set.
    const names = out.map((s) => s.species);
    expect(names).toContain('Ferrothorn');
    expect(names).toContain('Clefable');

    // Each suggestion should carry at least one reason.
    for (const s of out) {
      expect(s.reasons.length).toBeGreaterThan(0);
    }
  });

  it('reasons cover the expected categories for an all-Water team', () => {
    const team = [mon('Vaporeon'), mon('Politoed'), mon('Milotic')];
    const out = suggestAdditions(team, [mon('Garchomp')], SMALL_POOL);

    // Ferrothorn vs an all-Water team is paradigmatic: it covers Grass
    // (offensive gap) AND resists Electric / Grass (defensive overlap).
    const ferro = out.find((s) => s.species === 'Ferrothorn')!;
    expect(ferro).toBeTruthy();
    const kinds = new Set(ferro.reasons.map((r) => r.kind));
    expect(kinds.has('offensive-gap')).toBe(true);
    expect(kinds.has('defensive-overlap')).toBe(true);
    // Should mention Grass somewhere in the reason texts.
    const texts = ferro.reasons.map((r) => r.text).join(' ');
    expect(texts).toMatch(/Grass/);
  });

  it('skips candidates that are already on the team', () => {
    const team = [mon('Garchomp'), mon('Vaporeon'), mon('Milotic')];
    const out = suggestAdditions(team, [], SMALL_POOL);
    expect(out.find((s) => s.species === 'Garchomp')).toBeUndefined();
  });

  it('mega forme on the team blocks the base species (and vice versa)', () => {
    // Pool has Charizard. Team has Charizard-Mega-Y. The base candidate
    // should be skipped because it's the same species.
    const pool: TopPoolEntry[] = [
      { species: 'Charizard', types: ['Fire', 'Flying'] },
      { species: 'Heatran', types: ['Fire', 'Steel'] },
    ];
    const team: SavedMon[] = [{ ...mon('Charizard'), mega: 'mega-y' }];
    const out = suggestAdditions(team, [], pool);
    expect(out.find((s) => s.species === 'Charizard')).toBeUndefined();

    // Reverse direction: pool has the mega forme name, team has the base.
    const pool2: TopPoolEntry[] = [
      { species: 'Charizard-Mega-Y', types: ['Fire', 'Flying'] },
      { species: 'Heatran', types: ['Fire', 'Steel'] },
    ];
    const team2: SavedMon[] = [mon('Charizard')];
    const out2 = suggestAdditions(team2, [], pool2);
    expect(out2.find((s) => s.species === 'Charizard-Mega-Y')).toBeUndefined();
  });

  it('returns an empty array when every pool entry is on the team', () => {
    const team = SMALL_POOL.map((e) => mon(e.species));
    const out = suggestAdditions(team, [], SMALL_POOL);
    expect(out).toEqual([]);
  });

  it('still produces suggestions for an empty team and empty threat list', () => {
    // Empty team has no offensive gaps reported (analyzeCoverage returns
    // []), and no defensive overlaps. With nothing to score against, no
    // suggestion accrues any points and the list is empty. This is the
    // documented "nothing to suggest" state - useful contract check.
    const out = suggestAdditions([], [], SMALL_POOL);
    expect(out).toEqual([]);
  });

  it('threat-favorable matchups add +1 with a "2× <species>" reason', () => {
    // Garchomp vs Charizard: Charizard's STABs are Fire and Flying.
    //   Fire vs Garchomp (Dragon/Ground) = 1 (neutral)
    //   Flying vs Garchomp (Dragon/Ground) = 1 (neutral)
    // → safeOnDefense passes.
    //   Garchomp's STABs Dragon/Ground vs Charizard (Fire/Flying):
    //     Ground vs Fire = 2, vs Flying = 0 → combined 0, but per-type
    //     check finds Ground vs Fire = 2 → punishesOffense passes.
    // Expected: +1 with "2× Charizard" reason.
    const team: SavedMon[] = []; // empty so only threat scoring contributes
    const threats = [mon('Charizard')];
    const pool: TopPoolEntry[] = [{ species: 'Garchomp', types: ['Dragon', 'Ground'] }];
    const out = suggestAdditions(team, threats, pool);
    expect(out).toHaveLength(1);
    expect(out[0].score).toBe(1);
    expect(out[0].reasons).toEqual([{ kind: 'threat-favorable', text: '2× Charizard' }]);
  });

  it('sorts ties alphabetically by species', () => {
    // Two synthetic candidates with identical typings → same score from
    // any inputs. Expect alphabetic order.
    const pool: TopPoolEntry[] = [
      { species: 'Zebstrika', types: ['Electric'] },
      { species: 'Manectric', types: ['Electric'] },
    ];
    const team = [mon('Vaporeon'), mon('Politoed'), mon('Milotic')];
    const out = suggestAdditions(team, [], pool);
    expect(out.map((s) => s.species)).toEqual(['Manectric', 'Zebstrika']);
  });

  it('default topPool argument falls back to TOP_POOL', () => {
    // Smoke test: calling without the third argument should use the
    // module-level constant. We just verify shape - strong assertions on
    // the live meta list belong with the SMALL_POOL fixtures above.
    const team = [mon('Vaporeon'), mon('Politoed'), mon('Milotic')];
    const out = suggestAdditions(team, [mon('Garchomp')]);
    expect(Array.isArray(out)).toBe(true);
    expect(out.length).toBeLessThanOrEqual(8);
    for (const s of out) {
      expect(typeof s.species).toBe('string');
      expect(typeof s.score).toBe('number');
      expect(s.reasons.length).toBeGreaterThan(0);
    }
  });
});
