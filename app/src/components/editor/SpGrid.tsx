import type { StatID } from '../../types';
import { validateSps } from '../../store/validators';
import { SP_PER_STAT_MAX, SP_TOTAL_MAX } from '../../types';

const STATS: { id: StatID; label: string }[] = [
  { id: 'hp',  label: 'HP'  },
  { id: 'atk', label: 'Atk' },
  { id: 'def', label: 'Def' },
  { id: 'spa', label: 'SpA' },
  { id: 'spd', label: 'SpD' },
  { id: 'spe', label: 'Spe' },
];

interface Props {
  sps: Partial<Record<StatID, number>>;
  onChange: (sps: Partial<Record<StatID, number>>) => void;
}

export function SpGrid({ sps, onChange }: Props) {
  const v = validateSps(sps);

  function bump(stat: StatID, delta: number) {
    const cur = sps[stat] ?? 0;
    const next = Math.max(0, Math.min(SP_PER_STAT_MAX, cur + delta));
    const out = { ...sps, [stat]: next };
    if (next === 0) delete out[stat];
    onChange(out);
  }

  return (
    <div>
      <div className="flex justify-between items-baseline mb-2">
        <div className="text-xxs uppercase tracking-wider opacity-55">Stat Points</div>
        <div className={`text-xxs ${v.ok ? 'opacity-50' : 'text-danger'}`}>
          {v.total} / {SP_TOTAL_MAX}{v.error ? ` · ${v.error}` : ''}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {STATS.map(s => {
          const value = sps[s.id] ?? 0;
          const pct = (value / SP_PER_STAT_MAX) * 100;
          return (
            <div key={s.id} className={`bg-surface border border-surface-hi rounded-lg p-2 text-center ${value > 0 ? 'border-ok/30 bg-ok/5' : ''}`}>
              <div className="text-[9px] uppercase opacity-55 tracking-wider">{s.label}</div>
              <div className="font-extrabold text-lg leading-none mt-1">{value}</div>
              <div className="h-0.5 bg-white/10 rounded mt-1.5 overflow-hidden">
                <div className="h-full bg-accent-gradient" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex gap-1 mt-1.5 justify-center">
                <button aria-label={`${s.id} -`} onClick={() => bump(s.id, -1)}
                        className="w-6 h-6 rounded bg-white/5 text-sm">−</button>
                <button aria-label={`${s.id} +`} onClick={() => bump(s.id, 1)}
                        className="w-6 h-6 rounded bg-white/5 text-sm">+</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
