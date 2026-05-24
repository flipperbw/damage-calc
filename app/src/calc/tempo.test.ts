import { describe, expect, it } from 'vitest';

import { inferTeamTempo } from '@/calc/tempo';
import type { FieldState, SavedMon } from '@/types';

function mon(species: string, moves: SavedMon['moves'] = ['', '', '', '']): SavedMon {
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

const FIELD: FieldState = { yourSide: {}, oppSide: {} };

describe('inferTeamTempo', () => {
  it('defaults to normal for a vanilla team and inactive field', () => {
    const team = { mons: [mon('Garchomp'), mon('Heatran')] };
    expect(inferTeamTempo(team, FIELD)).toBe('normal');
  });

  it("flags TR when any drafted mon's moveset contains Trick Room", () => {
    const team = { mons: [mon('Bronzong', ['Trick Room', 'Gyro Ball', '', ''])] };
    expect(inferTeamTempo(team, FIELD)).toBe('trick-room');
  });

  it('flags TR when the live field has isTrickRoom on', () => {
    expect(inferTeamTempo({ mons: [mon('Garchomp')] }, { ...FIELD, isTrickRoom: true })).toBe('trick-room');
  });

  it('normalises move spelling/casing via toID before matching', () => {
    expect(inferTeamTempo({ mons: [mon('Bronzong', ['trick room', '', '', ''])] }, FIELD)).toBe('trick-room');
    expect(inferTeamTempo({ mons: [mon('Bronzong', ['trickroom', '', '', ''])] }, FIELD)).toBe('trick-room');
  });

  it('ignores empty move slots when scanning', () => {
    const team = { mons: [mon('Garchomp', ['', '', '', ''])] };
    expect(inferTeamTempo(team, FIELD)).toBe('normal');
  });
});
