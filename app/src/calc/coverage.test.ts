import { describe, it, expect } from 'vitest';
import { analyzeCoverage, STANDARD_TYPES } from './coverage';
import type { SavedMon } from '../types';

function mon(
  species: string,
  moves: [string, string, string, string] = ['', '', '', ''],
): SavedMon {
  return {
    id: species.toLowerCase(),
    species,
    nature: 'Hardy',
    sps: {},
    moves,
    mega: '',
    boosts: {},
  };
}

describe('analyzeCoverage', () => {
  it('returns empty arrays for an empty team', () => {
    const r = analyzeCoverage([]);
    expect(r.offensiveGaps).toEqual([]);
    expect(r.defensiveOverlaps).toEqual([]);
  });

  it('flags Electric and Grass as defensive overlaps for an all-Water team', () => {
    // Three pure-Water mons that exist in calc gen 0: each is 2× weak to
    // Electric and 2× weak to Grass, well past the 3-mon overlap
    // threshold.
    const team = [mon('Vaporeon'), mon('Politoed'), mon('Milotic')];
    const r = analyzeCoverage(team);
    const overlapTypes = r.defensiveOverlaps.map(o => o.type);
    expect(overlapTypes).toContain('Electric');
    expect(overlapTypes).toContain('Grass');
    // All three mons are weak - count must be 3 for both.
    expect(r.defensiveOverlaps.find(o => o.type === 'Electric')?.count).toBe(3);
    expect(r.defensiveOverlaps.find(o => o.type === 'Grass')?.count).toBe(3);
  });

  it('all-Water (no moves) team has Grass / Dragon / Water as offensive gaps', () => {
    const team = [mon('Vaporeon'), mon('Politoed'), mon('Milotic')];
    const r = analyzeCoverage(team);
    // Water resists itself, Grass, and Dragon (and Fire is 2× SE so it's
    // NOT a gap). Grass / Dragon / Water should all show up as gaps.
    expect(r.offensiveGaps).toContain('Grass');
    expect(r.offensiveGaps).toContain('Dragon');
    expect(r.offensiveGaps).toContain('Water');
  });

  it('all-Water team can SE Fire / Ground / Rock - those are not gaps', () => {
    const team = [mon('Vaporeon'), mon('Politoed'), mon('Milotic')];
    const r = analyzeCoverage(team);
    expect(r.offensiveGaps).not.toContain('Fire');
    expect(r.offensiveGaps).not.toContain('Ground');
    expect(r.offensiveGaps).not.toContain('Rock');
  });

  it('Garchomp + Charizard + Skarmory has known coverage profile', () => {
    // STAB types in play: Ground, Dragon (Garchomp), Fire, Flying
    // (Charizard), Steel, Flying (Skarmory). Combined SE coverage hits a
    // wide swath of types; a few hold-out defenders remain.
    const team = [mon('Garchomp'), mon('Charizard'), mon('Skarmory')];
    const r = analyzeCoverage(team);

    // SE coverage from STABs alone:
    //   Ground → Fire/Electric/Poison/Rock/Steel
    //   Dragon → Dragon
    //   Fire → Bug/Grass/Ice/Steel
    //   Flying → Bug/Fighting/Grass
    //   Steel → Fairy/Ice/Rock
    // Types NOT covered SE by any STAB: Normal, Water, Ghost, Dark,
    // Ground, Flying, Psychic.
    for (const expected of ['Normal', 'Water', 'Ghost', 'Dark', 'Ground', 'Flying', 'Psychic']) {
      expect(r.offensiveGaps).toContain(expected);
    }
    // And these MUST be covered:
    for (const covered of ['Fairy', 'Steel', 'Dragon', 'Fire', 'Ice', 'Rock', 'Bug', 'Grass']) {
      expect(r.offensiveGaps).not.toContain(covered);
    }
  });

  it('moves on the team contribute to offensive coverage', () => {
    // Steel/Ground-heavy team's STAB pool (Steel/Ground/Flying) leaves
    // Dragon uncovered - Steelix is Ground/Steel, Excadrill is
    // Ground/Steel, Skarmory is Steel/Flying.
    const baseTeam = [mon('Skarmory'), mon('Excadrill'), mon('Steelix')];
    const baseReport = analyzeCoverage(baseTeam);
    expect(baseReport.offensiveGaps).toContain('Dragon');

    // Adding a Dragon-type move (Outrage) anywhere on the team should
    // close the Dragon gap.
    const withDragonMove = [
      mon('Skarmory', ['Outrage', '', '', '']),
      mon('Excadrill'),
      mon('Steelix'),
    ];
    const withReport = analyzeCoverage(withDragonMove);
    expect(withReport.offensiveGaps).not.toContain('Dragon');
  });

  it('a Steel move closes the Fairy/Ice/Rock gap on a Water team', () => {
    // All-Water team has gaps for things Water doesn't SE. Adding any
    // mon with a Steel move (Iron Head) closes Fairy/Ice/Rock.
    const team = [
      mon('Vaporeon', ['Iron Head', '', '', '']),
      mon('Politoed'),
      mon('Milotic'),
    ];
    const r = analyzeCoverage(team);
    expect(r.offensiveGaps).not.toContain('Fairy');
    expect(r.offensiveGaps).not.toContain('Ice');
    expect(r.offensiveGaps).not.toContain('Rock');
  });

  it('only the 18 standard types are considered for gaps', () => {
    const r = analyzeCoverage([mon('Garchomp')]);
    for (const t of r.offensiveGaps) {
      expect(STANDARD_TYPES).toContain(t);
    }
    expect(r.offensiveGaps).not.toContain('???');
    expect(r.offensiveGaps).not.toContain('Status');
  });

  it('defensive overlaps are sorted by count descending', () => {
    // Mixed Steel/Water-heavy team: Skarmory (Steel/Flying), Excadrill
    // (Ground/Steel), Empoleon (Water/Steel), Sharpedo (Water/Dark). All
    // four are weak to Electric (Skarmory is doubly weak via Flying-aside
    // it's still 2× via Steel)… actually Skarmory is Steel/Flying which is
    // 1× Electric (Steel resists)… let's compute: Steel resists Electric
    // (½), Flying is 2× weak → 1×. Excadrill (Ground/Steel) is immune to
    // Electric. So Electric overlap is just Empoleon + Sharpedo (2 < 3) -
    // not enough. Fighting: Skarmory (Steel 2× × Flying ½ = 1×) no,
    // Excadrill (Steel 2× × Ground 1 = 2×) yes, Empoleon (Steel 2×
    // × Water 1 = 2×) yes, Sharpedo (Dark 2× × Water 1 = 2×) yes.
    // Three mons → Fighting overlap count 3. Good.
    const team = [
      mon('Skarmory'),
      mon('Excadrill'),
      mon('Empoleon'),
      mon('Sharpedo'),
    ];
    const r = analyzeCoverage(team);
    // Sanity: counts must be monotonically non-increasing.
    for (let i = 1; i < r.defensiveOverlaps.length; i++) {
      expect(r.defensiveOverlaps[i - 1].count >= r.defensiveOverlaps[i].count).toBe(true);
    }
    // Fighting hits 3 of these - should be present.
    expect(r.defensiveOverlaps.map(o => o.type)).toContain('Fighting');
  });
});
