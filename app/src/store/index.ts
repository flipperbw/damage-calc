import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { buildSeedThreatLists, CURRENT_SEED_KEYS } from '@/data/seed-threats';
import { emptyField } from '@/store/factories';
import { CURRENT_VERSION, migrate } from '@/store/migrations';
import { deleteById, duplicateById, removeChild, renameById, upsertChild } from '@/store/utils';
import { addRecent } from '@/store/validators';
import type { AppState, EditorTarget, FieldState, Format, Notation, SavedMon, Tab, Team, ThreatList } from '@/types';
import { uuid } from '@/util/uuid';

const PERSIST_NAME = 'champions-calc-v1';

// Keys persisted in the imported/exported data slice. Action functions and
// transient UI state are excluded.
//
// `editor` is persisted so the MonEditor reopens on the same target after
// iOS unloads the tab under memory pressure and reloads the page. The
// in-progress draft is not persisted - only the target.
export const PERSISTED_KEYS = [
  'teams',
  'activeTeamId',
  'activeMonIndex',
  'opponent',
  'recentOpponents',
  'threatLists',
  'field',
  'pinnedFieldKeys',
  'notation',
  'editor',
  'lastSeenChangelogHeading',
] as const;
export type PersistedKey = (typeof PERSISTED_KEYS)[number];

interface Actions {
  // Teams
  createTeam: (init: { name: string; format: Format }) => string;
  renameTeam: (id: string, name: string) => void;
  setTeamFormat: (id: string, format: Format) => void;
  duplicateTeam: (id: string) => string | null;
  deleteTeam: (id: string) => void;
  setActiveTeam: (id: string) => void;
  setActiveMonIndex: (i: number) => void;
  upsertMon: (teamId: string, mon: SavedMon) => void;
  removeMon: (teamId: string, monId: string) => void;
  // Opponent
  setOpponent: (mon: SavedMon | null) => void;
  updateOpponent: (patch: Partial<SavedMon>) => void;
  clearRecent: (id: string) => void;
  clearAllRecents: () => void;
  // Threat lists
  createThreatList: (init: { name: string; format: Format | 'any' }) => string;
  renameThreatList: (id: string, name: string) => void;
  duplicateThreatList: (id: string) => string | null;
  deleteThreatList: (id: string) => void;
  upsertThreatMon: (threatListId: string, mon: SavedMon) => void;
  removeThreatMon: (threatListId: string, monId: string) => void;
  /**
   * Idempotent backfill: if `threatLists` is empty (e.g. user reset, or an
   * older build that briefly shipped with empty seeds), repopulate from
   * buildSeedThreatLists(). Safe to call repeatedly - no-op when seeds are
   * already present.
   */
  ensureSeedThreatLists: () => void;
  // Field
  setField: (patch: Partial<FieldState>) => void;
  togglePinnedFieldKey: (key: string) => void;
  // UI
  setTab: (t: Tab) => void;
  setNotation: (n: Notation) => void;
  setEditor: (target: EditorTarget) => void;
  markChangelogSeen: (heading: string) => void;
  // Reset
  resetAll: () => void;
}

/**
 * Initial state used on a brand-new install AND as the reset target. The
 * threat-list seeds are injected here (rather than only via the v3→v4
 * migration) so a first-time user gets the curated lists immediately, and
 * "Reset everything" in Settings repopulates them rather than leaving the
 * Builder empty.
 */
function buildInitialAppState(): AppState {
  return {
    teams: [],
    activeTeamId: null,
    activeMonIndex: 0,
    opponent: null,
    recentOpponents: [],
    threatLists: buildSeedThreatLists(),
    field: emptyField(),
    pinnedFieldKeys: [],
    notation: 'percent',
    tab: 'battle',
    editor: null,
    lastSeenChangelogHeading: null,
  };
}
const initialAppState: AppState = buildInitialAppState();

