import { useMemo, useState } from 'react';
import { MEGA_STONES } from '@smogon/calc';

import { GEN } from '@/calc/gen';
import { PickerShell } from '@/components/pickers/PickerShell';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (itemName: string) => void;
  /**
   * When set, mega-stone filtering kicks in:
   *   - Stones compatible with this species are shown at the top under a
   *     "Mega Stones" header.
   *   - All other stones are hidden, so a Charizard never sees Garchompite.
   *   - Species without any compatible stone get NO stones in the list.
   * Without a species, all items render unfiltered.
   */
  species?: string;
}

const ALL_MEGA_STONE_NAMES: Set<string> = new Set(Object.keys(MEGA_STONES));

/** Compatible mega-stone names for a species, or [] if none. */
function compatibleMegaStones(species: string | undefined): string[] {
  if (!species) return [];
  const out: string[] = [];
  for (const stone of ALL_MEGA_STONE_NAMES) {
    const entry = (MEGA_STONES as Record<string, Record<string, string>>)[stone];
    if (entry && entry[species]) out.push(stone);
  }
  return out.sort();
}

export function ItemPicker({ open, onClose, onPick, species }: Props) {
  const [query, setQuery] = useState('');

  // Compatible-mega list for this species; cached per species. Stays empty
  // for callers that don't pass a species.
  const compatibleMega = useMemo(() => compatibleMegaStones(species), [species]);

  // The non-mega item list (sorted). When species is provided we always
  // strip every mega stone - the compatible ones, if any, render in the
  // dedicated Mega Stones section above.
  const baseItems = useMemo(() => {
    const out: string[] = [];
    for (const it of GEN.items) {
      if (species && ALL_MEGA_STONE_NAMES.has(it.name)) continue;
      out.push(it.name);
    }
    return out.sort();
  }, [species]);

  const filteredBase = useMemo(() => {
    if (!query) return baseItems;
    const q = query.toLowerCase();
    return baseItems.filter((n) => n.toLowerCase().includes(q));
  }, [baseItems, query]);

  const filteredMega = useMemo(() => {
    if (!query) return compatibleMega;
    const q = query.toLowerCase();
    return compatibleMega.filter((n) => n.toLowerCase().includes(q));
  }, [compatibleMega, query]);

  const showNoneRow = !query; // hide the "(none)" sentinel when searching

  return (
    <PickerShell
      open={open}
      onClose={onClose}
      title="Pick an item"
      search={{ value: query, onChange: setQuery, placeholder: 'Search items' }}
    >
      {showNoneRow && (
        <button
          key="(none)"
          onClick={() => {
            onPick('');
            onClose();
          }}
          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-surface text-sm"
        >
          (none)
        </button>
      )}
      {filteredMega.length > 0 && (
        <>
          <div className="text-xxs uppercase tracking-wider opacity-50 px-2 mb-1.5 mt-2">Mega Stones</div>
          {filteredMega.map((name) => (
            <button
              key={`mega-${name}`}
              onClick={() => {
                onPick(name);
                onClose();
              }}
              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-surface text-sm"
            >
              {name}
            </button>
          ))}
          <div className="text-xxs uppercase tracking-wider opacity-50 px-2 mb-1.5 mt-3">All items</div>
        </>
      )}
      {filteredBase.map((name) => (
        <button
          key={name}
          onClick={() => {
            onPick(name);
            onClose();
          }}
          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-surface text-sm"
        >
          {name}
        </button>
      ))}
    </PickerShell>
  );
}
