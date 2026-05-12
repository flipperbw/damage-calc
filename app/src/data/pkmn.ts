/**
 * Thin wrapper around @pkmn/data + @pkmn/dex providing learnsets and prose
 * descriptions for moves and abilities, scoped to the generation that best
 * matches our Champions data.
 *
 * Why gen 7 (Sun/Moon)?
 * ---------------------
 * Champions is calc's synthetic gen 0; @pkmn/data has no equivalent. We grep
 * the legacy SETDEX_CHAMPIONS for set-name prefixes and overwhelmingly find
 * "SM …" entries (Mega Stones, Z-moves, USUM-era picks) - the rest are
 * tagged "SV …" but always for Pokémon that pre-date gen 9 and would lose
 * their Mega abilities under gen 9 mechanics. Gen 7 maximises learnset
 * coverage for the curated builds while still recognising every move and
 * ability used by SM/USUM mons; SV-flavoured moves added later (Trailblaze
 * etc.) are absent here, so MovePicker's "Show all moves" escape hatch
 * remains the safety valve when a curated build references a newer move.
 *
 * Lazy-loaded: the @pkmn/data + @pkmn/dex bundle pulls in ~600 KB of move,
 * ability and learnset JSON. We dynamic-import once on first use so the
 * initial app chunk stays small.
 */

/**
 * React-friendly hook: returns true once preloadPkmn has resolved (and so the
 * priority / boost / lowers-target caches are usable). Components that derive
 * data from those caches should `useMemo([..., ready])` so they recompute
 * once the cache lands.
 */
import { useEffect, useState } from 'react';
import { toID } from '@smogon/calc';

const TARGET_GEN = 7;

interface PkmnMove {
  desc?: string;
  shortDesc?: string;
  priority?: number;
  /**
   * Self-targeted stat changes; populated for moves like Swords Dance, Agility,
   * Calm Mind. The shape is `{ atk?: number, def?: number, ... }`.
   */
  self?: { boosts?: Record<string, number> };
  /**
   * Stat changes applied to the target. Populated for moves like Charm,
   * Leer, Memento (negative values lower the target).
   */
  boosts?: Record<string, number>;
  /** Move category - present on every entry. */
  category?: string;
  /** 'self' for Swords Dance et al.; 'normal' for most attacks. */
  target?: string;
  secondary?: { boosts?: Record<string, number>; chance?: number; self?: { boosts?: Record<string, number> } };
  secondaries?: Array<{ boosts?: Record<string, number>; chance?: number; self?: { boosts?: Record<string, number> } }>;
}

interface PkmnApi {
  moves: {
    get(name: string): PkmnMove | undefined;
    [Symbol.iterator](): Iterator<PkmnMove & { name?: string; id?: string }>;
  };
  abilities: { get(name: string): { desc?: string; shortDesc?: string } | undefined };
  items: { get(name: string): { desc?: string; shortDesc?: string } | undefined };
  learnsets: { canLearn(species: string, move: string): Promise<boolean> };
  species: {
    [Symbol.iterator](): Iterator<{ id?: string; name?: string; abilities?: Record<string, string> }>;
  };
}

let pkmnGenPromise: Promise<PkmnApi> | null = null;
// Gen-9 instance retained alongside the gen-7 primary so prose lookups for
// post-gen-7 abilities/moves (Armor Tail, Trailblaze, ...) can fall back to
// the latest dex when the target gen doesn't recognise them.
let latestGenCache: PkmnApi | null = null;

/**
 * Sync cache of move-id -> priority, populated by {@link preloadPkmn}. Empty
 * until the first preload completes; callers must treat a missing entry as
 * "unknown" rather than "priority 0".
 */
const PRIORITY_CACHE: Map<string, number> = new Map();
let prioritiesLoaded = false;

/**
 * Sync accuracy lookup, sourced from @pkmn/data. Calc's gen-0 move data
 * doesn't carry accuracy at all (it's a BP/category-only table), so this
 * is the only path to "Hydro Pump is 80%" in the UI. Numbers are 1-100;
 * `true` means the move always hits (Aerial Ace, Swift, etc.).
 */
const ACCURACY_CACHE: Map<string, number | true> = new Map();

/**
 * Sync caches for move stat-change behavior. `BOOSTS_USER` is true for moves
 * that raise a user stat (Swords Dance, Agility, Calm Mind, Bulk Up, etc.).
 * `LOWERS_TARGET` is true for moves that lower a target stat - including
 * pure debuff moves (Charm, Memento, Tail Whip) AND moves with a negative-
 * boost secondary (Crunch's 20% to drop Def, etc.).
 */
const BOOSTS_USER: Set<string> = new Set();
const LOWERS_TARGET: Set<string> = new Set();

/**
 * Sync cache of species id -> full ability list (slot 0 / 1 / hidden, in
 * pokedex order). Populated at preload from @pkmn/data, which carries the
 * full pokedex; calc's gen-0 species table only ships a single default
 * ability per species, so the AbilityPicker prefers this when warm.
 */
