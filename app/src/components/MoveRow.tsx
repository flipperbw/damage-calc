import { TypeBadge } from './TypeBadge';
import type { MoveResult } from '../calc/adapter';
import type { SavedMon } from '../types';
import { koTagFromText, priorityFlag, sturdyWarning, effectivenessBadge } from '../calc/format';

interface Props {
  result: MoveResult;
  defenderForSturdy?: SavedMon;
}

export function MoveRow({ result, defenderForSturdy }: Props) {
  const ko = koTagFromText(result.koChanceText);
  const prio = priorityFlag(result.priority);
  // If the move would OHKO but the defender has Sturdy at full HP, the actual
  // outcome is a 2HKO at best — flag this distinctly.
  const sturdyApplies =
    !result.isStatus
    && ko?.kind === 'ohko'
    && !!defenderForSturdy
    && sturdyWarning(defenderForSturdy);

  const tone =
    sturdyApplies ? 'bg-warn/12 border-warn/30'
  : ko?.kind === 'ohko' ? 'bg-danger/15 border-danger/40'
  : ko?.kind === 'thko' ? 'bg-warn/12 border-warn/30'
  : 'bg-surface border-surface-hi';

  if (!result.moveName) {
    return <div className="px-3 py-2 rounded-lg border border-dashed border-white/10 text-text-mute text-xs">— empty slot —</div>;
  }

  const koLabel = sturdyApplies ? '2HKO' : ko?.label;
  const koKind = sturdyApplies ? 'thko' : ko?.kind;

  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${tone} mb-1.5`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 font-semibold text-[12.5px]">
          <TypeBadge type={result.type} />
          <span className="truncate">{result.moveName}</span>
          {prio && <span className="text-priority text-[10px] font-bold">{prio}</span>}
          {ko && koLabel && (
            <span className={`text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded ${
              koKind === 'ohko' ? 'bg-danger text-white'
              : koKind === 'thko' ? 'bg-warn text-black'
              : 'bg-black/40 text-white'
            }`}>
              {koLabel}
            </span>
          )}
          {sturdyApplies && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-warn/30 text-warn">
              Sturdy
            </span>
          )}
          {(() => {
            const eff = effectivenessBadge(result.effectiveness, result.isStatus);
            return eff ? (
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded ${eff.cls}`}>
                {eff.label}
              </span>
            ) : null;
          })()}
        </div>
        {!result.isStatus && (
          <div className="text-[10px] opacity-50 mt-0.5">
            {result.damageRange[0]}–{result.damageRange[1]} dmg{result.koChanceText && ` · ${result.koChanceText}`}
          </div>
        )}
      </div>
      <div className="text-right">
        {result.isStatus
          ? <span className="opacity-40 text-sm">—</span>
          : <span className="font-bold tabular-nums text-[13px]">
              {result.percentRange[0]}–{result.percentRange[1]}%
            </span>}
      </div>
    </div>
  );
}
