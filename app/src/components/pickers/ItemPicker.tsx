import { useMemo, useState } from 'react';
import { Generations } from '@smogon/calc';
import { PickerShell } from './PickerShell';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (itemName: string) => void;
}

const GEN = Generations.get(0);

export function ItemPicker({ open, onClose, onPick }: Props) {
  const [query, setQuery] = useState('');
  const all = useMemo(() => {
    const out: string[] = ['(none)'];
    for (const it of GEN.items) out.push(it.name);
    return [out[0], ...out.slice(1).sort()];
  }, []);
  const filtered = useMemo(() => {
    if (!query) return all;
    const q = query.toLowerCase();
    return all.filter(n => n.toLowerCase().includes(q));
  }, [all, query]);
  return (
    <PickerShell open={open} onClose={onClose} title="Pick an item">
      <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
             placeholder="Search items"
             // text-base (16px) avoids iOS Safari/Brave's auto-zoom on focus.
             className="w-full bg-surface border border-surface-hi rounded-lg px-3 py-2 mb-3 text-base" />
      <div className="overflow-y-auto flex-1 -mx-1 px-1">
        {filtered.map(name => (
          <button key={name} onClick={() => { onPick(name === '(none)' ? '' : name); onClose(); }}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-surface text-sm">
            {name}
          </button>
        ))}
      </div>
    </PickerShell>
  );
}
