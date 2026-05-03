import { describe, expect, it } from 'vitest';

import { CURRENT_VERSION, migrate } from '@/store/migrations';
import type { ThreatList } from '@/types';

describe('migrate', () => {
  it('returns input unchanged at current version', () => {
    const state = { version: CURRENT_VERSION, state: { teams: [] } };
    expect(migrate(state)).toEqual(state);
  });

  it('throws on a future version', () => {
    expect(() => migrate({ version: CURRENT_VERSION + 1, state: {} } as any)).toThrow(/future/i);
  });

  it('returns null on totally invalid input', () => {
    expect(migrate(null as any)).toBeNull();
    expect(migrate({} as any)).toBeNull();
  });

  it('v1 -> latest maps isMega:true to mega:"mega" and adds editor:null', () => {
    const v1 = {
      version: 1,
      state: {
        teams: [
          {
            id: 't1',
            name: 'T',
            format: 'singles',
            createdAt: 0,
            updatedAt: 0,
            mons: [
              { id: 'm1', species: 'Garchomp', isMega: true, nature: 'Hardy', sps: {}, moves: ['', '', '', ''], boosts: {} },
              { id: 'm2', species: 'Skarmory', isMega: false, nature: 'Hardy', sps: {}, moves: ['', '', '', ''], boosts: {} },
            ],
          },
        ],
        opponent: { id: 'o1', species: 'Tyranitar', isMega: false, nature: 'Hardy', sps: {}, moves: ['', '', '', ''], boosts: {} },
        recentOpponents: [
          {
            id: 'Tyranitar',
            useCount: 1,
            lastUsed: 0,
            mon: { id: 'r1', species: 'Tyranitar', isMega: true, nature: 'Hardy', sps: {}, moves: ['', '', '', ''], boosts: {} },
          },
        ],
      },
    };
    const out = migrate(v1)!;
    expect(out.version).toBe(CURRENT_VERSION);
    const team = out.state.teams[0];
    expect(team.mons[0].mega).toBe('mega');
    expect((team.mons[0] as any).isMega).toBeUndefined();
    expect(team.mons[1].mega).toBe('');
    expect(out.state.opponent!.mega).toBe('');
    expect(out.state.recentOpponents[0].mon.mega).toBe('mega');
    // v3 step initialises editor to null on old states.
    expect(out.state.editor).toBeNull();
    // v4 step injects the curated seed threat lists.
    expect(out.state.threatLists.length).toBeGreaterThan(0);
    expect(out.state.threatLists.every((l) => l.isSeed)).toBe(true);
  });

  it('v2 -> v3 initialises editor:null on a state that already has v2 mega field', () => {
    const v2 = {
      version: 2,
      state: {
        teams: [],
        activeTeamId: null,
        activeMonIndex: 0,
        opponent: null,
        recentOpponents: [],
        notation: 'percent',
      },
    };
    const out = migrate(v2)!;
    expect(out.version).toBe(CURRENT_VERSION);
    expect(out.state.editor).toBeNull();
  });

  it('v3 -> v4 injects the three curated seed threat lists', () => {
    const v3 = {
      version: 3,
      state: {
        teams: [],
        activeTeamId: null,
        activeMonIndex: 0,
        opponent: null,
        recentOpponents: [],
        notation: 'percent',
        editor: null,
      },
    };
    const out = migrate(v3)!;
    expect(out.version).toBe(CURRENT_VERSION);
    expect(out.state.threatLists).toHaveLength(3);
    const names = out.state.threatLists.map((l) => l.name);
    expect(names).toContain('Top Threats - Singles');
    expect(names).toContain('Top Threats - Doubles / VGC');
    expect(names).toContain('Most-Used');
    // All seeds should be flagged isSeed and have mons populated.
    for (const list of out.state.threatLists) {
      expect(list.isSeed).toBe(true);
      expect(list.mons.length).toBeGreaterThan(0);
    }
  });

  it('v3 -> v4 is idempotent: an existing non-empty threatLists is not re-seeded', () => {
    const existing: ThreatList = {
      id: 'user-1',
      name: 'My List',
      format: 'singles',
      mons: [],
      isSeed: false,
      createdAt: 0,
      updatedAt: 0,
    };
    const v3 = {
      version: 3,
      state: {
        teams: [],
        activeTeamId: null,
        activeMonIndex: 0,
        opponent: null,
        recentOpponents: [],
        notation: 'percent',
        editor: null,
        threatLists: [existing],
      },
    };
    const out = migrate(v3)!;
    expect(out.state.threatLists).toHaveLength(1);
    expect(out.state.threatLists[0].id).toBe('user-1');
  });

  it('migrating an already-v4 state is a no-op', () => {
    const seeds: ThreatList[] = [{ id: 's1', name: 'Seed', format: 'any', mons: [], isSeed: true, createdAt: 0, updatedAt: 0 }];
    const v4 = {
      version: 4,
      state: {
        teams: [],
        activeTeamId: null,
        activeMonIndex: 0,
        opponent: null,
        recentOpponents: [],
        notation: 'percent',
        editor: null,
        threatLists: seeds,
      },
    };
    const out = migrate(v4)!;
    expect(out.version).toBe(4);
    expect(out.state.threatLists).toEqual(seeds);
  });

  it('v3 -> v4 with empty threatLists array still injects seeds', () => {
    const v3 = {
      version: 3,
      state: {
        teams: [],
        activeTeamId: null,
        activeMonIndex: 0,
        opponent: null,
        recentOpponents: [],
        notation: 'percent',
        editor: null,
        threatLists: [],
      },
    };
    const out = migrate(v3)!;
    expect(out.state.threatLists.length).toBeGreaterThan(0);
  });
});
