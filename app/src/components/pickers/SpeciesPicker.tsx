import { useEffect, useMemo, useState } from 'react';
import { Generations } from '@smogon/calc';
import { useStore } from '../../store';
import { spriteUrl } from '../../data/sprites';
import { PickerShell } from './PickerShell';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (species: string) => void;
  showRecents?: boolean;
}

const GEN = Generations.get(0);

// Mega formes are an in-battle event tied to the held mega stone, not a base
// team member, so we hide them from the picker. Matches "-Mega", "-Mega-X",
// "-Mega-Y", and ZA's "-Mega-Z" suffixes.
const MEGA_SUFFIX = /-Mega(-[XYZ])?$/;

function allSpeciesNames(): string[] {
  const names: string[] = [];
  for (const sp of GEN.species) {
    if (MEGA_SUFFIX.test(sp.name)) continue;
    names.push(sp.name);
  }
  return names.sort();
}

export function SpeciesPicker({ open, onClose, onPick, showRecents = true }: Props) {
  const [query, setQuery] = useState('');
  // Reset the search box every time the picker (re)opens — stale queries
  // confuse the user when they reopen expecting a fresh list.
  useEffect(() => {
    if (open) setQuery('');
  }, [open]);
  const recents = useStore(s => s.recentOpponents);
  const all = useMemo(() => allSpeciesNames(), []);
  const filtered = useMemo(() => {
    if (!query) return all;
    const q = query.toLowerCase();
    return all.filter(n => n.toLowerCase().includes(q));
  }, [all, query]);

  const showRecentsHeader = showRecents && !query && recents.length > 0;

  return (
    <PickerShell open={open} onClose={onClose}>
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
    </PickerShell>
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
