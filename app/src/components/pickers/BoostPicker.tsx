import { useState } from 'react';

import { PickerShell } from '@/components/pickers/PickerShell';
import type { StatIDExceptHP } from '@/types';

const STATS: StatIDExceptHP[] = ['atk', 'def', 'spa', 'spd', 'spe'];
const STAT_LABELS: Record<StatIDExceptHP, string> = {
  atk: 'Atk',
  def: 'Def',
  spa: 'SpA',
  spd: 'SpD',
  spe: 'Spe',
};

interface Props {
  open: boolean;
  boosts: Partial<Record<StatIDExceptHP, number>>;
  onClose: () => void;
  onSave: (boosts: Partial<Record<StatIDExceptHP, number>>) => void;
}

export function BoostPicker({ open, boosts, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<Partial<Record<StatIDExceptHP, number>>>(boosts);

  function set(stat: StatIDExceptHP, v: number) {
    setDraft((d) => {
      const next = { ...d };
      if (v === 0) delete next[stat];
      else next[stat] = clamp(v, -6, 6);
      return next;
    });
  }

  function commit() {
    onSave(draft);
    onClose();
  }

  return (
    <PickerShell open={open} onClose={onClose} title="Stat boosts">
      <div className="flex flex-col gap-2">
        {STATS.map((stat) => {
          const v = draft[stat] ?? 0;
          return (
            <div key={stat} className="flex items-center gap-2">
              <div className="w-10 text-sm font-bold uppercase opacity-70">{STAT_LABELS[stat]}</div>
              <button
                onClick={() => set(stat, v - 1)}
                disabled={v <= -6}
                className="w-7 h-7 rounded bg-surface border border-surface-hi text-sm disabled:opacity-30"
              >
                −
              </button>
              <input
                type="range"
                min={-6}
                max={6}
                step={1}
                value={v}
                onChange={(e) => set(stat, Number(e.target.value))}
                className="flex-1"
                aria-label={`${STAT_LABELS[stat]} boost`}
              />
              <button
                onClick={() => set(stat, v + 1)}
                disabled={v >= 6}
                className="w-7 h-7 rounded bg-surface border border-surface-hi text-sm disabled:opacity-30"
              >
                +
              </button>
              <div className={`w-9 text-right tabular-nums text-sm ${v > 0 ? 'text-ok' : v < 0 ? 'text-danger' : 'opacity-50'}`}>
                {v > 0 ? `+${v}` : v}
              </div>
            </div>
          );
        })}
        <div className="flex gap-2 mt-2">
          <button onClick={() => setDraft({})} className="flex-1 py-2 rounded-lg bg-surface border border-surface-hi text-sm">
            Reset
          </button>
          <button onClick={commit} className="flex-1 py-2 rounded-lg bg-accent-gradient text-white text-sm font-bold">
            Apply
          </button>
        </div>
      </div>
    </PickerShell>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
