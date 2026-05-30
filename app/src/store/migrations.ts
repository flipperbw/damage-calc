import { buildSeedThreatLists, CURRENT_SEED_KEYS } from '@/data/seed-threats';
import type { AppState } from '@/types';

export const CURRENT_VERSION = 9;

export interface PersistedShape {
  version: number;
  state: AppState;
}

type Migrator = (s: any) => any;

// Shared helper: rebuild persisted threatLists so seeded entries match the
// current spec (mons, format, order), preserving the persisted id/name/
// createdAt where keys match. Drops seeds whose key is no longer shipped;
// leaves user-created lists untouched and appended after the seeds.
function refreshSeededThreatLists(s: any): any {
  if (!s || typeof s !== 'object') return s;
  if (!Array.isArray(s.threatLists)) return s;
  const validKeys = new Set<string>(CURRENT_SEED_KEYS);
  const persistedSeedByKey = new Map<string, any>();
  const userLists: any[] = [];
  for (const l of s.threatLists) {
    if (!l || typeof l !== 'object') continue;
    if (l.isSeed && typeof l.seedKey === 'string' && validKeys.has(l.seedKey)) {
      persistedSeedByKey.set(l.seedKey, l);
    } else if (!l.isSeed) {
      userLists.push(l);
    }
    // Else: orphaned seed (key no longer shipped) — silently dropped.
  }
  // Only refresh seeds the user actually had. We don't inject new seeds
  // here — the store's ensureSeedThreatLists handles "user has no seeds
  // at all" by re-seeding on Builder mount. This preserves the v4
  // migrator's "user opted out of seeds → leave them alone" invariant.
  const now = Date.now();
  const refreshedSeeds = buildSeedThreatLists()
    .filter((fresh) => persistedSeedByKey.has(fresh.seedKey as string))
    .map((fresh) => {
      const existing = persistedSeedByKey.get(fresh.seedKey as string)!;
      return {
        ...fresh,
        id: existing.id,
        name: existing.name,
        createdAt: existing.createdAt,
        updatedAt: now,
      };
    });
  return { ...s, threatLists: [...refreshedSeeds, ...userLists] };
}

function migrateMon(mon: any): any {
  if (!mon || typeof mon !== 'object') return mon;
  const { isMega, ...rest } = mon;
  if ('mega' in rest) return rest;
  return { ...rest, mega: isMega ? 'mega' : '' };
}

function migrateMonArray(arr: any): any {
  if (!Array.isArray(arr)) return arr;
  return arr.map(migrateMon);
}

