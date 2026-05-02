import { TypeBadge } from './TypeBadge';
import type { MoveResult } from '../calc/adapter';
import { koTagFromText, priorityFlag } from '../calc/format';

interface Props {
  result: MoveResult;
}

export function MoveRow({ result }: Props) {
  const ko = koTagFromText(result.koChanceText);
  const prio = priorityFlag(result.priority);
  const tone =
    ko?.kind === 'ohko' ? 'bg-danger/15 border-danger/40'
  : ko?.kind === 'thko' ? 'bg-warn/12 border-warn/30'
  : 'bg-surface border-surface-hi';

  if (!result.moveName) {
    return <div className="px-3 py-2 rounded-lg border border-dashed border-white/10 text-text-mute text-xs">— empty slot —</div>;
  }

  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${tone} mb-1.5`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 font-semibold text-[12.5px]">
          <TypeBadge type={result.type} />
          <span className="truncate">{result.moveName}</span>
          {prio && <span className="text-priority text-[10px] font-bold">{prio}</span>}
          {ko && <span className={`text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded ${ko.kind === 'ohko' ? 'bg-danger text-white' : ko.kind === 'thko' ? 'bg-warn text-black' : 'bg-black/40 text-white'}`}>{ko.label}</span>}
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
