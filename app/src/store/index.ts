import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, Team, SavedMon, FieldState, Notation, Tab, Format, EditorTarget, ThreatList } from '../types';
import { addRecent } from './validators';
import { migrate, CURRENT_VERSION } from './migrations';
import { emptyField } from './factories';
import { buildSeedThreatLists } from '../data/seed-threats';
import { uuid } from '../util/uuid';

const PERSIST_NAME = 'champions-calc-v1';

// Keys persisted in the imported/exported data slice. Action functions and
// transient UI state are excluded.
//
// `editor` is persisted so the MonEditor reopens on the same target after
// iOS unloads the tab under memory pressure and reloads the page. The
// in-progress draft is not persisted — only the target.
export const PERSISTED_KEYS = [
  'teams',
  'activeTeamId',
  'activeMonIndex',
  'opponent',
  'recentOpponents',
  'threatLists',
  'field',
  'notation',
  'editor',
] as const;
export type PersistedKey = typeof PERSISTED_KEYS[number];

interface Actions {
  // Teams
  createTeam: (init: { name: string; format: Format }) => string;
  renameTeam: (id: string, name: string) => void;
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
   * buildSeedThreatLists(). Safe to call repeatedly — no-op when seeds are
   * already present.
   */
  ensureSeedThreatLists: () => void;
  // Field
  setField: (patch: Partial<FieldState>) => void;
  // UI
  setTab: (t: Tab) => void;
  setNotation: (n: Notation) => void;
  setEditor: (target: EditorTarget) => void;
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
    notation: 'percent',
    tab: 'battle',
    editor: null,
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
          id, name, format, mons: [],
          createdAt: Date.now(), updatedAt: Date.now(),
        };
        set(s => ({ teams: [...s.teams, t], activeTeamId: id, activeMonIndex: 0 }));
        return id;
      },
      renameTeam: (id, name) => set(s => ({
        teams: s.teams.map(t => t.id === id ? { ...t, name, updatedAt: Date.now() } : t),
      })),
      duplicateTeam: (id) => {
        const original = _get().teams.find(t => t.id === id);
        if (!original) return null;
        const newId = uuid();
        const now = Date.now();
        const copy: Team = {
          id: newId,
          name: `${original.name} (copy)`,
          format: original.format,
          mons: original.mons.map(m => ({ ...m, id: uuid() })),
          createdAt: now,
          updatedAt: now,
        };
        set(s => ({ teams: [...s.teams, copy] }));
        return newId;
      },
      deleteTeam: (id) => set(s => ({
        teams: s.teams.filter(t => t.id !== id),
        activeTeamId: s.activeTeamId === id ? null : s.activeTeamId,
        // Avoid leaving the editor pointed at a team we just deleted.
        editor:
          s.editor && s.editor.kind === 'team-mon' && s.editor.teamId === id
            ? null
            : s.editor,
      })),
      setActiveTeam: (id) => set({ activeTeamId: id, activeMonIndex: 0 }),
      setActiveMonIndex: (i) => set({ activeMonIndex: i }),
      upsertMon: (teamId, mon) => set(s => ({
        teams: s.teams.map(t => {
          if (t.id !== teamId) return t;
          const idx = t.mons.findIndex(m => m.id === mon.id);
          const mons = idx >= 0
            ? t.mons.map(m => m.id === mon.id ? mon : m)
            : [...t.mons, mon];
          return { ...t, mons, updatedAt: Date.now() };
        }),
      })),
      removeMon: (teamId, monId) => set(s => ({
        teams: s.teams.map(t => t.id === teamId
          ? { ...t, mons: t.mons.filter(m => m.id !== monId), updatedAt: Date.now() }
          : t,
        ),
        // Clear an editor that was pointing at the mon we just removed —
        // otherwise the editor reopens on a vapor target after reload.
        editor:
          s.editor && s.editor.kind === 'team-mon'
            && s.editor.teamId === teamId
            && s.editor.monId === monId
            ? null
            : s.editor,
      })),

      setOpponent: (mon) => set(s => {
        // Replace opponent entirely. Bump recents only when this represents a
        // new species selection (not a no-op or HP/Mega tweak).
        const prev = s.opponent;
        const isSpeciesChange =
          mon !== null && (prev === null || mon.species !== prev.species);
        return {
          opponent: mon,
          recentOpponents: isSpeciesChange
            ? addRecent(s.recentOpponents, mon, Date.now())
            : s.recentOpponents,
        };
      }),
      updateOpponent: (patch) => set(s => (
        s.opponent ? { opponent: { ...s.opponent, ...patch } } : {}
      )),
      clearRecent: (id) => set(s => ({
        recentOpponents: s.recentOpponents.filter(r => r.id !== id),
      })),
      clearAllRecents: () => set({ recentOpponents: [] }),

      createThreatList: ({ name, format }) => {
        const id = uuid();
        const now = Date.now();
        const list: ThreatList = {
          id, name, format, mons: [], isSeed: false,
          createdAt: now, updatedAt: now,
        };
        set(s => ({ threatLists: [...s.threatLists, list] }));
        return id;
      },
      renameThreatList: (id, name) => set(s => ({
        threatLists: s.threatLists.map(l =>
          l.id === id ? { ...l, name, updatedAt: Date.now() } : l,
        ),
      })),
      duplicateThreatList: (id) => {
        const original = _get().threatLists.find(l => l.id === id);
        if (!original) return null;
        const newId = uuid();
        const now = Date.now();
        // Copies always come back as non-seed lists; that's the whole point of
        // duplicating a curated list — to get a freely editable/deletable copy.
        const copy: ThreatList = {
          id: newId,
          name: `${original.name} (copy)`,
          format: original.format,
          mons: original.mons.map(m => ({ ...m, id: uuid() })),
          isSeed: false,
          createdAt: now,
          updatedAt: now,
        };
        set(s => ({ threatLists: [...s.threatLists, copy] }));
        return newId;
      },
      deleteThreatList: (id) => {
        const list = _get().threatLists.find(l => l.id === id);
        if (!list) return;
        if (list.isSeed) {
          // eslint-disable-next-line no-console
          console.warn(`Refusing to delete seed threat list "${list.name}" (id ${id}).`);
          return;
        }
        set(s => ({
          threatLists: s.threatLists.filter(l => l.id !== id),
          // Clear an editor pointing at a mon in the threat list we just
          // deleted — same hygiene rule as deleteTeam.
          editor:
            s.editor && s.editor.kind === 'threat-mon' && s.editor.threatListId === id
              ? null
              : s.editor,
        }));
      },
      upsertThreatMon: (threatListId, mon) => set(s => ({
        threatLists: s.threatLists.map(l => {
          if (l.id !== threatListId) return l;
          const idx = l.mons.findIndex(m => m.id === mon.id);
          const mons = idx >= 0
            ? l.mons.map(m => m.id === mon.id ? mon : m)
            : [...l.mons, mon];
          return { ...l, mons, updatedAt: Date.now() };
        }),
      })),
      removeThreatMon: (threatListId, monId) => set(s => ({
        threatLists: s.threatLists.map(l => l.id === threatListId
          ? { ...l, mons: l.mons.filter(m => m.id !== monId), updatedAt: Date.now() }
          : l,
        ),
        // Clear an editor that was pointing at the threat-mon we just
        // removed — mirrors the team-mon hygiene above.
        editor:
          s.editor && s.editor.kind === 'threat-mon'
            && s.editor.threatListId === threatListId
            && s.editor.monId === monId
            ? null
            : s.editor,
      })),
      ensureSeedThreatLists: () => set(s => {
        if (s.threatLists.length > 0) return {};
        return { threatLists: buildSeedThreatLists() };
      }),

      setField: (patch) => set(s => ({ field: { ...s.field, ...patch } })),

      setTab: (tab) => set({ tab }),
      setNotation: (notation) => set({ notation }),
      setEditor: (editor) => set({ editor }),

      // Reset to a *freshly built* initial state — repopulates seed threat
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
            console.error(
              `Persist migration failed; quarantined previous state to "${quarantineKey}". Starting fresh.`,
              err,
            );
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
