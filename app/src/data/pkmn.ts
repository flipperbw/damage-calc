/**
 * Wrapper providing learnsets and prose descriptions for moves and abilities.
 *
 * Learnsets come from the vendored Champions mod table (`@pkmn/ps`'s
 * `mods/src/champions/learnsets.ts`, pulled via `npm run vendor:champions`).
 * That file is the authoritative legality list for the Champions format —
 * it carries TM-added moves the upstream gen tables miss (Froslass's Nasty
 * Plot, for example) and only includes moves the format actually allows.
 * `@pkmn/data` gen 9 is the defensive fallback for any species not in the
 * Champions table.
 *
 * Prose descriptions still come from `@pkmn/data` (gen 9 primary, gen 7
 * fallback for moves/abilities the latest dex dropped — Z-moves, Hidden
 * Power, etc.).
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

import { CHAMPIONS_LEARNSETS } from '@/data/generated/champions-learnsets.generated';

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
  learnsets: {
    canLearn(species: string, move: string): Promise<boolean>;
    get(name: string): Promise<{ learnset?: Record<string, unknown> } | undefined>;
  };
  species: {
    get(name: string): { id?: string; name?: string; baseSpecies?: string; prevo?: string; changesFrom?: string; abilities?: Record<string, string> } | undefined;
    [Symbol.iterator](): Iterator<{ id?: string; name?: string; baseSpecies?: string; prevo?: string; changesFrom?: string; abilities?: Record<string, string> }>;
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

// Moves that scale to perfect (100%) accuracy in Rain and halve in Sun.
// Hurricane / Thunder are the long-standing pair; the gen-9 Bleakwind /
// Wildbolt / Sandsear Storm trio follow the same rule by design.
const RAIN_PERFECTED_MOVES = new Set([
  'hurricane',
  'thunder',
  'bleakwindstorm',
  'wildboltstorm',
  'sandsearstorm',
]);

/**
 * Returns the *effective* accuracy of a move given the current weather. Lifts
 * Hurricane / Thunder / *Storm to 100% in Rain (halves them in Sun), and
 * Blizzard to always-hit in Snow. Falls back to the base accuracy otherwise.
 *
 * Returns `null` until @pkmn/data's accuracy cache is warm, mirroring
 * `moveAccuracy`.
 */
