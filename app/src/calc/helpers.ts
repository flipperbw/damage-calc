import { MEGA_STONES } from '@smogon/calc';

import { GEN, toID } from '@/calc/gen';
import type { MegaState, StatID } from '@/types';

/** True iff the item is a mega stone in the calc's MEGA_STONES table. */
export function isMegaStone(item: string | undefined): boolean {
  if (!item) return false;
  return Object.prototype.hasOwnProperty.call(MEGA_STONES, item);
}

/**
 * Returns the calc-ready species name with mega suffix applied based on the
 * `mega` flag. When the held item is a mega stone, we consult the MEGA_STONES
 * table first — that's authoritative for irregular cases like
 * Floette-Eternal + Floettite → Floette-Mega (NOT Floette-Eternal-Mega) and
 * Magearna-Original + Magearnite → Magearna-Original-Mega.
 *
 * When no item is provided (or the item isn't a mega stone for this species),
 * we fall back to the naive species + "-Mega"/"-Mega-X"/"-Mega-Y" rule, which
 * is correct for the vast majority of mons.
 *
 * Does NOT validate that the resulting forme exists in calc data; callers
 * that need existence-checking (the damage adapter) handle that separately.
 */
export function megaFormeName(species: string, mega: MegaState, item?: string): string {
  if (!mega) return species;
  if (species.endsWith('-Mega') || species.includes('-Mega-')) return species;
  if (item) {
    const stoneMap = (MEGA_STONES as Record<string, Record<string, string>>)[item];
    const mapped = stoneMap?.[species];
    if (mapped) return mapped;
  }
  if (mega === 'mega-x') return `${species}-Mega-X`;
  if (mega === 'mega-y') return `${species}-Mega-Y`;
  return `${species}-Mega`;
}

/** Resolve a nature's stat-mod pair via calc. Returns {} for invalid names or the neutral natures. */
export function natureMods(nature: string): { plus?: StatID; minus?: StatID } {
  const n = GEN.natures.get(toID(nature) as any);
  if (!n) return {};
  return { plus: n.plus as StatID | undefined, minus: n.minus as StatID | undefined };
}

/**
 * The ability actually in effect at battle time. When a mon is mega-evolved
 * we override the user's base-form ability with the mega forme's ability
 * (Mega Charizard X is Tough Claws regardless of base Blaze/Solar Power
 * selection). For non-mega mons or mega formes that calc doesn't have a
 * documented ability for, falls back to the user's selection.
 */
export function effectiveAbility(species: string, mega: MegaState, baseAbility: string | undefined, item?: string): string | undefined {
  if (!mega) return baseAbility;
  const megaSpecies = megaFormeName(species, mega, item);
  const sp = GEN.species.get(toID(megaSpecies) as any);
  if (!sp?.abilities) return baseAbility;
  // Calc's species table stores mega abilities in slot 0. Use it when
  // present; otherwise keep the user's pick.
  const slot0 = (sp.abilities as Record<string, string>)['0'];
  return slot0 || baseAbility;
}
