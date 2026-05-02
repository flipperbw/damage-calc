import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, Team, SavedMon, FieldState, Notation, Tab, Format } from '../types';
import { addRecent } from './validators';
import { migrate, CURRENT_VERSION } from './migrations';
import { emptyField } from './factories';

const uuid = () => crypto.randomUUID();

interface Actions {
  // Teams
  createTeam: (init: { name: string; format: Format }) => string;
  renameTeam: (id: string, name: string) => void;
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
  // Field
  setField: (patch: Partial<FieldState>) => void;
  // UI
  setTab: (t: Tab) => void;
  setNotation: (n: Notation) => void;
  // Reset
  resetAll: () => void;
}

const initialAppState: AppState = {
  teams: [],
  activeTeamId: null,
  activeMonIndex: 0,
  opponent: null,
  recentOpponents: [],
  field: emptyField(),
  notation: 'percent',
  tab: 'battle',
};

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
      deleteTeam: (id) => set(s => ({
        teams: s.teams.filter(t => t.id !== id),
        activeTeamId: s.activeTeamId === id ? null : s.activeTeamId,
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

      setField: (patch) => set(s => ({ field: { ...s.field, ...patch } })),

      setTab: (tab) => set({ tab }),
      setNotation: (notation) => set({ notation }),

      resetAll: () => set(initialAppState),
    }),
    {
      name: 'champions-calc-v1',
      version: CURRENT_VERSION,
      migrate: (persistedState: unknown, version: number) => {
        const wrapped = { version, state: persistedState };
        const migrated = migrate(wrapped);
        return (migrated?.state ?? initialAppState) as AppState;
      },
    },
  ),
);
