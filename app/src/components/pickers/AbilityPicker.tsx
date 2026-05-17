import { useEffect, useMemo, useState } from 'react';

import { GEN, toID } from '@/calc/gen';
import { AbilityDetailSheet } from '@/components/AbilityDetailSheet';
import { PickerShell } from '@/components/pickers/PickerShell';
import { abilityDescription, getSpeciesAbilities, usePkmnReady } from '@/data/pkmn';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (ability: string) => void;
  species?: string;
  /**
   * The mon's currently-assigned ability. Always rendered in the list (and
   * the user can tap (i) to read its description) even when the species's
   * @pkmn/data ability list doesn't include it — protects against data
   * gaps (e.g. Kangaskhan's Scrappy missing from a dex entry).
   */
  currentAbility?: string;
}

export function AbilityPicker({ open, onClose, onPick, species, currentAbility }: Props) {
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
  // Splice the mon's current ability in at the top if it's missing from
  // the derived list. Guarantees the user can always see + read what they
  // already have set, even when the data source is incomplete.
  const enriched = useMemo(() => {
    if (!currentAbility) return all;
    const curId = toID(currentAbility) as unknown as string;
    if (all.some((n) => (toID(n) as unknown as string) === curId)) return all;
    return [currentAbility, ...all];
  }, [all, currentAbility]);
  const filtered = useMemo(() => {
    if (!query) return enriched;
    const q = query.toLowerCase();
    return enriched.filter((n) => n.toLowerCase().includes(q));
  }, [enriched, query]);

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

  // Detail-sheet target: tapping the (i) info icon on a row opens the full
  // ability description without committing the pick.
  const [detailName, setDetailName] = useState<string | null>(null);

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
          <div key={name} className="w-full flex items-center gap-1.5 px-1 py-1 rounded-lg hover:bg-surface">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDetailName(name);
              }}
              aria-label={`${name} details`}
              className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-white/[0.04] border border-surface-hi text-[11px] opacity-70 hover:opacity-100 hover:border-accent hover:text-accent"
            >
              i
            </button>
            <button
              type="button"
              onClick={() => {
                onPick(name);
                onClose();
              }}
              className="flex-1 min-w-0 text-left px-1 py-0.5"
            >
              <div className="text-sm font-medium">{name}</div>
              {short && <div className="text-xxs opacity-60 leading-snug truncate">{short}</div>}
            </button>
          </div>
        );
      })}
      <AbilityDetailSheet open={detailName !== null} abilityName={detailName} onClose={() => setDetailName(null)} />
    </PickerShell>
  );
}
