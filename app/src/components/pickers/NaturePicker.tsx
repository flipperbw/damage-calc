import { useMemo, useState } from 'react';
import { Generations } from '@smogon/calc';

import { groupNatures, type NatureEntry } from '@/components/pickers/natures';
import { PickerShell } from '@/components/pickers/PickerShell';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (nature: string) => void;
}

const GEN = Generations.get(0);

const NATURES: NatureEntry[] = (() => {
  const out: NatureEntry[] = [];
  for (const n of GEN.natures) {
    out.push({ name: n.name, plus: n.plus as string | undefined, minus: n.minus as string | undefined });
  }
  return out;
})();

const GROUPED = groupNatures(NATURES);

const STAT_LABEL: Record<string, string> = {
  atk: 'Atk',
  def: 'Def',
  spa: 'SpA',
  spd: 'SpD',
  spe: 'Spe',
};

export function NaturePicker({ open, onClose, onPick }: Props) {
  const [query, setQuery] = useState('');
  const filteredGroups = useMemo(() => {
    if (!query) return GROUPED;
    const q = query.toLowerCase();
    return GROUPED.map((g) => ({
      ...g,
      entries: g.entries.filter((n) => n.name.toLowerCase().includes(q)),
    })).filter((g) => g.entries.length > 0);
  }, [query]);

  return (
    <PickerShell open={open} onClose={onClose} title="Pick a nature">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search natures"
        // text-base (16px) avoids iOS Safari/Brave's auto-zoom on focus.
        className="w-full bg-surface border border-surface-hi rounded-lg px-3 py-2 mb-3 text-base"
      />
      <div className="overflow-y-auto flex-1 -mx-1 px-1">
        {filteredGroups.map((g) => (
          <div key={g.label}>
            <div className="text-xxs uppercase tracking-wider opacity-50 px-2 mt-2 mb-1.5">{g.label}</div>
            {g.entries.map((n) => (
              <button
                key={n.name}
                onClick={() => {
                  onPick(n.name);
                  onClose();
                }}
                className="w-full flex justify-between items-center px-2 py-1.5 rounded-lg hover:bg-surface text-sm"
              >
                <span className="font-medium">{n.name}</span>
                <span className="text-[10px] opacity-60">
                  {n.plus && n.minus ? `+${STAT_LABEL[n.plus] ?? n.plus} / −${STAT_LABEL[n.minus] ?? n.minus}` : 'neutral'}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </PickerShell>
  );
}