const SPECIES_ABILITIES: Map<string, string[]> = new Map();

function loadPkmnGen(): Promise<PkmnApi> {
  if (!pkmnGenPromise) {
    pkmnGenPromise = (async () => {
      const [{ Generations }, dexMod] = await Promise.all([import('@pkmn/data'), import('@pkmn/dex')]);
      const gens = new Generations(dexMod.Dex);
      const gen = gens.get(TARGET_GEN) as unknown as PkmnApi;
      // Species → ability lookup must use the *latest* dex (gen 9) so newer
      // mons like Farigiraf (Armor Tail), Iron Treads, etc. are recognised.
      // Gen 7 in this wrapper is chosen for learnset / move coverage of the
      // SM/USUM-era curated builds, not for species presence.
      const speciesGen = gens.get(9) as unknown as PkmnApi;
      latestGenCache = speciesGen;
      // Warm the priority lookup so the calc adapter can correct calc's gen-0
      // move data, which omits priority for several Champions-legal moves
      // (Trick Room, Roar, Whirlwind, …). Iteration is sync once the gen
      // bundle is loaded; this is cheap.
      try {
        for (const m of gen.moves) {
          if (!m.id) continue;
          if (typeof m.priority === 'number' && m.priority !== 0) {
            PRIORITY_CACHE.set(m.id, m.priority);
          }
          const acc = (m as { accuracy?: number | true }).accuracy;
          if (acc === true || typeof acc === 'number') {
            ACCURACY_CACHE.set(m.id, acc);
          }
          if (movePositiveBoostsUser(m)) BOOSTS_USER.add(m.id);
          if (moveNegativelyAffectsTarget(m)) LOWERS_TARGET.add(m.id);
        }
      } catch {
        // If iteration is unavailable, leave the caches empty - callers
        // already treat missing entries as "no override".
      }
      try {
        for (const sp of speciesGen.species) {
          if (!sp.id || !sp.abilities) continue;
          const list = Object.values(sp.abilities).filter(Boolean) as string[];
          if (list.length) SPECIES_ABILITIES.set(sp.id, list);
        }
      } catch {
        // Same defensive pattern as moves: leave the cache empty if
        // iteration is unsupported on the runtime.
      }
      prioritiesLoaded = true;
      return gen;
    })();
  }
  return pkmnGenPromise;
}

/** Imperatively warm the cache; safe to call at app startup or first picker open. */
export function preloadPkmn(): Promise<void> {
  return loadPkmnGen().then(() => undefined);
}

