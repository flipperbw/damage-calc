import { useEffect, useMemo, useState } from 'react';
import { MEGA_STONES } from '@smogon/calc';

import { GEN } from '@/calc/gen';
import { NoneRow } from '@/components/pickers/NoneRow';
import { PickerShell } from '@/components/pickers/PickerShell';
import { itemDescription } from '@/data/pkmn';

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

  // Lazy short-desc cache for the visible rows. Mirrors AbilityPicker's
  // pattern: fetch only what the filter currently shows, reuse hits across
  // re-queries.
  const [descs, setDescs] = useState<Record<string, string | null>>({});
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const visible = [...filteredMega, ...filteredBase];
    const missing = visible.filter((n) => descs[n] === undefined);
    if (missing.length === 0) return;
    void Promise.all(
      missing.map(async (n) => {
        const d = await itemDescription(n);
        return [n, d.short ?? null] as const;
      }),
    ).then((pairs) => {
      if (cancelled) return;
      setDescs((prev) => {
        const next = { ...prev };
        for (const [n, s] of pairs) next[n] = s;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [open, filteredMega, filteredBase, descs]);

  return (
    <PickerShell
      open={open}
      onClose={onClose}
      title="Pick an item"
      search={{ value: query, onChange: setQuery, placeholder: 'Search items' }}
    >
      {showNoneRow && (
        <NoneRow
          label="No item"
          hint="no held item"
          testId="item-row-pick-none"
          onSelect={() => {
            onPick('');
            onClose();
          }}
        />
      )}
      {filteredMega.length > 0 && (
        <>
          <div className="text-xxs uppercase tracking-wider opacity-50 px-2 mb-1.5 mt-2">Mega Stones</div>
          {filteredMega.map((name) => (
            <ItemRow key={`mega-${name}`} name={name} short={descs[name]} onPick={() => { onPick(name); onClose(); }} />
          ))}
          <div className="text-xxs uppercase tracking-wider opacity-50 px-2 mb-1.5 mt-3">All items</div>
        </>
      )}
      {filteredBase.map((name) => (
        <ItemRow key={name} name={name} short={descs[name]} onPick={() => { onPick(name); onClose(); }} />
      ))}
    </PickerShell>
  );
}

function ItemRow({ name, short, onPick }: { name: string; short: string | null | undefined; onPick: () => void }) {
  return (
    <button onClick={onPick} data-picker-option className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-surface">
      <div className="text-sm font-medium">{name}</div>
      {short && <div className="text-xxs opacity-60 leading-snug truncate">{short}</div>}
    </button>
  );
}
