import { calculateMatchup } from '@/calc/adapter';
import { GEN, toID } from '@/calc/gen';
import { getKnownMovesForSpecies } from '@/data/setdex-champions';
import type { FieldState, SavedMon } from '@/types';

/**
 * Worst-case opponent build search. Two flavors, both purely synthesized
 * (no curated-setdex consideration — the search is about absolute worst
 * case, not "which preset matches"):
 *
 *   - findHardestHitter: synthesizes Physical + Special max-threat
 *     templates, picks whichever does more damage to your active mon.
 *   - findTankiestBuild: synthesizes the wall on the side matching your
 *     primary attack category (Physical or Special).
 *
 * Only Champions-legal items are used: Choice Band / Choice Specs for
 * attackers, Leftovers for walls. No Assault Vest etc.
 */

export interface WorstCaseResult {
  mon: SavedMon;
  /** Display name for the synthesized template (e.g. "Max-threat Special"). */
  label: string;
  /** Max damage relevant to the search direction — for UI labelling. */
  damage: number;
}

export function findHardestHitter(
  species: string,
  defender: SavedMon,
  field: FieldState,
  format: 'singles' | 'doubles' = 'singles',
): WorstCaseResult | null {
  const phys = synthesizeMaxThreat(species, 'Physical');
  const spec = synthesizeMaxThreat(species, 'Special');
  const physDmg = phys ? maxDamageOf(phys, defender, field, format) : 0;
  const specDmg = spec ? maxDamageOf(spec, defender, field, format) : 0;
  if (!phys && !spec) return null;
  if (physDmg >= specDmg && phys) return { mon: phys, label: 'Max-threat Physical', damage: physDmg };
  if (spec) return { mon: spec, label: 'Max-threat Special', damage: specDmg };
  return null;
}

export function findTankiestBuild(
  species: string,
  attacker: SavedMon,
  field: FieldState,
  format: 'singles' | 'doubles' = 'singles',
): WorstCaseResult | null {
  // The synthesized wall side matches your attacker's primary category so
  // a special attacker always gets an SpD-invested wall. With curated
  // builds out of the picture, this is the entire search.
  const primary = primaryAttackCategory(attacker, field, format) ?? 'Physical';
  const mon = synthesizeWall(species, primary);
  if (!mon) return null;
  const taken = maxDamageOf(attacker, mon, field, format);
  return { mon, label: `${primary} wall`, damage: taken };
}

/**
 * Which damage category should we wall against? Picks whichever of the
 * attacker's moves does the most damage to a neutral (empty) defender. We
 * use an empty test target so the choice doesn't depend on the actual opp
 * — it's about "what does this attacker want to hit with."
 */
function primaryAttackCategory(attacker: SavedMon, field: FieldState, format: 'singles' | 'doubles'): 'Physical' | 'Special' | null {
  const testTarget: SavedMon = {
    id: 'wc-test-target',
    species: attacker.species, // any species — we just need calc to produce damage
    nature: 'Hardy',
    sps: {},
    moves: ['', '', '', ''],
    mega: '',
    boosts: {},
  };
  try {
    const res = calculateMatchup(attacker, testTarget, field, format);
    let physMax = 0;
    let specMax = 0;
    for (const m of res.attackerMoves) {
      if (!m.moveName || m.isStatus || m.isImmune) continue;
      if (m.category === 'Physical' && m.damageRange[1] > physMax) physMax = m.damageRange[1];
      if (m.category === 'Special' && m.damageRange[1] > specMax) specMax = m.damageRange[1];
    }
    if (physMax === 0 && specMax === 0) return null;
    return physMax >= specMax ? 'Physical' : 'Special';
  } catch {
    return null;
  }
}

function maxDamageOf(attacker: SavedMon, defender: SavedMon, field: FieldState, format: 'singles' | 'doubles'): number {
  try {
    const res = calculateMatchup(attacker, defender, field, format);
    let max = 0;
    for (const m of res.attackerMoves) {
      if (!m.moveName || m.isStatus || m.isImmune) continue;
      if (m.damageRange[1] > max) max = m.damageRange[1];
    }
    return max;
  } catch {
    return 0;
  }
}

/**
 * Type → 1.2x damage booster item for that type. Champions has no Choice
 * Band / Choice Specs / Life Orb — these single-type +20% items are the
 * best Champions-legal offensive items. Stab moves already get x1.5 from
 * STAB; the booster multiplies the post-STAB damage by 1.2 again, which
 * matches Choice Band's effective output for stab-locked sets.
 */
