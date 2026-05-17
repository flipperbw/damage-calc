import { calculateMatchup } from '@/calc/adapter';
import type { Suggestion, SuggestionReason } from '@/calc/suggestions';
import { TOP_POOL } from '@/data/top-pool';
import { defaultTeamMon } from '@/store/factories';
import type { FieldState, SavedMon } from '@/types';

/**
 * Calc-based counter scoring for the "Focus on:" mode of SuggestionsSection.
 * Unlike the multi-threat type-chart scorer (which gates strictly on
 * resists-all + punishes-with-STAB), this path:
 *
 *   - Builds each candidate from its first curated build via
 *     `defaultTeamMon`, so the calc sees real items / abilities / SPs /
 *     moves rather than abstract types.
 *   - Runs an actual `calculateMatchup` against the focus threat.
 *   - Scores by `best damage out% - best damage taken%` so partial
 *     counters (defensive walls that don't OHKO back; glass cannons
 *     that nuke before being nuked) still surface, ranked appropriately.
 *
 * Compute: ~73 candidates × ~4 moves × 2 sides = ~600 move calcs per
 * call. Runs synchronously in well under a second for most teams; if
 * this ever creeps up the call site should memoise per (threat id,
 * threat updatedAt, field).
 */
export function suggestCountersTo(threat: SavedMon, field: FieldState, format: 'singles' | 'doubles' = 'singles', maxResults = 8): Suggestion[] {
  const out: Suggestion[] = [];
  for (const entry of TOP_POOL) {
    // Skip "counter yourself" entries.
    if (entry.species === threat.species) continue;
    let candidate: SavedMon;
    try {
      candidate = defaultTeamMon(entry.species);
    } catch {
      continue;
    }
    // Skip species with no moves on their first curated build — calc
    // returns 0 across the board and they'd score artificially well
    // for "takes nothing." Use a quick filter on moves[0].
    if (!candidate.moves[0]) continue;

    let matchup: ReturnType<typeof calculateMatchup>;
    try {
      matchup = calculateMatchup(candidate, threat, field, format);
    } catch {
      continue;
    }

    let bestOut = 0;
    let bestOutMove = '';
    for (const m of matchup.attackerMoves) {
      if (!m.moveName || m.isStatus || m.isImmune) continue;
      if (m.percentRange[1] > bestOut) {
        bestOut = m.percentRange[1];
        bestOutMove = m.moveName;
      }
    }
    let bestIn = 0;
    let bestInMove = '';
    let anyDamagingFromThreat = false;
    for (const m of matchup.defenderMoves) {
      if (!m.moveName || m.isStatus) continue;
      if (!m.isImmune) anyDamagingFromThreat = true;
      if (m.percentRange[1] > bestIn) {
        bestIn = m.percentRange[1];
        bestInMove = m.moveName;
      }
    }

    const score = bestOut - bestIn;

    // Filter out candidates that are clearly *worse* in the matchup
    // (take far more than they give). -50% is a generous threshold to
    // keep partial wins visible.
    if (bestOut === 0 || score < -50) continue;

    const reasons: SuggestionReason[] = [];
    if (bestOut >= 100) {
      reasons.push({ kind: 'threat-favorable', text: `OHKO via ${bestOutMove}` });
    } else if (bestOut >= 50) {
      reasons.push({ kind: 'threat-favorable', text: `2HKO via ${bestOutMove} (${bestOut}%)` });
    } else {
      reasons.push({ kind: 'threat-favorable', text: `${bestOut}% via ${bestOutMove}` });
    }

    if (!anyDamagingFromThreat) {
      reasons.push({ kind: 'defensive-overlap', text: 'Immune to all damaging moves' });
    } else if (bestIn === 0) {
      reasons.push({ kind: 'defensive-overlap', text: 'Takes 0% from best move' });
    } else if (bestIn <= 30) {
      reasons.push({ kind: 'defensive-overlap', text: `Takes ≤${bestIn}% max` });
    } else if (bestIn < 50) {
      reasons.push({ kind: 'defensive-overlap', text: `Takes ${bestIn}% from ${bestInMove}` });
    }
    // No "good defensive" badge when bestIn >= 50 — the negative shows
    // up in the score and the row will sort below safer options.

    if (matchup.speed.attackerOutspeeds) {
      reasons.push({ kind: 'offensive-gap', text: 'Outspeeds' });
    }

    out.push({ species: entry.species, types: [...entry.types], score, reasons });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, maxResults);
}
