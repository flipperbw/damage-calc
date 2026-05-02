import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './index';

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
  it('setOpponent records in recents', () => {
    useStore.getState().setOpponent({
      id: 'o', species: 'Skarmory', nature: 'Impish',
      sps: {}, moves: ['','','',''], isMega: false, boosts: {},
    });
    expect(useStore.getState().recentOpponents).toHaveLength(1);
  });
});
