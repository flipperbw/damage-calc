import { useState } from 'react';
import { Generations } from '@smogon/calc';
import { PickerShell } from './PickerShell';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (nature: string) => void;
}

const GEN = Generations.get(0);
const NATURES: { name: string; plus?: string; minus?: string }[] = (() => {
  const out: { name: string; plus?: string; minus?: string }[] = [];
  for (const n of GEN.natures) {
    out.push({ name: n.name, plus: n.plus as string | undefined, minus: n.minus as string | undefined });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
})();

export function NaturePicker({ open, onClose, onPick }: Props) {
  const [query, setQuery] = useState('');
  const filtered = !query ? NATURES : NATURES.filter(n => n.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <PickerShell open={open} onClose={onClose} title="Pick a nature">
      <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
             placeholder="Search natures"
             className="w-full bg-surface border border-surface-hi rounded-lg px-3 py-2 mb-3 text-sm" />
      <div className="overflow-y-auto flex-1 -mx-1 px-1">
        {filtered.map(n => (
          <button key={n.name} onClick={() => { onPick(n.name); onClose(); }}
                  className="w-full flex justify-between items-center px-2 py-1.5 rounded-lg hover:bg-surface text-sm">
            <span className="font-medium">{n.name}</span>
            <span className="text-[10px] opacity-60">
              {n.plus && n.minus ? `+${n.plus} / −${n.minus}` : 'neutral'}
            </span>
          </button>
        ))}
      </div>
    </PickerShell>
  );
}
