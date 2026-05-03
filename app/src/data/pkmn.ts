/**
 * Thin wrapper around @pkmn/data + @pkmn/dex providing learnsets and prose
 * descriptions for moves and abilities, scoped to the generation that best
 * matches our Champions data.
 *
 * Why gen 7 (Sun/Moon)?
 * ---------------------
 * Champions is calc's synthetic gen 0; @pkmn/data has no equivalent. We grep
 * the legacy SETDEX_CHAMPIONS for set-name prefixes and overwhelmingly find
 * "SM …" entries (Mega Stones, Z-moves, USUM-era picks) — the rest are
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
import { toID } from '@smogon/calc';

const TARGET_GEN = 7;

interface PkmnMove {
  desc?: string;
  shortDesc?: string;
  priority?: number;
}

interface PkmnApi {
  moves: {
    get(name: string): PkmnMove | undefined;
    [Symbol.iterator](): Iterator<PkmnMove & { name?: string; id?: string }>;
  };
  abilities: { get(name: string): { desc?: string; shortDesc?: string } | undefined };
  learnsets: { canLearn(species: string, move: string): Promise<boolean> };
}

let pkmnGenPromise: Promise<PkmnApi> | null = null;

/**
 * Sync cache of move-id -> priority, populated by {@link preloadPkmn}. Empty
 * until the first preload completes; callers must treat a missing entry as
 * "unknown" rather than "priority 0".
 */
const PRIORITY_CACHE: Map<string, number> = new Map();
let prioritiesLoaded = false;

function loadPkmnGen(): Promise<PkmnApi> {
  if (!pkmnGenPromise) {
    pkmnGenPromise = (async () => {
      const [{ Generations }, dexMod] = await Promise.all([
        import('@pkmn/data'),
        import('@pkmn/dex'),
      ]);
      const gens = new Generations(dexMod.Dex);
      const gen = gens.get(TARGET_GEN) as unknown as PkmnApi;
      // Warm the priority lookup so the calc adapter can correct calc's gen-0
      // move data, which omits priority for several Champions-legal moves
      // (Trick Room, Roar, Whirlwind, …). Iteration is sync once the gen
      // bundle is loaded; this is cheap.
      try {
        for (const m of gen.moves) {
          if (typeof m.priority === 'number' && m.priority !== 0 && m.id) {
            PRIORITY_CACHE.set(m.id, m.priority);
          }
        }
      } catch {
        // If iteration is unavailable, leave the cache empty — callers
        // already treat missing entries as "no override".
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

export interface DescPair {
  short?: string;
  full?: string;
}

/**
 * Returns prose descriptions for a move. `full` is the multi-sentence
 * description; `short` is a one-liner. Both can be missing for cosmetic
 * moves that PS doesn't document — caller should treat both as optional.
 */
export async function moveDescription(moveName: string): Promise<DescPair> {
  const gen = await loadPkmnGen();
  const id = toID(moveName) as unknown as string;
  const m = gen.moves.get(id);
  return { short: m?.shortDesc || undefined, full: m?.desc || undefined };
}

/** Same shape as moveDescription, for abilities. */
export async function abilityDescription(name: string): Promise<DescPair> {
  const gen = await loadPkmnGen();
  const id = toID(name) as unknown as string;
  const a = gen.abilities.get(id);
  return { short: a?.shortDesc || undefined, full: a?.desc || undefined };
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
 * for the MovePicker, which filters a long ALL_MOVES list — calling
 * canLearn() per row would issue O(N) async lookups.
 */
export async function getLearnableMoveIds(species: string): Promise<Set<string>> {
  const gen = await loadPkmnGen();
  const out = new Set<string>();
  try {
    // @pkmn/data exposes learnsets.get(name) -> Promise<Learnset|undefined>;
    // the .learnset object is { moveid: string[] } where keys are move ids.
    const ls = await (gen as unknown as {
      learnsets: { get(name: string): Promise<{ learnset?: Record<string, unknown> } | undefined> };
    }).learnsets.get(species);
    if (ls?.learnset) {
      for (const id of Object.keys(ls.learnset)) out.add(id);
    }
  } catch {
    // species not in dex, or learnset missing — leave the set empty
  }
  return out;
}
