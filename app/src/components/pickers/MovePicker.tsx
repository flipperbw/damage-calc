import { useMemo, useState } from 'react';
import { Generations } from '@smogon/calc';
import { PickerShell } from './PickerShell';
import { TypeBadge } from '../TypeBadge';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (moveName: string) => void;
}

const GEN = Generations.get(0);

export function MovePicker({ open, onClose, onPick }: Props) {
  const [query, setQuery] = useState('');
  const all = useMemo(() => {
    const out: { name: string; type: string }[] = [];
    for (const m of GEN.moves) out.push({ name: m.name, type: m.type });
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }, []);
  const filtered = useMemo(() => {
    if (!query) return all;
    const q = query.toLowerCase();
    return all.filter(m => m.name.toLowerCase().includes(q));
  }, [all, query]);

  return (
    <PickerShell open={open} onClose={onClose} title="Pick a move">
      <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
             placeholder="Search moves"
             className="w-full bg-surface border border-surface-hi rounded-lg px-3 py-2 mb-3 text-sm" />
      <div className="overflow-y-auto flex-1 -mx-1 px-1">
        {filtered.map(m => (
          <button key={m.name} onClick={() => { onPick(m.name); onClose(); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface">
            <TypeBadge type={m.type} />
            <span className="font-medium">{m.name}</span>
          </button>
        ))}
      </div>
    </PickerShell>
  );
}
