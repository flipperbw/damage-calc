import { useMemo, useState } from 'react';
import { Generations } from '@smogon/calc';
import { useStore } from '../../store';
import { spriteUrl } from '../../data/sprites';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (species: string) => void;
  showRecents?: boolean;
}

const GEN = Generations.get(0);

function allSpeciesNames(): string[] {
  const names: string[] = [];
  for (const sp of GEN.species) names.push(sp.name);
  return names.sort();
}

export function SpeciesPicker({ open, onClose, onPick, showRecents = true }: Props) {
  const [query, setQuery] = useState('');
  const recents = useStore(s => s.recentOpponents);
  const all = useMemo(() => allSpeciesNames(), []);
  const filtered = useMemo(() => {
    if (!query) return all;
    const q = query.toLowerCase();
    return all.filter(n => n.toLowerCase().includes(q));
  }, [all, query]);

  if (!open) return null;

  const showRecentsHeader = showRecents && !query && recents.length > 0;

  return (
    <div className="fixed inset-0 z-30 bg-black/60 flex items-end md:items-center justify-center p-3.5"
         onClick={onClose}>
      <div className="w-full max-w-md bg-bg-base bg-panel-gradient border border-surface-hi rounded-card p-3.5 max-h-[80vh] flex flex-col"
           onClick={e => e.stopPropagation()}>
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search Pokémon"
          className="w-full bg-surface border border-surface-hi rounded-lg px-3 py-2 mb-3 text-sm"
        />
        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {showRecentsHeader && (
            <>
              <div className="text-xxs uppercase tracking-wider opacity-50 px-2 mb-1.5">Recent</div>
              {recents.map(r => (
                <Row key={r.id} species={r.mon.species}
                     onPick={() => { onPick(r.mon.species); onClose(); }} />
              ))}
              <div className="text-xxs uppercase tracking-wider opacity-50 px-2 mt-3 mb-1.5">All</div>
            </>
          )}
          {filtered.map(name => (
            <Row key={name} species={name}
                 onPick={() => { onPick(name); onClose(); }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ species, onPick }: { species: string; onPick: () => void }) {
  return (
    <button type="button" onClick={onPick}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-surface text-left">
      <img src={spriteUrl(species)} alt="" className="w-8 h-8 rounded" />
      <span className="font-medium">{species}</span>
    </button>
  );
}
