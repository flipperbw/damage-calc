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
 * `mega` flag. Does NOT validate that the resulting forme exists in calc data;
 * callers that need existence-checking (the damage adapter) handle that
 * separately. When `mega` is empty or the species is already a mega forme,
 * the input species is returned unchanged.
 */
export function megaFormeName(species: string, mega: MegaState): string {
  if (!mega) return species;
  if (species.endsWith('-Mega') || species.includes('-Mega-')) return species;
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
export function effectiveAbility(species: string, mega: MegaState, baseAbility: string | undefined): string | undefined {
  if (!mega) return baseAbility;
  const megaSpecies = megaFormeName(species, mega);
  const sp = GEN.species.get(toID(megaSpecies) as any);
  if (!sp?.abilities) return baseAbility;
  // Calc's species table stores mega abilities in slot 0. Use it when
  // present; otherwise keep the user's pick.
  const slot0 = (sp.abilities as Record<string, string>)['0'];
  return slot0 || baseAbility;
}
