import { calculateMatchup } from '@/calc/adapter';
import { GEN, toID } from '@/calc/gen';
import { getSpeciesAbilities } from '@/data/pkmn';
import { getKnownMovesForSpecies } from '@/data/setdex-champions';
import type { FieldState, SavedMon } from '@/types';

/**
 * Worst-case opponent build search. Two flavors, both purely synthesized
 * (no curated-setdex consideration — the search is about absolute worst
 * case, not "which preset matches"):
 *
 *   - findHardestHitter: searches across abilities, items, and moves to
 *     find the (ability, move, item) combination that deals the most
 *     damage to the defender. Optionally takes a `currentOpponent` and
 *     returns null when the search can't beat the current build's damage
 *     — so clicking the button on an already-worst-case set doesn't
 *     swap it for a weaker one.
 *   - findTankiestBuild: synthesizes the wall on the side matching your
 *     primary attack category (Physical or Special).
 *
 * Only Champions-legal items are used: type-matching 1.2x boosters for
 * attackers, Leftovers for walls. No Choice Band / Specs / Life Orb /
 * Assault Vest.
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
  currentOpponent?: SavedMon,
): WorstCaseResult | null {
  const sp = GEN.species.get(toID(species) as any);
  if (!sp) return null;
  const known = getKnownMovesForSpecies(species);
  if (known.length === 0) return null;

  // Prefer @pkmn/data's full ability list (slot 0/1/hidden); fall back to
  // calc's gen-0 entry which only ships one default per species. Without
  // this fallback, "Swarm" is the only candidate for Kleavor — and the
  // user almost certainly has Sheer Force, which the synth misses.
  const fromPkmn = getSpeciesAbilities(species);
  const calcAbilities = Object.values(sp.abilities ?? {}) as string[];
  const abilities = fromPkmn && fromPkmn.length > 0 ? fromPkmn : calcAbilities;
  if (abilities.length === 0) return null;

  // All damaging moves the species can learn, indexed by category. Filler
  // moves for the 4-slot display come from the same category sorted by BP.
  const damaging = known
    .map((name) => {
      const m = GEN.moves.get(toID(name) as any) as { bp?: number; basePower?: number; category?: string; type?: string } | undefined;
      const bp = ((m?.bp ?? m?.basePower) ?? 0) as number;
      const cat = (m?.category ?? '') as string;
      const type = m?.type as string | undefined;
      return { name, bp, cat, type };
    })
    .filter((x) => x.bp > 0 && (x.cat === 'Physical' || x.cat === 'Special'));

  let best: { mon: SavedMon; damage: number; label: string } | null = null;

  // Search (category × ability × top-move). For each combo, score damage
  // vs the actual defender — this is what naturally surfaces STAB + type
  // effectiveness + ability multipliers (Sheer Force, Tough Claws, etc.).
  // The candidate's other 3 move slots are filled with same-category top
  // BP picks; they don't affect the max-damage score but matter for
  // display when the build lands in the opponent slot.
  for (const category of ['Physical', 'Special'] as const) {
    const catMoves = damaging.filter((x) => x.cat === category);
    if (catMoves.length === 0) continue;
    const fillers = [...catMoves].sort((a, b) => b.bp - a.bp);
    for (const ability of abilities) {
      for (const top of catMoves) {
        const item = top.type ? TYPE_BOOSTER[top.type] : undefined;
        const candidate = buildAttacker(species, category, ability, top.name, top.type, fillers, item);
        const damage = maxDamageOf(candidate, defender, field, format);
        if (!best || damage > best.damage) {
          best = { mon: candidate, damage, label: `Max-threat ${category}` };
        }
      }
    }
  }

  if (!best) return null;

  // Floor: if the user's current opp build already deals at least this much,
  // there's no point swapping — return null and let the caller toast.
  if (currentOpponent) {
    const currentDmg = maxDamageOf(currentOpponent, defender, field, format);
    if (best.damage <= currentDmg) return null;
  }

  return best;
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
 * Build a candidate attacker fixed to (ability, top move, type-matched
 * item). Other 3 move slots are filled with the species's top same-
 * category moves (by BP) so the displayed mon has a coherent 4-move set,
 * even though only `topMove` is what scored as the max-damage option.
 */
function buildAttacker(
  species: string,
  category: 'Physical' | 'Special',
  ability: string,
  topMove: string,
  topType: string | undefined,
  fillers: { name: string }[],
  item: string | undefined,
): SavedMon {
  void topType;
  const isPhysical = category === 'Physical';
  const others = fillers.filter((f) => f.name !== topMove).slice(0, 3);
  const moves: [string, string, string, string] = [topMove, others[0]?.name ?? '', others[1]?.name ?? '', others[2]?.name ?? ''];
  return {
    id: `worstcase-synth-${species}-${category}-${toID(ability)}-${toID(topMove)}`,
    species,
    buildName: `Max-threat ${category}`,
    item,
    ability,
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
 * Mirror of buildAttacker for the tankiest-build search. Picks a pure wall
 * template — max HP + max defensive stat, +nature on the defending side,
 * Leftovers for passive recovery. Moves are filler from the species's
 * known set since the search only scores incoming damage, not outgoing.
 */
function synthesizeWall(species: string, side: 'Physical' | 'Special'): SavedMon | null {
  const known = getKnownMovesForSpecies(species);
  const moves: [string, string, string, string] = [known[0] ?? '', known[1] ?? '', known[2] ?? '', known[3] ?? ''];

  const sp = GEN.species.get(toID(species) as any);
  const fromPkmn = getSpeciesAbilities(species);
  const abilities = fromPkmn && fromPkmn.length > 0 ? fromPkmn : (Object.values(sp?.abilities ?? {}) as string[]);
  const ability = abilities[0] ?? '';

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
