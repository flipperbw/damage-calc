import { useEffect, useMemo, useState } from 'react';

import { GEN, toID } from '@/calc/gen';
import { PickerShell } from '@/components/pickers/PickerShell';
import { abilityDescription, getSpeciesAbilities, usePkmnReady } from '@/data/pkmn';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (ability: string) => void;
  species?: string;
}

export function AbilityPicker({ open, onClose, onPick, species }: Props) {
  const [query, setQuery] = useState('');
  // Re-run when @pkmn/data finishes loading so cold-start picker opens
  // promote from calc's single-ability entry to the full list.
  const pkmnReady = usePkmnReady();
  const all = useMemo(() => {
    if (species) {
      // Prefer @pkmn/data's full list (slot 0 / 1 / hidden) - calc's gen-0
      // species table only ships one default ability per species, so e.g.
      // Farigiraf would otherwise lose Armor Tail. Fall back to calc when
      // @pkmn/data is cold or doesn't know the species.
      const fromPkmn = getSpeciesAbilities(species);
      if (fromPkmn?.length) return fromPkmn;
      const sp = GEN.species.get(toID(species) as any);
      const arr = sp?.abilities ? (Object.values(sp.abilities).filter(Boolean) as string[]) : [];
      if (arr.length) return arr;
    }
    const all: string[] = [];
    for (const a of GEN.abilities) all.push(a.name);
    return all.sort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pkmnReady is the trigger; getSpeciesAbilities reads a sync cache that flips when it loads
  }, [species, pkmnReady]);
  const filtered = useMemo(() => {
    if (!query) return all;
    const q = query.toLowerCase();
    return all.filter((n) => n.toLowerCase().includes(q));
  }, [all, query]);

  // Lazy-loaded shortDesc cache. We only fetch once per ability name across
  // the lifetime of the picker - opening, closing, retyping the query all
  // reuse the same map.
  const [descs, setDescs] = useState<Record<string, string | null>>({});
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // Fetch only the visible (filtered) rows we don't already have. Calls
    // are cheap once @pkmn/data is warm - they're sync object lookups in
    // the wrapper - so we can fire them all in parallel.
    const missing = filtered.filter((n) => descs[n] === undefined);
    if (missing.length === 0) return;
    void Promise.all(
      missing.map(async (n) => {
        const d = await abilityDescription(n);
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
  }, [open, filtered, descs]);

  return (
    <PickerShell
      open={open}
      onClose={onClose}
      title="Pick an ability"
      search={{ value: query, onChange: setQuery, placeholder: 'Search abilities' }}
    >
      {filtered.map((name) => {
        const short = descs[name];
        return (
          <button
            key={name}
            onClick={() => {
              onPick(name);
              onClose();
            }}
            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-surface"
          >
            <div className="text-sm font-medium">{name}</div>
            {short && <div className="text-xxs opacity-60 leading-snug truncate">{short}</div>}
          </button>
        );
      })}
    </PickerShell>
  );
}
