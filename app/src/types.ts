// Stat IDs aligned with @smogon/calc (no translation at the boundary).
export type StatID = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
export type StatIDExceptHP = Exclude<StatID, 'hp'>;
export type StatusName =
  | 'Healthy'
  | 'Poisoned'
  | 'Badly Poisoned'
  | 'Burned'
  | 'Paralyzed'
  | 'Asleep'
  | 'Frozen';

export type MegaState = '' | 'mega' | 'mega-x' | 'mega-y';

export interface SavedMon {
  id: string;             // uuid v4
  species: string;        // canonical species name (e.g. "Garchomp")
  buildName?: string;     // SETDEX_CHAMPIONS key, undefined when "Custom"
  item?: string;
  ability?: string;
  nature: string;         // default 'Hardy'
  sps: Partial<Record<StatID, number>>;     // each 0..32, sum ≤ 66
  moves: [string, string, string, string];  // '' for empty
  mega: MegaState;        // '' = no mega; 'mega', 'mega-x', or 'mega-y'
  currentHp?: number;     // raw HP; undefined = full
  status?: StatusName;
  boosts: Partial<Record<StatIDExceptHP, number>>; // -6..+6
}

export type Format = 'singles' | 'doubles';

export interface Team {
  id: string;
  name: string;
  format: Format;
  mons: SavedMon[];   // 0..6
  createdAt: number;
  updatedAt: number;
}

/**
 * A flat list of Pokémon used to evaluate a team against. Reuses SavedMon so
 * movesets/items/abilities are editable just like teams. Allows more than 6
 * mons. Curated lists ship with the app and are flagged isSeed=true; those
 * cannot be deleted (the user can still edit them or duplicate them to a
 * non-seed copy if they want to remove entries freely).
 */
export type SeedKey = 'singles' | 'doubles' | 'megas' | 'most-used';

export interface ThreatList {
  id: string;
  name: string;
  format: Format | 'any';
  mons: SavedMon[];
  isSeed: boolean;
  /**
   * Stable identifier for seed lists, independent of `name` (the user can
   * rename seeds). Code that needs to look up a specific seed (e.g. the
   * Suggestions section's reference to "Most-Used") uses this rather than
   * the display name. Undefined for user-created lists.
   */
  seedKey?: SeedKey;
  createdAt: number;
  updatedAt: number;
}

export interface SideState {
  stealthRock?: boolean;
  spikes?: 0 | 1 | 2 | 3;
  reflect?: boolean;
  lightScreen?: boolean;
  auroraVeil?: boolean;
  tailwind?: boolean;
  protect?: boolean;
  leechSeed?: boolean;
  saltCure?: boolean;
  helpingHand?: boolean;
  isPowerTrick?: boolean;
  friendGuard?: boolean;
  isStatBoost?: boolean;
  isSwitching?: boolean;
}

export interface FieldState {
  weather?: 'Sun' | 'Rain' | 'Sand' | 'Snow';
  terrain?: 'Electric' | 'Grassy' | 'Misty' | 'Psychic';
  isMagicRoom?: boolean;
  isWonderRoom?: boolean;
  isTrickRoom?: boolean;
  isGravity?: boolean;
  yourSide: SideState;
  oppSide: SideState;
}

export interface RecentOpponent {
  id: string;
  mon: SavedMon;       // snapshot at time of last use
  lastUsed: number;
  useCount: number;
}

export type Notation = 'percent' | 'pixels';
export type Tab = 'battle' | 'teams' | 'builder' | 'settings';

/**
 * Which mon (if any) the MonEditor sheet is currently open on. Persisted so
 * that when iOS unloads the tab under memory pressure and reloads, the user
 * lands back on the same edit they were doing.
 *
 * Only the *target* is persisted - the editor's draft fields (the WIP form)
 * still live in MonEditor's local useState and are deliberately transient.
 * Losing in-progress unsaved edits across an unload is the expected tradeoff:
 * the alternative is constantly writing keystrokes into the store.
 */
export type EditorTarget =
  | { kind: 'team-mon'; teamId: string; monId: string }
  | { kind: 'opponent' }
  | { kind: 'threat-mon'; threatListId: string; monId: string }
  | null;

export interface AppState {
  teams: Team[];
  activeTeamId: string | null;
  activeMonIndex: number;       // 0..5 in active team
  opponent: SavedMon | null;
  recentOpponents: RecentOpponent[];  // capped 30, LRU
  threatLists: ThreatList[];    // seeded by v4 migration
  field: FieldState;
  notation: Notation;
  tab: Tab;
  editor: EditorTarget;         // persisted: survives iOS reload-on-unload
}

export const SP_PER_STAT_MAX = 32;
export const SP_TOTAL_MAX = 66;
export const RECENT_OPPONENT_CAP = 30;
