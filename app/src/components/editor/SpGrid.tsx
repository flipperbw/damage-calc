import { useEffect, useRef, useState } from 'react';

import { validateSps } from '@/store/validators';
import { SP_PER_STAT_MAX, SP_TOTAL_MAX, STAT_LABEL, STAT_ORDER, type StatID } from '@/types';

interface Props {
  sps: Partial<Record<StatID, number>>;
  onChange: (sps: Partial<Record<StatID, number>>) => void;
}

export function SpGrid({ sps, onChange }: Props) {
  const v = validateSps(sps);
  const remaining = Math.max(0, SP_TOTAL_MAX - v.total);

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

  // Commit a typed value. Clamped to per-stat [0..32], and further clamped
  // so the resulting total never exceeds the cap (SP_TOTAL_MAX). The ones
  // already allocated to OTHER stats fix the remaining headroom for the
  // edited stat.
  function commitTyped(stat: StatID, raw: string) {
    const parsed = Number.parseInt(raw, 10);
    const value = Number.isFinite(parsed) ? parsed : 0;
    const clamped = Math.max(0, Math.min(SP_PER_STAT_MAX, value));
    const otherTotal = Object.entries(sps).reduce(
      (acc, [k, val]) => (k === stat ? acc : acc + (val ?? 0)),
      0,
    );
    const headroom = Math.max(0, SP_TOTAL_MAX - otherTotal);
    const next = Math.min(clamped, headroom);
    setStat(stat, next);
  }

  // Three rendering tiers for the total readout:
  //   ok && < cap : neutral/muted (still room to allocate)
  //   ok && === cap : green (success - fully spent without overflow)
  //   !ok         : red (over cap or per-stat exceedance - Save disabled)
  // The non-ok branch already includes the `error` string; we only style.
  const totalCls = !v.ok ? 'text-danger' : v.total === SP_TOTAL_MAX ? 'text-ok' : 'opacity-50';
  const remainingCls = remaining === 0 ? 'text-warn' : 'opacity-55';

  return (
    <div>
      <div className="flex justify-between items-baseline mb-2 gap-2 flex-wrap">
        <div className="text-xxs uppercase tracking-wider opacity-55">Stat Points</div>
        <div className="flex items-baseline gap-2">
          <span data-testid="sp-remaining" className={`text-xxs ${remainingCls}`}>
            {remaining} left
          </span>
          <span data-testid="sp-total" className={`text-xxs ${totalCls}`}>
            {v.total} / {SP_TOTAL_MAX}
            {v.error ? ` · ${v.error}` : ''}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {STAT_ORDER.map((id) => {
          const value = sps[id] ?? 0;
          const pct = (value / SP_PER_STAT_MAX) * 100;
          // Three tiers so the eye can scan allocation density:
          //   max  (32)    : bright green border + glow, bold value
          //   some (1..31) : violet/accent (distinct from max - at-a-glance
          //                  read of "partial" vs "maxed")
          //   none (0)     : muted gray
          const tier = value === 0 ? 'none' : value === SP_PER_STAT_MAX ? 'max' : 'some';
          const cell =
            tier === 'max'
              ? 'border-ok bg-ok/15 shadow-[0_0_12px_rgba(74,222,128,0.25)]'
              : tier === 'some'
                ? 'border-accent/40 bg-accent/5'
                : 'border-surface-hi bg-surface';
          const valueCls =
            tier === 'max'
              ? 'font-extrabold text-lg leading-none mt-1 text-ok'
              : tier === 'some'
                ? 'font-extrabold text-lg leading-none mt-1 text-accent'
                : 'font-extrabold text-lg leading-none mt-1 opacity-50';
          const barFill = tier === 'max' ? 'bg-ok' : tier === 'some' ? 'bg-gradient-to-r from-accent/60 to-accent' : 'bg-white/10';
          return (
            <div key={id} className={`border rounded-lg p-2 text-center transition-colors ${cell}`}>
              <div className="text-[9px] uppercase opacity-55 tracking-wider">{STAT_LABEL[id]}</div>
              <SpValueInput stat={id} value={value} valueCls={valueCls} onCommit={(raw) => commitTyped(id, raw)} />
              <div className="h-0.5 bg-white/10 rounded mt-1.5 overflow-hidden">
                <div className={`h-full ${barFill}`} style={{ width: `${pct}%` }} />
              </div>
              {/*
                Two-row controls: −/+ for fine steps, 0/MAX for jumping to
                the bounds. 36px tall is the usable floor inside a labelled
                cell; touch-action: manipulation kills iOS's 300ms
                double-tap-zoom delay so each tap fires immediately.
              */}
              <div className="grid grid-cols-2 gap-1 mt-1.5" style={{ touchAction: 'manipulation' }}>
                <button
                  aria-label={`${id} -`}
                  onClick={() => bump(id, -1)}
                  className="h-9 rounded bg-white/5 text-sm transition-colors hover:bg-white/10"
                  style={{ touchAction: 'manipulation' }}
                >
                  −
                </button>
                <button
                  aria-label={`${id} +`}
                  onClick={() => bump(id, 1)}
                  className="h-9 rounded bg-white/5 text-sm transition-colors hover:bg-white/10"
                  style={{ touchAction: 'manipulation' }}
                >
                  +
                </button>
                <button
                  aria-label={`${id} 0`}
                  onClick={() => setStat(id, 0)}
                  className="h-9 rounded bg-white/5 text-[10px] font-bold tracking-wider opacity-70 transition hover:opacity-100 hover:bg-white/10"
                  style={{ touchAction: 'manipulation' }}
                >
                  0
                </button>
                <button
                  aria-label={`${id} max`}
                  onClick={() => setStat(id, SP_PER_STAT_MAX)}
                  className="h-9 rounded bg-white/5 text-[10px] font-bold tracking-wider opacity-70 transition hover:opacity-100 hover:bg-white/10"
                  style={{ touchAction: 'manipulation' }}
                >
                  MAX
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface SpValueInputProps {
  stat: StatID;
  value: number;
  valueCls: string;
  onCommit: (raw: string) => void;
}

/**
 * Tap-to-edit value cell. Renders the static value display by default; on
 * tap it swaps to a numeric input that commits on blur or Enter. Using a
 * separate component lets each stat manage its own draft string state without
 * the parent re-rendering at every keystroke.
 */
function SpValueInput({ stat, value, valueCls, onCommit }: SpValueInputProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync draft to incoming prop whenever we're not actively editing - lets
  // bump/MAX/0 buttons update the displayed number without fighting the
  // input's local state.
  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  // Auto-focus + select-all the moment the input mounts so the user can
  // overwrite the existing value with a single typed digit.
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function commit() {
    onCommit(draft);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        inputMode="numeric"
        min={0}
        max={SP_PER_STAT_MAX}
        aria-label={`${stat} value`}
        data-testid={`sp-input-${stat}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setDraft(String(value));
            setEditing(false);
          }
        }}
        // 16px text size avoids iOS Safari/Brave's auto-zoom on focus.
        className={`${valueCls} w-full bg-transparent text-center outline-none border border-accent/40 rounded`}
        style={{ fontSize: 16 }}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={`Edit ${stat} value`}
      data-testid={`sp-value-${stat}`}
      className={`${valueCls} w-full bg-transparent rounded cursor-pointer transition-colors hover:bg-white/[0.06]`}
      style={{ touchAction: 'manipulation' }}
    >
      {value}
    </button>
  );
}