export const useStore = create<AppState & Actions>()(
  persist(
    (set, _get) => ({
      ...initialAppState,

      createTeam: ({ name, format }) => {
        const id = uuid();
        const t: Team = {
          id,
          name,
          format,
          mons: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((s) => ({ teams: [...s.teams, t], activeTeamId: id, activeMonIndex: 0 }));
        return id;
      },
      renameTeam: (id, name) => set((s) => ({ teams: renameById(s.teams, id, name) })),
      setTeamFormat: (id, format) =>
        set((s) => ({
          teams: s.teams.map((t) => (t.id === id ? { ...t, format, updatedAt: Date.now() } : t)),
        })),
      duplicateTeam: (id) => {
        const now = Date.now();
        const newId = uuid();
        const result = duplicateById<Team>(_get().teams, id, (orig) => ({
          id: newId,
          name: `${orig.name} (copy)`,
          format: orig.format,
          mons: orig.mons.map((m) => ({ ...m, id: uuid() })),
          createdAt: now,
          updatedAt: now,
        }));
        if (!result) return null;
        set({ teams: result.arr });
        return newId;
      },
      deleteTeam: (id) =>
        set((s) => ({
          teams: deleteById(s.teams, id),
          activeTeamId: s.activeTeamId === id ? null : s.activeTeamId,
          // Avoid leaving the editor pointed at a team we just deleted.
          editor: s.editor && s.editor.kind === 'team-mon' && s.editor.teamId === id ? null : s.editor,
        })),
      setActiveTeam: (id) => set({ activeTeamId: id, activeMonIndex: 0 }),
      setActiveMonIndex: (i) => set({ activeMonIndex: i }),
      upsertMon: (teamId, mon) => set((s) => ({ teams: upsertChild(s.teams, teamId, mon) })),
      removeMon: (teamId, monId) =>
        set((s) => {
          const teams = removeChild(s.teams, teamId, monId);
          // If we shrunk the active team, clamp activeMonIndex so callers
          // don't land on `team.mons[undefined]` and render the empty-team UI.
          let activeMonIndex = s.activeMonIndex;
          if (s.activeTeamId === teamId) {
            const updated = teams.find((t) => t.id === teamId);
            const lastIdx = Math.max(0, (updated?.mons.length ?? 0) - 1);
            if (activeMonIndex > lastIdx) activeMonIndex = lastIdx;
          }
          return {
            teams,
            activeMonIndex,
            // Clear an editor that was pointing at the mon we just removed -
            // otherwise the editor reopens on a vapor target after reload.
            editor: s.editor && s.editor.kind === 'team-mon' && s.editor.teamId === teamId && s.editor.monId === monId ? null : s.editor,
          };
        }),

      setOpponent: (mon) =>
        set((s) => {
          // Replace opponent entirely. Bump recents only when this represents a
          // new species selection (not a no-op or HP/Mega tweak).
          const prev = s.opponent;
          const isSpeciesChange = mon !== null && (prev === null || mon.species !== prev.species);
          return {
            opponent: mon,
            recentOpponents: isSpeciesChange ? addRecent(s.recentOpponents, mon, Date.now()) : s.recentOpponents,
          };
        }),
      updateOpponent: (patch) => set((s) => (s.opponent ? { opponent: { ...s.opponent, ...patch } } : {})),
      clearRecent: (id) =>
        set((s) => ({
          recentOpponents: s.recentOpponents.filter((r) => r.id !== id),
        })),
      clearAllRecents: () => set({ recentOpponents: [] }),

      createThreatList: ({ name, format }) => {
        const id = uuid();
        const now = Date.now();
        const list: ThreatList = {
          id,
          name,
          format,
          mons: [],
          isSeed: false,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ threatLists: [...s.threatLists, list] }));
        return id;
      },
      renameThreatList: (id, name) => set((s) => ({ threatLists: renameById(s.threatLists, id, name) })),
      duplicateThreatList: (id) => {
        const now = Date.now();
        const newId = uuid();
        // Copies always come back as non-seed lists; that's the whole point of
        // duplicating a curated list - to get a freely editable/deletable copy.
        const result = duplicateById<ThreatList>(_get().threatLists, id, (orig) => ({
          id: newId,
          name: `${orig.name} (copy)`,
          format: orig.format,
          mons: orig.mons.map((m) => ({ ...m, id: uuid() })),
          isSeed: false,
          createdAt: now,
          updatedAt: now,
        }));
        if (!result) return null;
        set({ threatLists: result.arr });
        return newId;
      },
      deleteThreatList: (id) => {
        const list = _get().threatLists.find((l) => l.id === id);
        if (!list) return;
        if (list.isSeed) {
          // eslint-disable-next-line no-console
          console.warn(`Refusing to delete seed threat list "${list.name}" (id ${id}).`);
          return;
        }
        set((s) => ({
          threatLists: deleteById(s.threatLists, id),
          // Clear an editor pointing at a mon in the threat list we just
          // deleted - same hygiene rule as deleteTeam.
          editor: s.editor && s.editor.kind === 'threat-mon' && s.editor.threatListId === id ? null : s.editor,
        }));
      },
      upsertThreatMon: (threatListId, mon) => set((s) => ({ threatLists: upsertChild(s.threatLists, threatListId, mon) })),
      removeThreatMon: (threatListId, monId) =>
        set((s) => ({
          threatLists: removeChild(s.threatLists, threatListId, monId),
          // Clear an editor that was pointing at the threat-mon we just
          // removed - mirrors the team-mon hygiene above.
          editor: s.editor && s.editor.kind === 'threat-mon' && s.editor.threatListId === threatListId && s.editor.monId === monId ? null : s.editor,
        })),
      ensureSeedThreatLists: () =>
        set((s) => {
          // Three jobs in one pass, every Builder mount:
          //   1. Drop seeds whose seedKey is no longer shipped (e.g. "megas"
          //      or "most-used" after their curated specs were removed).
          //   2. For each remaining seed, compare against the current spec —
          //      if mons.length differs or the first mon species changed,
          //      refresh the seed's mons/format in place. Catches stale
          //      persisted state when the spec evolves between releases (or
          //      a migration didn't fire / was skipped). The seed's id /
          //      name / createdAt are preserved so any in-flight references
          //      remain valid.
          //   3. Reorder so seeds appear in spec order ahead of user lists.
          //      If the user has no seeds at all after pruning, repopulate.
          const validKeys = new Set<string>(CURRENT_SEED_KEYS);
          const fresh = buildSeedThreatLists();

          const persistedSeedByKey = new Map<string, ThreatList>();
          const userLists: ThreatList[] = [];
          for (const l of s.threatLists) {
            if (l.isSeed && l.seedKey !== undefined && validKeys.has(l.seedKey)) {
              persistedSeedByKey.set(l.seedKey, l);
            } else if (!l.isSeed) {
              userLists.push(l);
            }
            // Else: orphaned seed → dropped.
          }

          if (persistedSeedByKey.size === 0) {
            // No valid seeds left — repopulate from the spec while keeping
            // any user-created lists at the end.
            return { threatLists: [...fresh, ...userLists] };
          }

          let changed = false;
          const refreshedSeeds = fresh
            .filter((f) => persistedSeedByKey.has(f.seedKey as string))
            .map((f) => {
              const existing = persistedSeedByKey.get(f.seedKey as string)!;
              const stale = existing.mons.length !== f.mons.length || existing.mons[0]?.species !== f.mons[0]?.species;
              if (!stale) return existing;
              changed = true;
              return {
                ...f,
                id: existing.id,
                name: existing.name,
                createdAt: existing.createdAt,
                updatedAt: Date.now(),
              };
            });

          // Detect reorder / drop too: if the existing array of seeded lists
          // isn't already in spec order, we need to rewrite the array.
          const existingSeedOrder = s.threatLists.filter((l) => l.isSeed && l.seedKey !== undefined && validKeys.has(l.seedKey)).map((l) => l.seedKey);
          const targetSeedOrder = refreshedSeeds.map((l) => l.seedKey);
          const orderChanged = existingSeedOrder.length !== targetSeedOrder.length || existingSeedOrder.some((k, i) => k !== targetSeedOrder[i]);
          const droppedOrphans = s.threatLists.length !== refreshedSeeds.length + userLists.length;

          if (!changed && !orderChanged && !droppedOrphans) return {};
          return { threatLists: [...refreshedSeeds, ...userLists] };
        }),

      setField: (patch) => set((s) => ({ field: { ...s.field, ...patch } })),
      togglePinnedFieldKey: (key) =>
        set((s) => {
          const has = s.pinnedFieldKeys.includes(key);
          return { pinnedFieldKeys: has ? s.pinnedFieldKeys.filter((k) => k !== key) : [...s.pinnedFieldKeys, key] };
        }),

      setTab: (tab) => set({ tab }),
      setNotation: (notation) => set({ notation }),
      setEditor: (editor) => set({ editor }),
      markChangelogSeen: (heading) => set({ lastSeenChangelogHeading: heading }),

      // Reset to a *freshly built* initial state - repopulates seed threat
      // lists with new uuids rather than reusing the module-load instance.
      resetAll: () => set(buildInitialAppState()),
    }),
    {
      name: PERSIST_NAME,
      version: CURRENT_VERSION,
      migrate: (persistedState: unknown, version: number) => {
        try {
          const wrapped = { version, state: persistedState };
          const migrated = migrate(wrapped);
          if (migrated) return migrated.state as AppState;
          throw new Error('migrate() returned null for malformed persisted state');
        } catch (err) {
          // Preserve the bad data under a quarantine key so the user can
          // recover via DevTools instead of silently losing everything.
          try {
            const quarantineKey = `${PERSIST_NAME}.quarantine.${Date.now()}`;
            const raw = JSON.stringify({ version, state: persistedState });
            localStorage.setItem(quarantineKey, raw);
            // eslint-disable-next-line no-console
            console.error(`Persist migration failed; quarantined previous state to "${quarantineKey}". Starting fresh.`, err);
          } catch (storageErr) {
            // eslint-disable-next-line no-console
            console.error('Failed to quarantine persisted state', storageErr);
          }
          return initialAppState as AppState;
        }
      },
    },
  ),
);
