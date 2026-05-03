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

interface PkmnApi {
  moves: { get(name: string): { desc?: string; shortDesc?: string } | undefined };
  abilities: { get(name: string): { desc?: string; shortDesc?: string } | undefined };
  learnsets: { canLearn(species: string, move: string): Promise<boolean> };
}

let pkmnGenPromise: Promise<PkmnApi> | null = null;

function loadPkmnGen(): Promise<PkmnApi> {
  if (!pkmnGenPromise) {
    pkmnGenPromise = (async () => {
      const [{ Generations }, dexMod] = await Promise.all([
        import('@pkmn/data'),
        import('@pkmn/dex'),
      ]);
      const gens = new Generations(dexMod.Dex);
      return gens.get(TARGET_GEN) as unknown as PkmnApi;
    })();
  }
  return pkmnGenPromise;
}

/** Imperatively warm the cache; safe to call at app startup or first picker open. */
export function preloadPkmn(): Promise<void> {
  return loadPkmnGen().then(() => undefined);
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
