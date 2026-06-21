import { typeEffectiveness } from '@/calc/adapter';
import { analyzeCoverage } from '@/calc/coverage';
import { GEN, toID } from '@/calc/gen';
import { TOP_POOL, type TopPoolEntry } from '@/data/top-pool';
import type { SavedMon } from '@/types';

export interface SuggestionReason {
  /** Short string for the UI: "covers Fairy", "resists Ground", "2× Garchomp". */
  text: string;
  /** Fine-grained category for color/sort hints if the UI wants them. */
  kind: 'offensive-gap' | 'defensive-overlap' | 'threat-favorable';
}

export interface Suggestion {
  species: string;
  /** STAB types from the calc. */
  types: readonly string[];
  score: number;
  reasons: SuggestionReason[];
}

const MAX_SUGGESTIONS = 8;

const SCORE_OFFENSIVE_GAP = 3;
const SCORE_DEFENSIVE_OVERLAP = 2;
const SCORE_THREAT_FAVORABLE = 1;

// "Charizard-Mega-Y" → "Charizard". Strips the trailing -Mega(-X|-Y|-Z) so
// we can compare candidate species against team entries that may carry the
// mega flag in either direction (the team has Charizard, and TopPool may
// have Charizard-Mega-Y, or vice versa).
const MEGA_SUFFIX = /-Mega(-[XYZ])?$/;
function stripMega(name: string): string {
  return name.replace(MEGA_SUFFIX, '');
}

function speciesTypes(species: string): readonly string[] {
  const sp = GEN.species.get(toID(species) as any);
  if (!sp) return [];
  return (sp.types as readonly string[] | undefined) ?? [];
}

/**
 * True iff `candidate` is already represented on the team. Match is by base
 * species (mega suffix stripped from both sides) so a team holding Charizard
 * also blocks Charizard-Mega-Y and vice versa.
 */
function isOnTeam(candidate: string, team: readonly SavedMon[]): boolean {
  const cand = stripMega(candidate).toLowerCase();
  for (const mon of team) {
    if (stripMega(mon.species).toLowerCase() === cand) return true;
  }
  return false;
}

/**
 * Score a single candidate against the team's coverage gaps, defensive
 * overlaps, and the threat list. Returns the suggestion or `null` if the
 * candidate is already on the team.
 */
function scoreCandidate(
  candidate: TopPoolEntry,
  team: readonly SavedMon[],
  threatList: readonly SavedMon[],
  offensiveGaps: readonly string[],
  defensiveOverlaps: readonly string[],
): Suggestion | null {
  if (isOnTeam(candidate.species, team)) return null;

  const reasons: SuggestionReason[] = [];
  let score = 0;

  // --- Offensive gaps the candidate's STABs close ---------------------
  for (const gap of offensiveGaps) {
    const closes = candidate.types.some((t) => typeEffectiveness(t, [gap]) >= 2);
    if (closes) {
      score += SCORE_OFFENSIVE_GAP;
      reasons.push({ kind: 'offensive-gap', text: `covers ${gap}` });
    }
  }

  // --- Defensive overlaps the candidate actively answers --------------
  // Only a genuine resist (<1×) or immunity (0×) earns a chip here. A
  // neutral (1×) matchup is no better than what most of the team already
  // has, so it neither scores nor renders - "neutral to X" is implied by
  // the absence of a chip. (An earlier version mislabeled neutral matchups
  // as "resists", e.g. Gengar "resists Ice", which was simply wrong.)
  for (const overlap of defensiveOverlaps) {
    if (candidate.types.length === 0) continue;
    const mult = typeEffectiveness(overlap, candidate.types);
    if (mult < 1) {
      score += SCORE_DEFENSIVE_OVERLAP;
      const text = mult === 0 ? `immune to ${overlap}` : `resists ${overlap}`;
      reasons.push({ kind: 'defensive-overlap', text });
    }
  }

  // --- Type-favorable matchups vs the threat list ---------------------
  // (a) Defender (candidate) is not super-effectively hit by either of the
  //     threat's STAB types - combined multiplier across both defender
  //     types must be ≤ 1 for EACH threat STAB independently. We compute
  //     it move-by-move so a 4× double-weakness on a 2nd type doesn't get
  //     averaged away.
  // (b) At least one of the candidate's STABs is ≥2× into one of the
  //     threat's defending types.
  for (const threat of threatList) {
    if (candidate.types.length === 0) continue;
    const threatTypes = speciesTypes(threat.species);
    if (threatTypes.length === 0) continue;

    const safeOnDefense = threatTypes.every((atk) => typeEffectiveness(atk, candidate.types) <= 1);
    if (!safeOnDefense) continue;

    const punishesOffense = candidate.types.some((stab) => threatTypes.some((def) => typeEffectiveness(stab, [def]) >= 2));
    if (!punishesOffense) continue;

    score += SCORE_THREAT_FAVORABLE;
    reasons.push({
      kind: 'threat-favorable',
      text: `2× ${threat.species}`,
    });
  }

  if (score === 0) return null;
  return { species: candidate.species, types: candidate.types, score, reasons };
}

/**
 * Suggest up to 8 additions to the team, ranked by a pure type-chart score
 * derived from the team's coverage gaps, shared weaknesses, and how each
 * candidate fares vs the threat list.
 *
 * `topPool` defaults to the curated `TOP_POOL`; tests can pass a smaller
 * fixture pool to make assertions deterministic without depending on the
 * shipped meta list.
 */
export function suggestAdditions(
  team: readonly SavedMon[],
  threatList: readonly SavedMon[],
  topPool: readonly TopPoolEntry[] = TOP_POOL,
): Suggestion[] {
  const { offensiveGaps, defensiveOverlaps } = analyzeCoverage(team);
  const overlapTypes = defensiveOverlaps.map((o) => o.type);

  const scored: Suggestion[] = [];
  for (const candidate of topPool) {
    const s = scoreCandidate(candidate, team, threatList, offensiveGaps, overlapTypes);
    if (s) scored.push(s);
  }

  scored.sort((a, b) => b.score - a.score || a.species.localeCompare(b.species));

  return scored.slice(0, MAX_SUGGESTIONS);
}
