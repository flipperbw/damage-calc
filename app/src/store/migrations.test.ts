import { describe, it, expect } from 'vitest';
import { migrate, CURRENT_VERSION } from './migrations';

describe('migrate', () => {
  it('returns input unchanged at current version', () => {
    const state = { version: CURRENT_VERSION, state: { teams: [] } };
    expect(migrate(state)).toEqual(state);
  });

  it('throws on a future version', () => {
    expect(() => migrate({ version: CURRENT_VERSION + 1, state: {} } as any))
      .toThrow(/future/i);
  });

  it('returns null on totally invalid input', () => {
    expect(migrate(null as any)).toBeNull();
    expect(migrate({} as any)).toBeNull();
  });

  it('v1 -> v2 maps isMega:true to mega:"mega"', () => {
    const v1 = {
      version: 1,
      state: {
        teams: [{
          id: 't1', name: 'T', format: 'singles',
          createdAt: 0, updatedAt: 0,
          mons: [
            { id: 'm1', species: 'Garchomp', isMega: true, nature: 'Hardy', sps: {}, moves: ['','','',''], boosts: {} },
            { id: 'm2', species: 'Skarmory', isMega: false, nature: 'Hardy', sps: {}, moves: ['','','',''], boosts: {} },
          ],
        }],
        opponent: { id: 'o1', species: 'Tyranitar', isMega: false, nature: 'Hardy', sps: {}, moves: ['','','',''], boosts: {} },
        recentOpponents: [{ id: 'Tyranitar', useCount: 1, lastUsed: 0,
          mon: { id: 'r1', species: 'Tyranitar', isMega: true, nature: 'Hardy', sps: {}, moves: ['','','',''], boosts: {} } }],
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
  });
});
