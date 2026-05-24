import { toID } from '@/calc/gen';
import type { FieldState, SavedMon } from '@/types';

export type Tempo = 'normal' | 'trick-room';

/**
 * Heuristic tempo classifier. A team plays "trick-room" tempo (slow
 * outspeeds, bulk over speed control) when any of:
 *
 *   1. A drafted mon has Trick Room in its movepool — the strongest
 *      signal that the user designed the team around TR.
 *   2. The live field has Trick Room toggled on — they're actively
 *      calculating under TR right now, so suggestions should follow.
 *
 * Everything else is "normal" tempo. We deliberately do NOT infer TR
 * from pinned field keys (pinning just creates a quick-toggle button;
 * it isn't a statement of intent) nor from low base speeds (catches
 * too many balance / wallbreaker false positives).
 */
const TRICK_ROOM_ID = toID('Trick Room') as unknown as string;

export function inferTeamTempo(team: { mons: readonly SavedMon[] }, field: FieldState): Tempo {
  if (field.isTrickRoom) return 'trick-room';
  for (const mon of team.mons) {
    for (const m of mon.moves) {
      if (!m) continue;
      if ((toID(m) as unknown as string) === TRICK_ROOM_ID) return 'trick-room';
    }
  }
  return 'normal';
}
