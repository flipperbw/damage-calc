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

  it('duplicateTeam clones the team with new ids', () => {
    const id = useStore.getState().createTeam({ name: 'Orig', format: 'singles' });
    useStore.getState().upsertMon(id, mon('Skarmory'));
    const newId = useStore.getState().duplicateTeam(id);
    expect(newId).toBeTruthy();
    const s = useStore.getState();
    expect(s.teams).toHaveLength(2);
    const copy = s.teams.find(t => t.id === newId)!;
    expect(copy.name).toBe('Orig (copy)');
    expect(copy.mons).toHaveLength(1);
    expect(copy.mons[0].species).toBe('Skarmory');
    // Different mon id from the original.
    const orig = s.teams.find(t => t.id === id)!;
    expect(copy.mons[0].id).not.toBe(orig.mons[0].id);
  });

  it('duplicateTeam returns null for unknown id', () => {
    expect(useStore.getState().duplicateTeam('does-not-exist')).toBeNull();
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

describe('store: editor target', () => {
  it('starts with editor null', () => {
    expect(useStore.getState().editor).toBeNull();
  });

  it('setEditor stores a team-mon target', () => {
    useStore.getState().setEditor({ kind: 'team-mon', teamId: 't1', monId: 'm1' });
    expect(useStore.getState().editor).toEqual({ kind: 'team-mon', teamId: 't1', monId: 'm1' });
  });

  it('setEditor stores an opponent target', () => {
    useStore.getState().setEditor({ kind: 'opponent' });
    expect(useStore.getState().editor).toEqual({ kind: 'opponent' });
  });

  it('setEditor(null) clears the target', () => {
    useStore.getState().setEditor({ kind: 'opponent' });
    useStore.getState().setEditor(null);
    expect(useStore.getState().editor).toBeNull();
  });

  it('removeMon clears editor when it points at the removed mon', () => {
    const id = useStore.getState().createTeam({ name: 'T', format: 'singles' });
    const m = mon('Garchomp');
    useStore.getState().upsertMon(id, m);
    useStore.getState().setEditor({ kind: 'team-mon', teamId: id, monId: m.id });
    useStore.getState().removeMon(id, m.id);
    expect(useStore.getState().editor).toBeNull();
  });

  it('removeMon leaves editor alone when pointing at a different mon', () => {
    const id = useStore.getState().createTeam({ name: 'T', format: 'singles' });
    const m1 = mon('Garchomp');
    const m2 = mon('Skarmory');
    useStore.getState().upsertMon(id, m1);
    useStore.getState().upsertMon(id, m2);
    useStore.getState().setEditor({ kind: 'team-mon', teamId: id, monId: m1.id });
    useStore.getState().removeMon(id, m2.id);
    expect(useStore.getState().editor).toEqual({ kind: 'team-mon', teamId: id, monId: m1.id });
  });

  it('deleteTeam clears editor when it points at a mon in the deleted team', () => {
    const id = useStore.getState().createTeam({ name: 'T', format: 'singles' });
    const m = mon('Garchomp');
    useStore.getState().upsertMon(id, m);
    useStore.getState().setEditor({ kind: 'team-mon', teamId: id, monId: m.id });
    useStore.getState().deleteTeam(id);
    expect(useStore.getState().editor).toBeNull();
  });

  it('deleteTeam leaves editor alone when it points at the opponent', () => {
    const id = useStore.getState().createTeam({ name: 'T', format: 'singles' });
    useStore.getState().setEditor({ kind: 'opponent' });
    useStore.getState().deleteTeam(id);
    expect(useStore.getState().editor).toEqual({ kind: 'opponent' });
  });
});