// Add migrators when bumping CURRENT_VERSION.
const MIGRATORS: Record<number, Migrator> = {
  // v1 -> v2: replace SavedMon.isMega:boolean with mega:'' | 'mega' | 'mega-x' | 'mega-y'.
  2: (s: any) => {
    if (!s || typeof s !== 'object') return s;
    const teams = Array.isArray(s.teams)
      ? s.teams.map((t: any) => (t && typeof t === 'object' ? { ...t, mons: migrateMonArray(t.mons) } : t))
      : s.teams;
    const opponent = s.opponent ? migrateMon(s.opponent) : s.opponent;
    const recentOpponents = Array.isArray(s.recentOpponents)
      ? s.recentOpponents.map((r: any) => (r && typeof r === 'object' && r.mon ? { ...r, mon: migrateMon(r.mon) } : r))
      : s.recentOpponents;
    return { ...s, teams, opponent, recentOpponents };
  },
  // v2 -> v3: introduce persisted MonEditor target so the open editor
  // survives iOS unloading the tab under memory pressure. Old persisted
  // states won't have an `editor` key - initialise to null.
  3: (s: any) => {
    if (!s || typeof s !== 'object') return s;
    return { ...s, editor: null };
  },
  // v3 -> v4: introduce threatLists slice for the Builder feature. Inject
  // the curated seed lists when the user has none yet (or when the slice is
  // missing entirely, as on any pre-v4 state). Idempotent: a v3 state that
  // already carries a non-empty threatLists array (e.g. from a partial
  // migration somewhere upstream) is left alone - we never double-seed.
  4: (s: any) => {
    if (!s || typeof s !== 'object') return s;
    const existing = Array.isArray(s.threatLists) ? s.threatLists : [];
    const threatLists = existing.length > 0 ? existing : buildSeedThreatLists();
    return { ...s, threatLists };
  },
  // v4 -> v5: introduce pinnedFieldKeys slice for the FieldBar quick-toggle
  // chips. Empty default - users opt in via FieldDrawer's edit-pins mode.
  5: (s: any) => {
    if (!s || typeof s !== 'object') return s;
    if (Array.isArray(s.pinnedFieldKeys)) return s;
    return { ...s, pinnedFieldKeys: [] };
  },
  // v5 -> v6: introduce lastSeenChangelogHeading so the Settings "What's
  // new" action can dot-indicate unseen entries. Default null = "never
  // opened" — every existing user will see the dot once, clear it by
  // opening the changelog, and never see it again until the next entry.
  6: (s: any) => {
    if (!s || typeof s !== 'object') return s;
    if ('lastSeenChangelogHeading' in s) return s;
    return { ...s, lastSeenChangelogHeading: null };
  },
  // v7 -> v8: rebuild the seeded portion of threatLists from the current
  // spec. Several things changed at once:
  //   - Doubles seed grew from 8 to ~40 entries (live Pikalytics meta).
  //   - Doubles is now first in spec order (was second).
  //   - The "Most-Used" seed was deleted (its content was just doubles.slice(0,3)).
  // We refresh in place by matching on seedKey, preserving each persisted
  // seed's id / name / createdAt so any in-flight references stay valid.
  // Seeds whose key is no longer shipped (e.g. 'most-used') get dropped.
  // User-created (non-seed) lists are kept verbatim, appended after the
  // refreshed seeds so the list order ends up: seeds-in-spec-order, then
  // user lists in their original relative order.
  8: (s: any) => refreshSeededThreatLists(s),
  // v8 -> v9: re-run the same seed-list refresh as v8. The first round of
  // v8 (shipped earlier) used different semantics — preserved Most-Used,
  // didn't reorder. Users who already migrated through that earlier v8 are
  // stuck at version 8 with the old shape; this version bump forces the
  // current refresh logic to apply to them too. No-op for anyone whose v8
  // state already matches the current spec.
  9: (s: any) => refreshSeededThreatLists(s),
  // v6 -> v7: introduce inBattleForme overrides on SavedMon for Palafin
  // (Zero / Hero) and Aegislash (Auto / Shield / Blade). Older states
  // didn't carry the field; default to '' (= species-specific automatic
  // behaviour) on every drafted mon, opponent, recent opponent, and
  // threat-list entry.
  7: (s: any) => {
    if (!s || typeof s !== 'object') return s;
    const stamp = (m: any) => (m && typeof m === 'object' && !('inBattleForme' in m) ? { ...m, inBattleForme: '' } : m);
    const stampArray = (arr: any) => (Array.isArray(arr) ? arr.map(stamp) : arr);
    const teams = Array.isArray(s.teams)
      ? s.teams.map((t: any) => (t && typeof t === 'object' ? { ...t, mons: stampArray(t.mons) } : t))
      : s.teams;
    const opponent = s.opponent ? stamp(s.opponent) : s.opponent;
    const recentOpponents = Array.isArray(s.recentOpponents)
      ? s.recentOpponents.map((r: any) => (r && typeof r === 'object' && r.mon ? { ...r, mon: stamp(r.mon) } : r))
      : s.recentOpponents;
    const threatLists = Array.isArray(s.threatLists)
      ? s.threatLists.map((l: any) => (l && typeof l === 'object' ? { ...l, mons: stampArray(l.mons) } : l))
      : s.threatLists;
    return { ...s, teams, opponent, recentOpponents, threatLists };
  },
};

export function migrate(input: any): PersistedShape | null {
  if (!input || typeof input !== 'object') return null;
  if (typeof input.version !== 'number' || !input.state) return null;
  if (input.version > CURRENT_VERSION) {
    throw new Error(`Persisted state is from a future version (${input.version})`);
  }
  let state = input.state;
  for (let v = input.version; v < CURRENT_VERSION; v++) {
    const fn = MIGRATORS[v + 1];
    if (fn) state = fn(state);
  }
  return { version: CURRENT_VERSION, state };
}
