import { useState } from 'react';

import type { MoveResult } from '@/calc/adapter';
import { effectivenessBadge, koTagFromText, priorityFlag, sturdyWarning } from '@/calc/format';
import { MoveDetailSheet } from '@/components/MoveDetailSheet';
import { TypeBadge } from '@/components/TypeBadge';
import type { SavedMon } from '@/types';

interface Props {
  result: MoveResult;
  defenderForSturdy?: SavedMon;
}

export function MoveRow({ result, defenderForSturdy }: Props) {
  const [showDetail, setShowDetail] = useState(false);
  const ko = koTagFromText(result.koChanceText);
  const prio = priorityFlag(result.priority);
  // If the move would OHKO but the defender has Sturdy at full HP, the actual
  // outcome is a 2HKO at best - flag this distinctly.
  const sturdyApplies = !result.isStatus && ko?.kind === 'ohko' && !!defenderForSturdy && sturdyWarning(defenderForSturdy);

  const tone = sturdyApplies
    ? 'bg-warn/12 border-warn/30'
    : ko?.kind === 'ohko'
      ? 'bg-danger/15 border-danger/40'
      : ko?.kind === 'thko'
        ? 'bg-warn/12 border-warn/30'
        : 'bg-surface border-surface-hi';

  if (!result.moveName) {
    return <div className="px-3 py-2 rounded-lg border border-dashed border-white/10 text-text-mute text-xs">- empty slot -</div>;
  }

  const koLabel = sturdyApplies ? '2HKO' : ko?.label;
  const koKind = sturdyApplies ? 'thko' : ko?.kind;

  const eff = effectivenessBadge(result.effectiveness, result.isStatus);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowDetail(true)}
        aria-label={`${result.moveName} details`}
        data-testid={`move-row-${result.moveName}`}
        style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'rgba(124,92,255,0.15)' }}
        className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg border ${tone} mb-1.5 select-none cursor-pointer`}
      >
        {/* Fixed-width type badge so move names line up vertically across
            rows regardless of type-name length. */}
        <TypeBadge type={result.type} fixedWidth />
        <span className="font-semibold text-[12.5px] truncate flex-1">{result.moveName}</span>
        {/* Priority flag - tied to move identity, kept next to the name. */}
        {prio && <span className="text-priority text-[10px] font-bold shrink-0">{prio}</span>}
        {/* Right cluster: badges centered next to the % readout. */}
        <div className="flex items-center gap-1 shrink-0">
          {eff && <span className={`text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded ${eff.cls}`}>{eff.label}</span>}
          {ko && koLabel && (
            <span
              className={`text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded ${
                koKind === 'ohko' ? 'bg-danger text-white' : koKind === 'thko' ? 'bg-warn text-black' : 'bg-black/40 text-white'
              }`}
            >
              {koLabel}
            </span>
          )}
          {sturdyApplies && <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-warn/30 text-warn">Sturdy</span>}
          {result.isStatus ? (
            <span className="opacity-40 text-sm">-</span>
          ) : (
            <span className="font-bold tabular-nums text-[13px] min-w-[60px] text-right">
              {result.percentRange[0]}–{result.percentRange[1]}%
            </span>
          )}
        </div>
      </button>
      <MoveDetailSheet open={showDetail} moveName={result.moveName} result={result} onClose={() => setShowDetail(false)} />
    </>
  );
}
