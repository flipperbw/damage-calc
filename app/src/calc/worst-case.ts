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
  currentOpponent?: SavedMon,
): WorstCaseResult | null {
  const sp = GEN.species.get(toID(species) as any);
  if (!sp) return null;

  // SpD wall vs Def wall pick depends on whether the attacker hits harder
  // physically or specially — picks the side we need to brace against.
  const primary = primaryAttackCategory(attacker, field, format) ?? 'Physical';

  // Try every ability the species has (Sturdy / Levitate / Flash Fire /
  // Volt Absorb / etc. matter enormously for tankiness) and a curated set
  // of defensive items — Leftovers as a baseline; Focus Sash for OHKO
  // prevention; and the matching resist berry when the attacker's top move
  // is super-effective against the wall, which is the live case the user
  // hit: Kingambit can survive Aura Sphere with Chople Berry that a
  // Leftovers Kingambit can't.
  const fromPkmn = getSpeciesAbilities(species);
  const calcAbilities = Object.values(sp.abilities ?? {}) as string[];
  const abilities = fromPkmn && fromPkmn.length > 0 ? fromPkmn : calcAbilities;
  if (abilities.length === 0) return null;

  // Add a resist berry candidate for EVERY damaging move type the attacker
  // carries — not just the move that deals most damage to a neutral test
  // target. The "neutral" heuristic missed Aura Sphere on Blastoise vs
  // Kingambit: Hydro Pump deals more vs neutral so we'd pick Passho Berry,
  // but Aura Sphere (4× SE on Dark/Steel) is the move that actually one-
  // shots Kingambit, and Chople Berry is what saves it. Adding all types
  // lets the damage-scored search find the right berry.
  const items: (string | undefined)[] = ['Leftovers', 'Focus Sash'];
  const seenBerry = new Set<string>();
  for (const type of attackerMoveTypes(attacker, field, format)) {
    const berry = RESIST_BERRY_BY_TYPE[type];
    if (berry && !seenBerry.has(berry)) {
      seenBerry.add(berry);
      items.push(berry);
    }
  }

  let best: { mon: SavedMon; damage: number } | null = null;
  for (const ability of abilities) {
    for (const item of items) {
      const wall = buildWall(species, primary, ability, item);
      const damage = maxDamageOf(attacker, wall, field, format);
      if (!best || damage < best.damage) {
        best = { mon: wall, damage };
      }
    }
  }
  if (!best) return null;

  // Floor: don't swap if the user's current opp set already takes ≤ this
  // damage. Mirrors the findHardestHitter behaviour so clicking the button
  // on an already-optimal wall toasts rather than installing a weaker one.
  if (currentOpponent) {
    const currentDmg = maxDamageOf(attacker, currentOpponent, field, format);
    if (best.damage >= currentDmg) return null;
  }

  return { mon: best.mon, label: `${primary} wall`, damage: best.damage };
}

/** Type → resist berry that halves super-effective damage of that type. */
const RESIST_BERRY_BY_TYPE: Record<string, string> = {
  Normal: 'Chilan Berry',
  Fire: 'Occa Berry',
  Water: 'Passho Berry',
  Electric: 'Wacan Berry',
  Grass: 'Rindo Berry',
  Ice: 'Yache Berry',
  Fighting: 'Chople Berry',
  Poison: 'Kebia Berry',
  Ground: 'Shuca Berry',
  Flying: 'Coba Berry',
  Psychic: 'Payapa Berry',
  Bug: 'Tanga Berry',
  Rock: 'Charti Berry',
  Ghost: 'Kasib Berry',
  Dragon: 'Haban Berry',
  Dark: 'Colbur Berry',
  Steel: 'Babiri Berry',
  Fairy: 'Roseli Berry',
};

/**
 * Every damaging move type the attacker carries. Resist-berry candidates
 * are seeded from this set — the damage-scored search then picks whichever
 * berry minimises the worst incoming move. A move-type-only enumeration
 * (no scoring against the wall yet, since the wall doesn't exist) means
 * we try every plausible berry without needing a chicken-and-egg solve.
 */
function attackerMoveTypes(attacker: SavedMon, field: FieldState, format: 'singles' | 'doubles'): Set<string> {
  const out = new Set<string>();
  const testTarget: SavedMon = {
    id: 'wc-type-probe',
    species: attacker.species,
    nature: 'Hardy',
    sps: {},
    moves: ['', '', '', ''],
    mega: '',
    boosts: {},
  };
  try {
    const res = calculateMatchup(attacker, testTarget, field, format);
    for (const m of res.attackerMoves) {
      if (!m.moveName || m.isStatus) continue;
      if (m.type) out.add(m.type);
    }
  } catch {
    // ignore — empty set just means no berry candidates beyond Leftovers/Sash
  }
  return out;
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
 * Build a wall candidate fixed to (ability, item). Max HP + max defensive
 * stat on the right side, defensive nature, filler moves. The caller
 * picks ability + item; this function just stamps the rest of the build.
 */
function buildWall(species: string, side: 'Physical' | 'Special', ability: string, item: string | undefined): SavedMon {
  const known = getKnownMovesForSpecies(species);
  const moves: [string, string, string, string] = [known[0] ?? '', known[1] ?? '', known[2] ?? '', known[3] ?? ''];
  const isPhys = side === 'Physical';
  return {
    id: `worstcase-synth-${species}-wall-${side}-${toID(ability)}-${item ? toID(item) : 'none'}`,
    species,
    buildName: `${side} wall`,
    item,
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
