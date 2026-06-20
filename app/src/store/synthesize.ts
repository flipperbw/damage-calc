import { GEN, toID } from '@/calc/gen';
import { getLearnableMoveIds } from '@/data/pkmn';
import type { SavedMon, StatID } from '@/types';
import { uuid } from '@/util/uuid';

/**
 * Synthesizes a "max-offense" build for any species: max best-attack stat,
 * nature picked to push the chosen stat further, and the top four highest-BP
 * moves from the species's learnset (preferring the category that matches
 * the chosen attack stat).
 *
 * Algorithm:
 *   - bestAtk = atk vs spa (whichever base stat is higher)
 *   - if base spe ≥ 90 (already fast) → nature +Spe -worstAtk; SPs: bestAtk=32, spe=32, hp=2
 *   - else → nature +bestAtk -worstAtk; SPs: bestAtk=32, hp=18, (def or spd)=16
 *     (slow mons gain more from bulk than from chasing speed they can't hit)
 *   - moves: top 4 by BP, matching-category first; status moves excluded
 *   - ability: species's first canonical ability
 */
const FAST_THRESHOLD = 90;

const NATURE_TABLE: Record<string, Record<string, string>> = {
  atk: { def: 'Lonely', spa: 'Adamant', spd: 'Naughty', spe: 'Brave' },
  def: { atk: 'Bold', spa: 'Impish', spd: 'Lax', spe: 'Relaxed' },
  spa: { atk: 'Modest', def: 'Mild', spd: 'Rash', spe: 'Quiet' },
  spd: { atk: 'Calm', def: 'Gentle', spa: 'Careful', spe: 'Sassy' },
  spe: { atk: 'Timid', def: 'Hasty', spa: 'Jolly', spd: 'Naive' },
};

function natureFor(plus: StatID, minus: StatID): string {
  return NATURE_TABLE[plus]?.[minus] ?? 'Hardy';
}

export interface SynthSummary {
  bestAtk: 'atk' | 'spa';
  isFast: boolean;
  nature: string;
}

export function summarizeSynth(species: string): SynthSummary | null {
  const sp = GEN.species.get(toID(species) as any);
  if (!sp) return null;
  const base = sp.baseStats;
  const bestAtk: 'atk' | 'spa' = base.atk >= base.spa ? 'atk' : 'spa';
  const worstAtk: 'atk' | 'spa' = bestAtk === 'atk' ? 'spa' : 'atk';
  const isFast = base.spe >= FAST_THRESHOLD;
  const plus: StatID = isFast ? 'spe' : bestAtk;
  const minus: StatID = worstAtk;
  return { bestAtk, isFast, nature: natureFor(plus, minus) };
}

/**
 * Background-fill a curated-build-less mon with the same Auto build the
 * BuildDropdown's "Auto · Max-Speed Sweeper" option produces. Use this
 * right after seating a mon via defaultOpponentMon / defaultTeamMon when
 * the picker can't open the editor first.
 *
 * Returns immediately. The patch lands via `setter` once @pkmn/data
 * resolves; `getCurrent` is called at that moment to bail out cleanly if
 * the user already moved on (different species in the slot, slot deleted,
 * opponent replaced). No-op when the mon already has a buildName.
 */
export function applySynthIfMissing(
  mon: SavedMon,
  getCurrent: () => SavedMon | null | undefined,
  setter: (patched: SavedMon) => void,
): void {
  if (mon.buildName) return;
  void synthesizeBuild(mon.species).then((built) => {
    if (!built) return;
    const current = getCurrent();
    if (!current || current.id !== mon.id || current.species !== mon.species) return;
    // Don't clobber user edits made while synth was in flight — only fill
    // the fields synth produces if they're still the empty defaults the
    // factory put there.
    const movesUntouched = current.moves.every((m) => !m);
    const spsUntouched = Object.values(current.sps).every((v) => !v);
    if (!movesUntouched || !spsUntouched) return;
    setter({
      ...current,
      buildName: 'Auto · Max-Speed Sweeper',
      ability: built.ability,
      nature: built.nature,
      sps: built.sps,
      moves: built.moves,
    });
  });
}