export function effectiveMoveAccuracy(
  moveName: string,
  weather: 'Sun' | 'Rain' | 'Sand' | 'Snow' | undefined,
): number | true | null {
  const base = moveAccuracy(moveName);
  if (base === null) return null;
  const id = toID(moveName) as unknown as string;
  if (RAIN_PERFECTED_MOVES.has(id)) {
    if (weather === 'Rain') return 100;
    // In harsh sunlight Hurricane / Thunder / *Storm have a flat 50% per
    // game mechanics — not "base halved" (which would land at 35).
    if (weather === 'Sun') return 50;
  }
  if (id === 'blizzard' && weather === 'Snow') return true;
  return base;
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

// Names whose hyphen is intrinsic to the species (not a forme indicator).
// stripFormeSuffix leaves these alone so we don't accidentally strip
// "Porygon-Z" down to "Porygon".
const INTRINSIC_HYPHEN_NAMES = new Set([
  'Ho-Oh',
  'Porygon-Z',
  'Jangmo-o',
  'Hakamo-o',
  'Kommo-o',
]);

/**
 * Strips a forme suffix off a species name when present. Returns null if the
 * name has no hyphenated forme or is itself intrinsically hyphenated.
 *
 *   Floette-Eternal → Floette
 *   Charizard-Mega-Y → Charizard
 *   Rotom-Wash → Rotom
 *   Porygon-Z → null   (intrinsic)
 *   Pikachu → null     (no hyphen)
 */
function stripFormeSuffix(name: string): string | null {
  if (INTRINSIC_HYPHEN_NAMES.has(name)) return null;
  const idx = name.indexOf('-');
  if (idx <= 0) return null;
  return name.slice(0, idx);
}

/**
 * Bulk variant: returns the set of move IDs `species` can learn. Intended
 * for the MovePicker, which filters a long ALL_MOVES list — calling
 * canLearn() per row would issue O(N) async lookups.
 *
 * Primary source: the vendored Champions learnsets table (`@pkmn/ps`'s
 * `mods/src/champions/learnsets.ts`). This is the authoritative legality
 * list for the Champions format — it carries TM-added moves the upstream
 * generation tables miss (Froslass's Nasty Plot, etc.) and only includes
 * moves the format actually allows. When the table has an entry for a
 * species we use it verbatim, no chain walking.
 *
 * Mega formes and Stance-Change-style variants don't get their own
 * Champions entry; we strip the hyphenated forme suffix and look up the
 * base id (Charizard-Mega-Y → charizard, Aegislash-Blade → aegislash).
 *
 * Fallback: @pkmn/data gen 9 with a conservative walk (prevo +
 * changesFrom only; baseSpecies only for mega formes). Used for any
 * species the vendored Champions table doesn't cover (off-meta picks
 * not yet in the format, or in case we ship before the next vendor pass).
 * The "Show all moves" toggle in MovePicker remains the safety valve.
 */
export async function getLearnableMoveIds(species: string): Promise<Set<string>> {
  // Need @pkmn/data loaded for two reasons: (a) `changesFrom` lookups to
  // resolve appliance-style formes (Rotom-Wash's Champions entry only
  // carries its appliance signature, the rest of the Electric kit lives
  // on the Rotom entry), and (b) the defensive gen-9 fallback below.
  await loadPkmnGen();
  const api: PkmnApi | null = latestGenCache;

  // Authoritative Champions lookup first. Try the species id directly,
  // then the suffix-stripped base id for formes that share a learnset.
  const championsHit = championsLearnableIds(species, api);
  if (championsHit) return championsHit;

  // Fallback: gen-9 @pkmn/data walk. Defensive — every Champions-legal
  // species *should* be in the vendored table, but a stale vendor pass
  // shouldn't break the picker entirely.
  const out = new Set<string>();
  if (!api) return out;

  const visited = new Set<string>();
  const fallbackApi = api;
  async function include(name: string): Promise<void> {
    if (visited.has(name)) return;
    visited.add(name);
    try {
      const ls = await fallbackApi.learnsets.get(name);
      if (ls?.learnset) {
        for (const id of Object.keys(ls.learnset)) out.add(id);
      }
    } catch {
      // species not in learnset table — try the fallback
    }
    const sp = (() => {
      try {
        return fallbackApi.species.get(name);
      } catch {
        return undefined;
      }
    })();
    if (!sp) {
      const stripped = stripFormeSuffix(name);
      if (stripped) await include(stripped);
      return;
    }
    if (sp.prevo && sp.prevo !== name) await include(sp.prevo);
    if (sp.changesFrom && sp.changesFrom !== name) await include(sp.changesFrom);
    if (isMegaFormeName(name) && sp.baseSpecies && sp.baseSpecies !== name) {
      await include(sp.baseSpecies);
    }
  }

  await include(species);
  return out;
}

function isMegaFormeName(name: string): boolean {
  return /-Mega(?:-X|-Y)?$/.test(name);
}

/**
 * Look up `species` in the vendored Champions learnsets table. Returns
 * the set of move ids, or null when the species isn't covered (caller
 * should fall back to the gen-9 walk).
 *
 * The Champions table keys species by lowercased-id (hyphens stripped)
 * — same as `toID()`. Mega formes and Stance Change variants share the
 * base species's entry, so when `toID(name)` misses we strip the forme
 * suffix and retry: `charizardmegay` → miss → `charizard` → hit.
 *
 * For appliance-style formes (Rotom-Wash et al.), the Champions table's
 * forme entry only carries the appliance signature move; the rest of
 * the kit lives on the base species's entry. We union via gen-9
 * `changesFrom` when @pkmn/data is loaded — it's the same pattern the
 * mod author expects consumers to handle.
 */
function championsLearnableIds(species: string, api: PkmnApi | null): Set<string> | null {
  const direct = CHAMPIONS_LEARNSETS[toID(species) as unknown as string];
  if (direct?.learnset) {
    const out = new Set<string>(Object.keys(direct.learnset));
    addChangesFromMoves(out, species, api);
    return out;
  }
  // Either there's no entry, or it's a bare `{}` cosmetic-forme entry —
  // which upstream uses to mean "no own learnset, inherit from the base
  // species" (e.g. Gourgeist-Super → gourgeist). Both cases fall through
  // to the suffix-stripped base lookup.
  const stripped = stripFormeSuffix(species);
  if (stripped) {
    const fallback = CHAMPIONS_LEARNSETS[toID(stripped) as unknown as string];
    if (fallback?.learnset) {
      const out = new Set<string>(Object.keys(fallback.learnset));
      addChangesFromMoves(out, stripped, api);
      return out;
    }
  }
  return null;
}

function addChangesFromMoves(out: Set<string>, name: string, api: PkmnApi | null): void {
  if (!api) return;
  let base: string | undefined;
  try {
    base = api.species.get(name)?.changesFrom;
  } catch {
    base = undefined;
  }
  if (!base) return;
  const baseEntry = CHAMPIONS_LEARNSETS[toID(base) as unknown as string];
  if (!baseEntry?.learnset) return;
  for (const id of Object.keys(baseEntry.learnset)) out.add(id);
}
