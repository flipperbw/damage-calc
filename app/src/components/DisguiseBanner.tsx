import { effectiveAbility } from '@/calc/helpers';
import type { SavedMon } from '@/types';

interface Props {
  mon: SavedMon | null | undefined;
}

/**
 * Inline note rendered above a move list when the defender is a Mimikyu
 * with Disguise intact. The calc engine doesn't model Disguise's
 * damage absorption — every move row shows the actual damage that
 * would land WITHOUT Disguise blocking. This banner closes that gap by
 * spelling out the first-hit absorb so users don't double-count the
 * damage.
 *
 * Conditions for "Disguise intact":
 *   - species is Mimikyu (Mimikyu-Busted means already broken)
 *   - effective ability resolves to Disguise (after mega override)
 *   - inBattleForme isn't 'mimikyu-busted' (user hasn't flipped the toggle)
 */
export function DisguiseBanner({ mon }: Props) {
  if (!mon) return null;
  if (mon.species !== 'Mimikyu') return null;
  if (mon.inBattleForme === 'mimikyu-busted') return null;
  const ability = effectiveAbility(mon.species, mon.mega, mon.ability, mon.item);
  if (ability !== 'Disguise') return null;
  return (
    <div className="mb-1.5 px-2.5 py-1.5 rounded-lg bg-priority/10 border border-priority/30 text-[11px] text-priority leading-snug">
      <span className="font-semibold">Disguise:</span> the first damaging hit lands for 0 and breaks the Disguise (≈⅛ max HP recoil to Mimikyu). Subsequent hits deal the damage shown.
    </div>
  );
}