/**
 * The Champions SP spread the auto-build uses, derived synchronously from a
 * species' base stats: max the better attacking stat, then either max Spe
 * (fast mons) or invest in bulk (slow mons). Exported so callers that need a
 * sane default spread without the async move/ability lookup can reuse it -
 * notably curated mega builds, whose scraped data ships with empty EVs.
 */
export function autoSpread(species: string): Partial<Record<StatID, number>> {
  const sp = GEN.species.get(toID(species) as any);
  const summary = summarizeSynth(species);
  if (!sp || !summary) return {};
  const { bestAtk, isFast } = summary;
  return isFast
    ? { [bestAtk]: 32, spe: 32, hp: 2 }
    : sp.baseStats.def >= sp.baseStats.spd
      ? { [bestAtk]: 32, hp: 18, def: 16 }
      : { [bestAtk]: 32, hp: 18, spd: 16 };
}

export async function synthesizeBuild(species: string): Promise<SavedMon | null> {
  const sp = GEN.species.get(toID(species) as any);
  if (!sp) return null;
  const summary = summarizeSynth(species);
  if (!summary) return null;
  const { bestAtk, nature } = summary;

  // Fast mons max Spe; slow mons spend the budget on bulk instead. Shared
  // with curated mega builds via autoSpread.
  const sps: Partial<Record<StatID, number>> = autoSpread(species);

  // Filter candidate moves: any non-status move the species can learn.
  // If learnset lookup fails or returns empty (species not in @pkmn/data),
  // accept any non-status move from the calc gen-0 table - better to ship
  // a synth build with possibly-illegal moves than zero moves at all.
  const learnable = await getLearnableMoveIds(species).catch(() => new Set<string>());
  const candidates: { name: string; bp: number; cat: string }[] = [];
  const wantPhysical = bestAtk === 'atk';
  for (const m of GEN.moves) {
    const id = toID(m.name) as unknown as string;
    if (learnable.size > 0 && !learnable.has(id)) continue;
    const bp = ((m as any).bp ?? (m as any).basePower ?? 0) as number;
    if (bp === 0) continue;
    const cat = (m.category as string) ?? '';
    candidates.push({ name: m.name, bp, cat });
  }
  candidates.sort((a, b) => {
    // Matching-category first, then by BP desc.
    const aMatch = (a.cat === 'Physical') === wantPhysical ? 0 : 1;
    const bMatch = (b.cat === 'Physical') === wantPhysical ? 0 : 1;
    if (aMatch !== bMatch) return aMatch - bMatch;
    return b.bp - a.bp;
  });
  const top = candidates.slice(0, 4);
  const moves: [string, string, string, string] = [top[0]?.name ?? '', top[1]?.name ?? '', top[2]?.name ?? '', top[3]?.name ?? ''];

  // Walk the baseSpecies chain to find abilities — calc keys some
  // formes (Aegislash-Shield, Aegislash-Both, etc.) off a parent entry
  // that holds the canonical ability list. Without this walk synth ends
  // up with ability=undefined for those species and the user sees no
  // ability chip until they pick one manually.
  let abilities: Record<string, string> = (sp.abilities ?? {}) as Record<string, string>;
  let cursor: { abilities?: Record<string, string>; baseSpecies?: string } = sp as unknown as typeof cursor;
  while (Object.keys(abilities).length === 0 && cursor.baseSpecies) {
    const parent = GEN.species.get(toID(cursor.baseSpecies) as any);
    if (!parent) break;
    cursor = parent as unknown as typeof cursor;
    abilities = (cursor.abilities ?? {}) as Record<string, string>;
  }
  const ability = (Object.values(abilities)[0] as string | undefined) ?? undefined;

  return {
    id: uuid(),
    species,
    nature,
    sps,
    moves,
    mega: '',
    boosts: {},
    ability,
  };
}
