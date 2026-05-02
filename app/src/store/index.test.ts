import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './index';
import type { SavedMon } from '../types';

const mon = (species: string, over: Partial<SavedMon> = {}): SavedMon => ({
  id: species, species, nature: 'Hardy',
  sps: {}, moves: ['', '', '', ''], mega: '', boosts: {},
  ...over,
});

beforeEach(() => {
  localStorage.clear();
  useStore.persist.clearStorage();
  useStore.setState(useStore.getInitialState());
});

describe('store: teams', () => {
  it('starts with no teams', () => {
    expect(useStore.getState().teams).toEqual([]);
    expect(useStore.getState().activeTeamId).toBeNull();
  });

  it('createTeam adds a team and makes it active', () => {
    const id = useStore.getState().createTeam({ name: 'Test', format: 'singles' });
    const s = useStore.getState();
    expect(s.teams).toHaveLength(1);
    expect(s.activeTeamId).toBe(id);
    expect(s.teams[0].name).toBe('Test');
  });

  it('deleteTeam removes a team and clears active if needed', () => {
    const id = useStore.getState().createTeam({ name: 'X', format: 'singles' });
    useStore.getState().deleteTeam(id);
    expect(useStore.getState().teams).toEqual([]);
    expect(useStore.getState().activeTeamId).toBeNull();
  });
});

describe('store: opponent + recents', () => {
  it('setOpponent records a recent for a new species', () => {
    useStore.getState().setOpponent(mon('Skarmory'));
    expect(useStore.getState().recentOpponents).toHaveLength(1);
    expect(useStore.getState().recentOpponents[0].useCount).toBe(1);
  });

  it('setOpponent does NOT bump recents when species is unchanged', () => {
    useStore.getState().setOpponent(mon('Skarmory'));
    // Re-set with same species (e.g. round-trip through editor) — should not
    // increment useCount. addRecent would only fire on a species change.
    useStore.getState().setOpponent(mon('Skarmory', { ability: 'Sturdy' }));
    const recents = useStore.getState().recentOpponents;
    expect(recents).toHaveLength(1);
    expect(recents[0].useCount).toBe(1);
  });

  it('setOpponent bumps recents when species changes', () => {
    useStore.getState().setOpponent(mon('Skarmory'));
    useStore.getState().setOpponent(mon('Garchomp'));
    expect(useStore.getState().recentOpponents).toHaveLength(2);
    // Most-recent first.
    expect(useStore.getState().recentOpponents[0].mon.species).toBe('Garchomp');
  });

  it('setOpponent(null) does not touch recents', () => {
    useStore.getState().setOpponent(mon('Skarmory'));
    const before = useStore.getState().recentOpponents;
    useStore.getState().setOpponent(null);
    expect(useStore.getState().opponent).toBeNull();
    expect(useStore.getState().recentOpponents).toEqual(before);
  });

  it('updateOpponent patches without bumping recents', () => {
    useStore.getState().setOpponent(mon('Skarmory'));
    useStore.getState().updateOpponent({ currentHp: 100 });
    useStore.getState().updateOpponent({ mega: 'mega' });
    const s = useStore.getState();
    expect(s.opponent?.currentHp).toBe(100);
    expect(s.opponent?.mega).toBe('mega');
    expect(s.recentOpponents).toHaveLength(1);
    expect(s.recentOpponents[0].useCount).toBe(1);
  });

  it('updateOpponent is a no-op when there is no opponent', () => {
    useStore.getState().updateOpponent({ currentHp: 50 });
    expect(useStore.getState().opponent).toBeNull();
  });
});
