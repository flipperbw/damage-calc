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
    setStat(stat, next);
  }

  function setStat(stat: StatID, next: number) {
    const out = { ...sps, [stat]: next };
    // Canonical zero-form: omit the key rather than carrying a 0. Keeps
    // exported state and equality checks clean.
    if (next === 0) delete out[stat];
    onChange(out);
  }

  // Three rendering tiers for the total readout:
  //   ok && < cap : neutral/muted (still room to allocate)
  //   ok && === cap : green (success - fully spent without overflow)
  //   !ok         : red (over cap or per-stat exceedance - Save disabled)
  // The non-ok branch already includes the `error` string; we only style.
  const totalCls =
    !v.ok ? 'text-danger'
    : v.total === SP_TOTAL_MAX ? 'text-ok'
    : 'opacity-50';

  return (
    <div>
      <div className="flex justify-between items-baseline mb-2">
        <div className="text-xxs uppercase tracking-wider opacity-55">Stat Points</div>
        <div data-testid="sp-total" className={`text-xxs ${totalCls}`}>
          {v.total} / {SP_TOTAL_MAX}{v.error ? ` · ${v.error}` : ''}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {STATS.map(s => {
          const value = sps[s.id] ?? 0;
          const pct = (value / SP_PER_STAT_MAX) * 100;
          // Three tiers so the eye can scan allocation density:
          //   max  (32)    : bright green border + glow, bold value
          //   some (1..31) : violet/accent (distinct from max - at-a-glance
          //                  read of "partial" vs "maxed")
          //   none (0)     : muted gray
          const tier =
            value === 0 ? 'none'
            : value === SP_PER_STAT_MAX ? 'max'
            : 'some';
          const cell =
            tier === 'max'
              ? 'border-ok bg-ok/15 shadow-[0_0_12px_rgba(74,222,128,0.25)]'
            : tier === 'some'
              ? 'border-accent/40 bg-accent/5'
              : 'border-surface-hi bg-surface';
          const valueCls =
            tier === 'max' ? 'font-extrabold text-lg leading-none mt-1 text-ok'
          : tier === 'some' ? 'font-extrabold text-lg leading-none mt-1 text-accent'
          : 'font-extrabold text-lg leading-none mt-1 opacity-50';
          const barFill =
            tier === 'max' ? 'bg-ok'
          : tier === 'some' ? 'bg-gradient-to-r from-accent/60 to-accent'
          : 'bg-white/10';
          return (
            <div key={s.id} className={`border rounded-lg p-2 text-center transition-colors ${cell}`}>
              <div className="text-[9px] uppercase opacity-55 tracking-wider">{s.label}</div>
              <div className={valueCls}>{value}</div>
              <div className="h-0.5 bg-white/10 rounded mt-1.5 overflow-hidden">
                <div className={`h-full ${barFill}`} style={{ width: `${pct}%` }} />
              </div>
              {/*
                Two-row controls: −/+ for fine steps, 0/MAX for jumping to
                the bounds. 36px tall is the usable floor inside a labelled
                cell; touch-action: manipulation kills iOS's 300ms
                double-tap-zoom delay so each tap fires immediately.
              */}
              <div
                className="grid grid-cols-2 gap-1 mt-1.5"
                style={{ touchAction: 'manipulation' }}
              >
                <button
                  aria-label={`${s.id} -`}
                  onClick={() => bump(s.id, -1)}
                  className="h-9 rounded bg-white/5 text-sm"
                  style={{ touchAction: 'manipulation' }}
                >−</button>
                <button
                  aria-label={`${s.id} +`}
                  onClick={() => bump(s.id, 1)}
                  className="h-9 rounded bg-white/5 text-sm"
                  style={{ touchAction: 'manipulation' }}
                >+</button>
                <button
                  aria-label={`${s.id} 0`}
                  onClick={() => setStat(s.id, 0)}
                  className="h-9 rounded bg-white/5 text-[10px] font-bold tracking-wider opacity-70"
                  style={{ touchAction: 'manipulation' }}
                >0</button>
                <button
                  aria-label={`${s.id} max`}
                  onClick={() => setStat(s.id, SP_PER_STAT_MAX)}
                  className="h-9 rounded bg-white/5 text-[10px] font-bold tracking-wider opacity-70"
                  style={{ touchAction: 'manipulation' }}
                >MAX</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
