import { useMemo, useState } from 'react';
import { Generations, toID } from '@smogon/calc';
import { PickerShell } from './PickerShell';
import { TypeBadge } from '../TypeBadge';
import { getKnownMovesForSpecies } from '../../data/setdex-champions';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (moveName: string) => void;
  species?: string;
}

const GEN = Generations.get(0);

interface MoveOption {
  name: string;
  type: string;
}

function moveOption(name: string): MoveOption {
  // calc lookups must use ids ("earthquake"), not display names ("Earthquake").
  const m = GEN.moves.get(toID(name) as any);
  return { name, type: (m?.type as string) ?? '???' };
}

const ALL_MOVES: MoveOption[] = (() => {
  const out: MoveOption[] = [];
  for (const m of GEN.moves) out.push({ name: m.name, type: m.type as string });
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
})();

export function MovePicker({ open, onClose, onPick, species }: Props) {
  const [query, setQuery] = useState('');

  const common = useMemo(() => {
    if (!species) return [] as MoveOption[];
    return getKnownMovesForSpecies(species).map(moveOption);
  }, [species]);

  const filteredCommon = useMemo(() => {
    if (!query) return common;
    const q = query.toLowerCase();
    return common.filter(m => m.name.toLowerCase().includes(q));
  }, [common, query]);

  const filteredAll = useMemo(() => {
    if (!query) return ALL_MOVES;
    const q = query.toLowerCase();
    return ALL_MOVES.filter(m => m.name.toLowerCase().includes(q));
  }, [query]);

  const showCommonHeader = species && filteredCommon.length > 0;

  return (
    <PickerShell open={open} onClose={onClose} title="Pick a move">
      <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
             placeholder="Search moves"
             className="w-full bg-surface border border-surface-hi rounded-lg px-3 py-2 mb-3 text-sm" />
      <div className="overflow-y-auto flex-1 -mx-1 px-1">
        {showCommonHeader && (
          <>
            <div className="text-xxs uppercase tracking-wider opacity-50 px-2 mb-1.5">Common</div>
            {filteredCommon.map(m => (
              <Row key={`c-${m.name}`} option={m}
                   onPick={() => { onPick(m.name); onClose(); }} />
            ))}
            <div className="text-xxs uppercase tracking-wider opacity-50 px-2 mt-3 mb-1.5">All</div>
          </>
        )}
        {filteredAll.map(m => (
          <Row key={m.name} option={m}
               onPick={() => { onPick(m.name); onClose(); }} />
        ))}
      </div>
    </PickerShell>
  );
}

function Row({ option, onPick }: { option: MoveOption; onPick: () => void }) {
  return (
    <button onClick={onPick}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface">
      <TypeBadge type={option.type} />
      <span className="font-medium">{option.name}</span>
    </button>
  );
}
