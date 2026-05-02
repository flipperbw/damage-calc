interface Props {
  current?: number;        // raw, undefined = full
  max: number;
  showRaw?: boolean;       // false = % only (opponent mode)
  onChange?: (newCurrent: number) => void;
}

export function HpBar({ current, max, showRaw = true, onChange }: Props) {
  const cur = current ?? max;
  const pct = Math.max(0, Math.min(100, Math.round((cur / max) * 100)));
  const fill =
    pct > 50 ? 'bg-ok'
    : pct > 20 ? 'bg-warn'
    : 'bg-danger';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-white/10 rounded overflow-hidden">
        <div className={`h-full ${fill}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs tabular-nums opacity-80 min-w-[60px] text-right">
        {showRaw ? `${cur}/${max}` : `${pct}%`}
      </div>
      {onChange && (
        <input
          type="range"
          min={0}
          max={max}
          value={cur}
          onChange={e => onChange(Number(e.target.value))}
          className="w-20"
          aria-label="HP"
        />
      )}
    </div>
  );
}
