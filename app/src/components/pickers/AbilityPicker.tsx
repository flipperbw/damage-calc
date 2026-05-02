import { useMemo, useState } from 'react';
import { Generations, toID } from '@smogon/calc';
import { PickerShell } from './PickerShell';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (ability: string) => void;
  species?: string;
}

const GEN = Generations.get(0);

export function AbilityPicker({ open, onClose, onPick, species }: Props) {
  const [query, setQuery] = useState('');
  const all = useMemo(() => {
    // Prefer species-scoped abilities; fall back to all. calc looks up by id,
    // not display name, so toID() is required.
    if (species) {
      const sp = GEN.species.get(toID(species) as any);
      const arr = sp?.abilities ? Object.values(sp.abilities).filter(Boolean) as string[] : [];
      if (arr.length) return arr;
    }
    const all: string[] = [];
    for (const a of GEN.abilities) all.push(a.name);
    return all.sort();
  }, [species]);
  const filtered = useMemo(() => {
    if (!query) return all;
    const q = query.toLowerCase();
    return all.filter(n => n.toLowerCase().includes(q));
  }, [all, query]);
  return (
    <PickerShell open={open} onClose={onClose} title="Pick an ability">
      <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
             placeholder="Search abilities"
             // text-base (16px) avoids iOS Safari/Brave's auto-zoom on focus.
             className="w-full bg-surface border border-surface-hi rounded-lg px-3 py-2 mb-3 text-base" />
      <div className="overflow-y-auto flex-1 -mx-1 px-1">
        {filtered.map(name => (
          <button key={name} onClick={() => { onPick(name); onClose(); }}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-surface text-sm">
            {name}
          </button>
        ))}
      </div>
    </PickerShell>
  );
}
