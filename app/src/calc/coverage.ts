import { Generations, toID } from '@smogon/calc';
import type { SavedMon } from '../types';
import { typeEffectiveness } from './adapter';

const GEN = Generations.get(0);

/**
 * The 18 standard battle types. Order matches the canonical type-chart
 * presentation. Excludes the placeholder "???" and the move-category
 * "Status" type, which carry no meaningful chart entries for coverage
 * analysis.
 */
export const STANDARD_TYPES: readonly string[] = [
  'Normal',
  'Fire',
  'Water',
  'Electric',
  'Grass',
  'Ice',
  'Fighting',
  'Poison',
  'Ground',
  'Flying',
  'Psychic',
  'Bug',
  'Rock',
  'Ghost',
  'Dragon',
  'Dark',
  'Steel',
  'Fairy',
];

export interface DefensiveOverlap {
  type: string;
  count: number;
}

export interface CoverageReport {
  /** Defending types your team can't hit ≥2× from any STAB or known coverage move. */
  offensiveGaps: string[];
  /** { type, count } pairs where 3+ team mons have that type as ≥2× weakness. */
  defensiveOverlaps: DefensiveOverlap[];
}

/** Threshold for marking a defending type as a "team-wide" weakness. */
const DEFENSIVE_OVERLAP_THRESHOLD = 3;

function speciesTypes(species: string): readonly string[] {
  const sp = GEN.species.get(toID(species) as any);
  if (!sp) return [];
  return (sp.types as readonly string[] | undefined) ?? [];
}

function moveType(name: string): string | null {
  if (!name) return null;
  const m = GEN.moves.get(toID(name) as any);
  if (!m) return null;
  const t = (m as any).type as string | undefined;
  if (!t || t === 'Status') return null;
  return t;
}

/**
 * Collect every attacking-type source the team can throw at the opponent -
 * each mon's STAB types plus the type of every non-empty, non-status move
 * in its `moves` array.
 *
 * Returned as a Set so duplicates collapse naturally; the consumer only
 * cares whether the team *has* coverage of a given type, not how many
 * sources contribute it.
 */
function collectAttackingTypes(team: readonly SavedMon[]): Set<string> {
  const types = new Set<string>();
  for (const mon of team) {
    for (const t of speciesTypes(mon.species)) {
      if (t) types.add(t);
    }
    for (const moveName of mon.moves) {
      const t = moveType(moveName);
      if (t) types.add(t);
    }
  }
  return types;
}

/**
 * Pure type-chart team analysis. No damage rolls - just reads STAB types,
 * the type of every saved move, and the standard 18-type chart via
 * `typeEffectiveness` from the adapter.
 *
 * Empty teams produce empty arrays for both readouts. We deliberately do
 * NOT report all 18 types as offensive gaps for an empty team - that would
 * be technically true but useless to render.
 */
export function analyzeCoverage(team: readonly SavedMon[]): CoverageReport {
  if (team.length === 0) {
    return { offensiveGaps: [], defensiveOverlaps: [] };
  }

  // --- Offensive gaps --------------------------------------------------
  // For each defending type T, take the max effectiveness across every
  // attacking-type source the team can muster. Anything below 2× is a gap.
  const attackingTypes = collectAttackingTypes(team);
  const offensiveGaps: string[] = [];
  for (const defType of STANDARD_TYPES) {
    let max = 0;
    for (const atkType of attackingTypes) {
      const mult = typeEffectiveness(atkType, [defType]);
      if (mult > max) max = mult;
    }
    if (max < 2) offensiveGaps.push(defType);
  }

  // --- Defensive overlaps ----------------------------------------------
  // For each attacking type A, count team mons whose typing makes them
  // ≥2× weak to A. Multipliers compound across both defender types so a
  // dual-type mon that's 2× weak on each axis surfaces as 4×.
  const overlaps: DefensiveOverlap[] = [];
  for (const atkType of STANDARD_TYPES) {
    let count = 0;
    for (const mon of team) {
      const defTypes = speciesTypes(mon.species);
      if (defTypes.length === 0) continue;
      const mult = typeEffectiveness(atkType, defTypes);
      if (mult >= 2) count += 1;
    }
    if (count >= DEFENSIVE_OVERLAP_THRESHOLD) {
      overlaps.push({ type: atkType, count });
    }
  }
  // Sort by count desc, ties alphabetically - gives the UI a stable, useful
  // ordering without a second pass.
  overlaps.sort((a, b) => (b.count - a.count) || a.type.localeCompare(b.type));

  return { offensiveGaps, defensiveOverlaps: overlaps };
}