const TYPE_BOOSTER: Record<string, string> = {
  Normal: 'Silk Scarf',
  Fire: 'Charcoal',
  Water: 'Mystic Water',
  Electric: 'Magnet',
  Grass: 'Miracle Seed',
  Ice: 'Never-Melt Ice',
  Fighting: 'Black Belt',
  Poison: 'Poison Barb',
  Ground: 'Soft Sand',
  Flying: 'Sharp Beak',
  Psychic: 'Twisted Spoon',
  Bug: 'Silver Powder',
  Rock: 'Hard Stone',
  Ghost: 'Spell Tag',
  Dragon: 'Dragon Fang',
  Dark: 'Black Glasses',
  Steel: 'Metal Coat',
  Fairy: 'Fairy Feather',
};

/**
 * Build a max-threat mon from scratch for `species` in `category`. Picks
 * the species's slot-0 ability, +nature on the attacking stat, a type-
 * matched 1.2x booster item for the strongest move (Champions has no
 * Choice Band / Specs / Life Orb), and the top-4 highest-BP moves of
 * the matching category from the species's known movepool. Returns null
 * if no matching offensive moves are known.
 */
function synthesizeMaxThreat(species: string, category: 'Physical' | 'Special'): SavedMon | null {
  const known = getKnownMovesForSpecies(species);
  if (known.length === 0) return null;
  const scored = known
    .map((name) => {
      const m = GEN.moves.get(toID(name) as any) as { bp?: number; basePower?: number; category?: string; type?: string } | undefined;
      const bp = (m?.bp ?? m?.basePower ?? 0) as number;
      const cat = (m?.category ?? '') as string;
      return { name, bp, cat, type: m?.type as string | undefined };
    })
    .filter((x) => x.cat === category && x.bp > 0)
    .sort((a, b) => b.bp - a.bp);
  if (scored.length === 0) return null;

  const moves: [string, string, string, string] = [
    scored[0]?.name ?? '',
    scored[1]?.name ?? '',
    scored[2]?.name ?? '',
    scored[3]?.name ?? '',
  ];

  const sp = GEN.species.get(toID(species) as any);
  const abilityBag = (sp?.abilities ?? {}) as Record<string, string>;
  const ability = (abilityBag['0'] ?? Object.values(abilityBag)[0] ?? '') as string;

  // Pick the 1.2x type-booster matching the strongest move's type. Falls
  // back to no item if the type is unknown (calc handles undefined item).
  const topMoveType = scored[0]?.type;
  const item = topMoveType ? TYPE_BOOSTER[topMoveType] : undefined;

  const isPhysical = category === 'Physical';
  return {
    id: `worstcase-synth-${species}-${category}`,
    species,
    buildName: `Max-threat ${category}`,
    item,
    ability: ability || undefined,
    nature: isPhysical ? 'Adamant' : 'Modest',
    // Champions SP budget: 32 to the attacking stat, 32 to Spe (so the
    // worst case can move first), leftover to HP. Total = 66.
    sps: isPhysical ? { atk: 32, spe: 32, hp: 2 } : { spa: 32, spe: 32, hp: 2 },
    moves,
    mega: '',
    boosts: {},
  };
}

/**
 * Mirror of synthesizeMaxThreat for the tankiest-build search. Picks a
 * pure wall template — max HP + max defensive stat, +nature on the
 * defending side, Leftovers for passive recovery. Moves are filler from
 * the species's known set since the search only scores incoming damage,
 * not outgoing.
 */
function synthesizeWall(species: string, side: 'Physical' | 'Special'): SavedMon | null {
  const known = getKnownMovesForSpecies(species);
  // Pick any 4 moves so the mon isn't "no moves" — filler doesn't affect
  // the "how much damage does it take?" score.
  const moves: [string, string, string, string] = [known[0] ?? '', known[1] ?? '', known[2] ?? '', known[3] ?? ''];

  const sp = GEN.species.get(toID(species) as any);
  const abilityBag = (sp?.abilities ?? {}) as Record<string, string>;
  const ability = (abilityBag['0'] ?? Object.values(abilityBag)[0] ?? '') as string;

  const isPhys = side === 'Physical';
  return {
    id: `worstcase-synth-${species}-wall-${side}`,
    species,
    buildName: `${side} wall`,
    // Champions has no Def/SpD-boosting item available (Assault Vest is
    // out of scope, Eviolite NFE-only and absent from gen 0). Leftovers
    // is the best generic defensive item.
    item: 'Leftovers',
    ability: ability || undefined,
    // Bold (+Def, -Atk) for physical walls; Calm (+SpD, -Atk) for special.
    // Both drop Atk because a wall isn't expected to be hitting back.
    nature: isPhys ? 'Bold' : 'Calm',
    // Max HP (32) + max defending stat (32) + 2 leftover to the other
    // side to keep the build legal (66 total in Champions).
    sps: isPhys ? { hp: 32, def: 32, spd: 2 } : { hp: 32, spd: 32, def: 2 },
    moves,
    mega: '',
    boosts: {},
  };
}
