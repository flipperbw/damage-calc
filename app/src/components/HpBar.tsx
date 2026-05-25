interface Props {
  current?: number; // raw, undefined = full
  max: number;
  onChange?: (newCurrent: number | undefined) => void;
}

/**
 * Single HP gauge that doubles as a slider. The visible bar with its
 * gradient fill is the read-out; a native `<input type="range">` is
 * stacked directly on top of it with a transparent track but a visible
 * circular thumb riding along the gauge.
 *
 * Writes live on every change so damage rolls / kill calcs in the
 * surrounding card update as the user drags — no draft buffer.
 *
 * The thumb's ring color is driven by --hp-color (set inline on the
 * track wrapper) so the ring shifts ok → warn → danger in lockstep
 * with the gradient fill. Thumb base styling lives in globals.css
 * under `.hp-slider`.
 */

const COLORS = {
  ok: { bar: 'bg-ok', ring: 'var(--color-ok)' },
  warn: { bar: 'bg-warn', ring: 'var(--color-warn)' },
  danger: { bar: 'bg-danger', ring: 'var(--color-danger)' },
} as const;

export function HpBar({ current, max, onChange }: Props) {
  const cur = current ?? max;
  const pct = Math.max(0, Math.min(100, Math.round((cur / max) * 100)));
  const tier = pct > 50 ? 'ok' : pct > 20 ? 'warn' : 'danger';
  const { bar: fill, ring } = COLORS[tier];
  const editable = !!onChange;

  function emit(raw: number) {
    if (!onChange) return;
    // Stay in the "undefined = full" canonical form when at max so the
    // model doesn't drift between {currentHp: undefined} and {currentHp: max}.
    onChange(raw >= max ? undefined : raw);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider opacity-55 font-semibold tabular-nums shrink-0 min-w-[60px]">
        HP {cur}/{max}
      </span>
      <div
        className="relative flex-1 h-2.5 rounded-full bg-white/10"
        // CSS var picked up by .hp-slider's ::-*-range-thumb in globals.css.
        // Drives the thumb-ring color so it tracks the gauge color tier.
        style={{ ['--hp-color' as string]: ring }}
      >
        <div className={`absolute inset-y-0 left-0 rounded-full ${fill}`} style={{ width: `${pct}%` }} />
        {editable && (
          <input
            type="range"
            // Floor at 1 HP rather than 0: a calc tool models damage taken,
            // not death state. Pinning the minimum at 1 also keeps the
            // gauge visually non-empty so the thumb stays grabbable at the
            // far-left end without the bar collapsing to invisible.
            min={1}
            max={max}
            value={Math.max(1, cur)}
            onChange={(e) => emit(Number(e.target.value))}
            className="hp-slider absolute inset-0 w-full h-full cursor-pointer"
            aria-label="HP"
          />
        )}
      </div>
      <span className="text-xs tabular-nums opacity-80 min-w-[36px] text-right shrink-0">{pct}%</span>
    </div>
  );
}