export function usePkmnReady(): boolean {
  const [ready, setReady] = useState<boolean>(prioritiesLoaded);
  useEffect(() => {
    if (prioritiesLoaded) {
      setReady(true);
      return;
    }
    let cancelled = false;
    void preloadPkmn().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return ready;
}

/**
 * Sync priority lookup for a move name, sourced from @pkmn/data's gen-7 data.
 * Returns null when the cache is cold OR when the move has no non-zero
 * priority (the calc data already reports those moves correctly). Used by
 * the calc adapter to patch calc's gen-0 move data, which omits priority for
 * several Champions-legal moves (Trick Room, Roar, Whirlwind, …).
 *
 * Callers MUST `await preloadPkmn()` before relying on this returning a hit;
 * before that, every call returns null.
 */
export function priorityOverride(moveName: string): number | null {
  if (!prioritiesLoaded) return null;
  const id = toID(moveName) as unknown as string;
  const v = PRIORITY_CACHE.get(id);
  return typeof v === 'number' ? v : null;
}

/** Test-only: expose readiness for assertions about the cache state. */
export function _prioritiesReady(): boolean {
  return prioritiesLoaded;
}

/**
 * True iff the given move (looked up in the cache populated by preloadPkmn)
 * raises any user stat. Returns false for unknown moves and before preload.
 */
export function moveBoostsUser(moveName: string): boolean {
  if (!prioritiesLoaded) return false;
  return BOOSTS_USER.has(toID(moveName) as unknown as string);
}

/**
 * True iff the given move lowers any target stat (either as a primary
 * effect like Charm, or via a secondary chance like Crunch's Def drop).
 */
export function moveLowersTarget(moveName: string): boolean {
  if (!prioritiesLoaded) return false;
  return LOWERS_TARGET.has(toID(moveName) as unknown as string);
}

/**
 * Sync accuracy lookup for a move. Calc's gen-0 doesn't ship accuracy,
 * so callers must use this instead of reading `move.accuracy` directly.
 * Returns `null` when the cache is cold or the move is unknown.
 */
export function moveAccuracy(moveName: string): number | true | null {
  if (!prioritiesLoaded) return null;
  return ACCURACY_CACHE.get(toID(moveName) as unknown as string) ?? null;
}

/**
 * Full ability list (slot 0 / 1 / hidden, in pokedex order) for a species,
 * sourced from @pkmn/data. Returns null when the cache is cold OR when the
 * species isn't found - the AbilityPicker falls back to calc's gen-0 entry
 * in that case (which only ships a single default ability per species).
 */
export function getSpeciesAbilities(species: string): string[] | null {
  if (!prioritiesLoaded) return null;
  return SPECIES_ABILITIES.get(toID(species) as unknown as string) ?? null;
}

function movePositiveBoostsUser(m: PkmnMove): boolean {
  // Self-targeted move with direct `boosts` (Swords Dance, Agility):
  //   { boosts: { spe: 2 }, target: 'self' }
  if (m.target === 'self' && hasPositive(m.boosts)) return true;
  // Otherwise nested under `self.boosts` (Power-Up Punch, Outrage's
  // intermediates, etc.) - applies to user regardless of target.
  if (hasPositive(m.self?.boosts)) return true;
  // Secondary self-buff like Power-Up Punch's 100% Atk +1 - sometimes
  // expressed as a single `secondary` with `self.boosts`.
  if (hasPositive(m.secondary?.self?.boosts)) return true;
  if (m.secondaries) {
    for (const s of m.secondaries) {
      if (hasPositive(s.self?.boosts)) return true;
    }
  }
  return false;
}

function moveNegativelyAffectsTarget(m: PkmnMove): boolean {
  // Direct boost on a non-self target: Charm, Tail Whip, Leer, etc.
  if (m.target !== 'self' && hasNegative(m.boosts)) return true;
  // Secondary effect with negative boosts on the target: Crunch, Iron Tail.
  if (hasNegative(m.secondary?.boosts)) return true;
  if (m.secondaries) {
    for (const s of m.secondaries) {
      if (hasNegative(s.boosts)) return true;
    }
  }
  return false;
}

function hasPositive(b: Record<string, number> | undefined): boolean {
  if (!b) return false;
  for (const v of Object.values(b)) if (typeof v === 'number' && v > 0) return true;
  return false;
}

function hasNegative(b: Record<string, number> | undefined): boolean {
  if (!b) return false;
  for (const v of Object.values(b)) if (typeof v === 'number' && v < 0) return true;
  return false;
}

export interface DescPair {
  short?: string;
  full?: string;
}

/**
 * Returns prose descriptions for a move. `full` is the multi-sentence
 * description; `short` is a one-liner. Both can be missing for cosmetic
 * moves that PS doesn't document - caller should treat both as optional.
 */
export async function moveDescription(moveName: string): Promise<DescPair> {
  const gen = await loadPkmnGen();
  const id = toID(moveName) as unknown as string;
  // Prefer the target-gen entry; fall back to the latest dex for moves
  // introduced post-gen-7 (Trailblaze, Tera Blast, ...).
  const m = gen.moves.get(id) ?? latestGenCache?.moves.get(id);
  return { short: m?.shortDesc || undefined, full: m?.desc || undefined };
}

/** Same shape as moveDescription, for abilities. */
export async function abilityDescription(name: string): Promise<DescPair> {
  const gen = await loadPkmnGen();
  const id = toID(name) as unknown as string;
  // Prefer the target-gen entry; fall back to the latest dex for abilities
  // introduced post-gen-7 (Armor Tail, Cud Chew, Toxic Chain, ...).
  const a = gen.abilities.get(id) ?? latestGenCache?.abilities.get(id);
  return { short: a?.shortDesc || undefined, full: a?.desc || undefined };
}

/** Same shape as moveDescription, for items. */
export async function itemDescription(name: string): Promise<DescPair> {
  const gen = await loadPkmnGen();
  const id = toID(name) as unknown as string;
  const it = gen.items.get(id) ?? latestGenCache?.items.get(id);
  return { short: it?.shortDesc || undefined, full: it?.desc || undefined };
}

/**
 * True if `species` can legally learn `moveName` in our target gen. Returns
 * false for unknown species/moves. The underlying @pkmn/data API is async
 * (learnsets are large and lazy-loaded), so this is async too.
 */
export async function canLearn(species: string, moveName: string): Promise<boolean> {
  const gen = await loadPkmnGen();
  try {
    return await gen.learnsets.canLearn(species, moveName);
  } catch {
    return false;
  }
}

/**
 * Bulk variant: returns the set of move IDs `species` can learn. Intended
 * for the MovePicker, which filters a long ALL_MOVES list - calling
 * canLearn() per row would issue O(N) async lookups.
 */
export async function getLearnableMoveIds(species: string): Promise<Set<string>> {
  const gen = await loadPkmnGen();
  const out = new Set<string>();
  try {
    // @pkmn/data exposes learnsets.get(name) -> Promise<Learnset|undefined>;
    // the .learnset object is { moveid: string[] } where keys are move ids.
    const ls = await (
      gen as unknown as {
        learnsets: { get(name: string): Promise<{ learnset?: Record<string, unknown> } | undefined> };
      }
    ).learnsets.get(species);
    if (ls?.learnset) {
      for (const id of Object.keys(ls.learnset)) out.add(id);
    }
  } catch {
    // species not in dex, or learnset missing - leave the set empty
  }
  return out;
}
