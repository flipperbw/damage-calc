import { useMemo, useState } from 'react';

import { GEN } from '@/calc/gen';
import { groupNatures, type NatureEntry } from '@/components/pickers/natures';
import { PickerShell } from '@/components/pickers/PickerShell';
import { STAT_LABEL, type StatID } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (nature: string) => void;
}

const NATURES: NatureEntry[] = (() => {
  const out: NatureEntry[] = [];
  for (const n of GEN.natures) {
    out.push({ name: n.name, plus: n.plus as string | undefined, minus: n.minus as string | undefined });
  }
  return out;
})();

const GROUPED = groupNatures(NATURES);

function statLabel(s: string): string {
  return STAT_LABEL[s as StatID] ?? s;
}

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
    <PickerShell
      open={open}
      onClose={onClose}
      title="Pick a nature"
      search={{ value: query, onChange: setQuery, placeholder: 'Search natures' }}
    >
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
                {n.plus && n.minus ? `+${statLabel(n.plus)} / −${statLabel(n.minus)}` : 'neutral'}
              </span>
            </button>
          ))}
        </div>
      ))}
    </PickerShell>
  );
}
