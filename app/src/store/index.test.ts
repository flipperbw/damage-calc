import { beforeEach, describe, expect, it } from 'vitest';

import { useStore } from '@/store';
import type { SavedMon } from '@/types';

const mon = (species: string, over: Partial<SavedMon> = {}): SavedMon => ({
  id: species,
  species,
  nature: 'Hardy',
  sps: {},
  moves: ['', '', '', ''],
  mega: '',
  boosts: {},
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
    const copy = s.teams.find((t) => t.id === newId)!;
    expect(copy.name).toBe('Orig (copy)');
    expect(copy.mons).toHaveLength(1);
    expect(copy.mons[0].species).toBe('Skarmory');
    // Different mon id from the original.
    const orig = s.teams.find((t) => t.id === id)!;
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
    // Re-set with same species (e.g. round-trip through editor) - should not
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

  it('removeMon clamps activeMonIndex when the active mon is the last one removed', () => {
    const id = useStore.getState().createTeam({ name: 'T', format: 'singles' });
    const m1 = mon('Garchomp');
    const m2 = mon('Skarmory');
    useStore.getState().upsertMon(id, m1);
    useStore.getState().upsertMon(id, m2);
    // Active team + active index pointing at the last mon.
    useStore.setState({ activeMonIndex: 1 });
    useStore.getState().removeMon(id, m2.id);
    expect(useStore.getState().activeMonIndex).toBe(0);
  });

  it('removeMon does not clamp when the team being modified is not active', () => {
    const a = useStore.getState().createTeam({ name: 'A', format: 'singles' });
    const b = useStore.getState().createTeam({ name: 'B', format: 'singles' });
    const m1 = mon('Garchomp');
    const m2 = mon('Skarmory');
    useStore.getState().upsertMon(a, m1);
    useStore.getState().upsertMon(a, m2);
    // Switch active to B but leave activeMonIndex at 1 (a stale leftover).
    useStore.getState().setActiveTeam(b);
    useStore.setState({ activeMonIndex: 1 });
    useStore.getState().removeMon(a, m2.id);
    expect(useStore.getState().activeMonIndex).toBe(1);
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

describe('store: threat lists', () => {
  // The base store now seeds curated threat lists at initial state (so first-
  // run users get them without a migration). Wipe to a clean slate for the
  // CRUD assertions below; the seed-injection itself is covered by the
  // migration tests in migrations.test.ts and seed-threats.test.ts.
  beforeEach(() => {
    useStore.setState({ threatLists: [] });
  });

  it("starts empty after this suite's beforeEach (CRUD baseline)", () => {
    expect(useStore.getState().threatLists).toEqual([]);
  });

  it('createThreatList adds an empty non-seed list and returns its id', () => {
    const id = useStore.getState().createThreatList({ name: 'Mine', format: 'singles' });
    const lists = useStore.getState().threatLists;
    expect(lists).toHaveLength(1);
    expect(lists[0].id).toBe(id);
    expect(lists[0].name).toBe('Mine');
    expect(lists[0].format).toBe('singles');
    expect(lists[0].mons).toEqual([]);
    expect(lists[0].isSeed).toBe(false);
  });

  it('renameThreatList updates the name and bumps updatedAt', async () => {
    const id = useStore.getState().createThreatList({ name: 'Mine', format: 'any' });
    const before = useStore.getState().threatLists[0].updatedAt;
    // Force a perceptible time delta so updatedAt actually changes.
    await new Promise((r) => setTimeout(r, 2));
    useStore.getState().renameThreatList(id, 'Renamed');
    const after = useStore.getState().threatLists[0];
    expect(after.name).toBe('Renamed');
    expect(after.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it('duplicateThreatList copies mons with new ids and clears isSeed', () => {
    // Inject a seed list manually.
    const seed = {
      id: 'seed-1',
      name: 'Seed',
      format: 'any' as const,
      mons: [
        {
          id: 'orig-mon',
          species: 'Garchomp',
          nature: 'Hardy',
          sps: {},
          moves: ['', '', '', ''] as [string, string, string, string],
          mega: '' as const,
          boosts: {},
        },
      ],
      isSeed: true,
      createdAt: 0,
      updatedAt: 0,
    };
    useStore.setState({ threatLists: [seed] });
    const newId = useStore.getState().duplicateThreatList('seed-1');
    expect(newId).toBeTruthy();
    const lists = useStore.getState().threatLists;
    expect(lists).toHaveLength(2);
    const copy = lists.find((l) => l.id === newId)!;
    expect(copy.name).toBe('Seed (copy)');
    expect(copy.isSeed).toBe(false);
    expect(copy.mons).toHaveLength(1);
    expect(copy.mons[0].species).toBe('Garchomp');
    expect(copy.mons[0].id).not.toBe('orig-mon');
  });

  it('duplicateThreatList returns null for unknown id', () => {
    expect(useStore.getState().duplicateThreatList('nope')).toBeNull();
  });

  it('deleteThreatList removes a non-seed list', () => {
    const id = useStore.getState().createThreatList({ name: 'Mine', format: 'any' });
    useStore.getState().deleteThreatList(id);
    expect(useStore.getState().threatLists).toEqual([]);
  });

  it('deleteThreatList refuses to remove a seed list', () => {
    const seed = {
      id: 'seed-1',
      name: 'Seed',
      format: 'any' as const,
      mons: [],
      isSeed: true,
      createdAt: 0,
      updatedAt: 0,
    };
    useStore.setState({ threatLists: [seed] });
    useStore.getState().deleteThreatList('seed-1');
    // Still there.
    expect(useStore.getState().threatLists).toHaveLength(1);
    expect(useStore.getState().threatLists[0].id).toBe('seed-1');
  });

  it('upsertThreatMon adds a new mon then updates it in place', () => {
    const id = useStore.getState().createThreatList({ name: 'Mine', format: 'any' });
    const m: SavedMon = mon('Garchomp');
    useStore.getState().upsertThreatMon(id, m);
    expect(useStore.getState().threatLists[0].mons).toHaveLength(1);
    expect(useStore.getState().threatLists[0].mons[0].species).toBe('Garchomp');
    // Same id -> replace.
    useStore.getState().upsertThreatMon(id, { ...m, ability: 'Rough Skin' });
    const mons = useStore.getState().threatLists[0].mons;
    expect(mons).toHaveLength(1);
    expect(mons[0].ability).toBe('Rough Skin');
  });

  it('removeThreatMon drops the mon from the list (allows leaving 0 mons even on seeds)', () => {
    const seedMon: SavedMon = mon('Garchomp');
    const seed = {
      id: 'seed-1',
      name: 'Seed',
      format: 'any' as const,
      mons: [seedMon],
      isSeed: true,
      createdAt: 0,
      updatedAt: 0,
    };
    useStore.setState({ threatLists: [seed] });
    useStore.getState().removeThreatMon('seed-1', seedMon.id);
    expect(useStore.getState().threatLists[0].mons).toEqual([]);
  });

  it('removeThreatMon is a no-op for unknown list ids', () => {
    const id = useStore.getState().createThreatList({ name: 'Mine', format: 'any' });
    useStore.getState().upsertThreatMon(id, mon('Garchomp'));
    useStore.getState().removeThreatMon('nope', 'Garchomp');
    expect(useStore.getState().threatLists[0].mons).toHaveLength(1);
  });

  it('removeThreatMon clears editor when it points at the removed mon', () => {
    const id = useStore.getState().createThreatList({ name: 'Mine', format: 'any' });
    const m = mon('Garchomp');
    useStore.getState().upsertThreatMon(id, m);
    useStore.getState().setEditor({
      kind: 'threat-mon',
      threatListId: id,
      monId: m.id,
    });
    useStore.getState().removeThreatMon(id, m.id);
    expect(useStore.getState().editor).toBeNull();
  });

  it('removeThreatMon leaves editor alone when pointing at a different mon', () => {
    const id = useStore.getState().createThreatList({ name: 'Mine', format: 'any' });
    const m1 = mon('Garchomp');
    const m2 = mon('Skarmory');
    useStore.getState().upsertThreatMon(id, m1);
    useStore.getState().upsertThreatMon(id, m2);
    useStore.getState().setEditor({
      kind: 'threat-mon',
      threatListId: id,
      monId: m1.id,
    });
    useStore.getState().removeThreatMon(id, m2.id);
    expect(useStore.getState().editor).toEqual({
      kind: 'threat-mon',
      threatListId: id,
      monId: m1.id,
    });
  });

  it('deleteThreatList clears editor pointing at a mon in the deleted list', () => {
    const id = useStore.getState().createThreatList({ name: 'Mine', format: 'any' });
    const m = mon('Garchomp');
    useStore.getState().upsertThreatMon(id, m);
    useStore.getState().setEditor({
      kind: 'threat-mon',
      threatListId: id,
      monId: m.id,
    });
    useStore.getState().deleteThreatList(id);
    expect(useStore.getState().editor).toBeNull();
  });

  it('deleteThreatList leaves editor alone when it points at a team-mon', () => {
    const teamId = useStore.getState().createTeam({ name: 'T', format: 'singles' });
    const teamMon = mon('Garchomp');
    useStore.getState().upsertMon(teamId, teamMon);
    const listId = useStore.getState().createThreatList({ name: 'Mine', format: 'any' });
    useStore.getState().setEditor({
      kind: 'team-mon',
      teamId,
      monId: teamMon.id,
    });
    useStore.getState().deleteThreatList(listId);
    expect(useStore.getState().editor).toEqual({
      kind: 'team-mon',
      teamId,
      monId: teamMon.id,
    });
  });
});
