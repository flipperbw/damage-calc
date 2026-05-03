import { useEffect, useMemo, useState } from 'react';

import { GEN, toID } from '@/calc/gen';
import { PickerShell } from '@/components/pickers/PickerShell';
import { ALL_TYPES, type TypeName } from '@/data/poke-types';
import { spriteUrl } from '@/data/sprites';
import { useStore } from '@/store';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (species: string) => void;
  showRecents?: boolean;
}

// Mega formes are an in-battle event tied to the held mega stone, not a base
// team member, so we hide them from the picker. Matches "-Mega", "-Mega-X",
// "-Mega-Y", and ZA's "-Mega-Z" suffixes.
const MEGA_SUFFIX = /-Mega(-[XYZ])?$/;

type SortMode = 'az' | 'power' | 'bulk' | 'speed';

interface SpeciesEntry {
  name: string;
  types: readonly string[];
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

function buildAllSpecies(): SpeciesEntry[] {
  const out: SpeciesEntry[] = [];
  for (const sp of GEN.species) {
    if (MEGA_SUFFIX.test(sp.name)) continue;
    const base = (sp as any).baseStats ?? {};
    out.push({
      name: sp.name,
      types: ((sp as any).types as readonly string[] | undefined) ?? [],
      hp: (base.hp as number) ?? 0,
      atk: (base.atk as number) ?? 0,
      def: (base.def as number) ?? 0,
      spa: (base.spa as number) ?? 0,
      spd: (base.spd as number) ?? 0,
      spe: (base.spe as number) ?? 0,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

const ALL_SPECIES = buildAllSpecies();

interface FilterState {
  types: Set<TypeName>;
  sort: SortMode;
}

function emptyFilters(): FilterState {
  return { types: new Set(), sort: 'az' };
}

function filterCount(f: FilterState): number {
  let n = 0;
  if (f.types.size > 0) n += 1;
  if (f.sort !== 'az') n += 1;
  return n;
}

function applyFilters(list: SpeciesEntry[], f: FilterState): SpeciesEntry[] {
  let out = list;
  if (f.types.size > 0) {
    out = out.filter((s) => s.types.some((t) => f.types.has(t as TypeName)));
  }
  if (f.sort === 'az') {
    // Already sorted A->Z at module load; stable copy is fine.
    return out;
  }
  if (f.sort === 'power') {
    return [...out].sort((a, b) => b.atk + b.spa - (a.atk + a.spa) || a.name.localeCompare(b.name));
  }
  if (f.sort === 'bulk') {
    return [...out].sort((a, b) => b.hp + b.def + b.spd - (a.hp + a.def + a.spd) || a.name.localeCompare(b.name));
  }
  // speed
  return [...out].sort((a, b) => b.spe - a.spe || a.name.localeCompare(b.name));
}

function speciesEntry(name: string): SpeciesEntry | null {
  const sp = GEN.species.get(toID(name) as any);
  if (!sp) return null;
  const base = (sp as any).baseStats ?? {};
  return {
    name: sp.name,
    types: ((sp as any).types as readonly string[] | undefined) ?? [],
    hp: (base.hp as number) ?? 0,
    atk: (base.atk as number) ?? 0,
    def: (base.def as number) ?? 0,
    spa: (base.spa as number) ?? 0,
    spd: (base.spd as number) ?? 0,
    spe: (base.spe as number) ?? 0,
  };
}

export function SpeciesPicker({ open, onClose, onPick, showRecents = true }: Props) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>(() => emptyFilters());
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Reset transient UI state every time the picker (re)opens so a stale
  // search/filter from a prior session doesn't confuse the user.
  useEffect(() => {
    if (open) {
      setQuery('');
      setFilters(emptyFilters());
      setFiltersOpen(false);
    }
  }, [open]);

  const recents = useStore((s) => s.recentOpponents);

  const filtered = useMemo(() => {
    let base = ALL_SPECIES;
    if (query) {
      const q = query.toLowerCase();
      base = base.filter((s) => s.name.toLowerCase().includes(q));
    }
    return applyFilters(base, filters);
  }, [query, filters]);

  // Recents are stored as full mons; resolve to entries for sort/filter
  // alignment. Recents are NEVER sorted by the active sort - they're always
  // most-recent-first; the type filter still applies so the recents row makes
  // sense alongside the filtered main list.
  const recentEntries = useMemo<SpeciesEntry[]>(() => {
    if (!showRecents) return [];
    const out: SpeciesEntry[] = [];
    for (const r of recents) {
      const e = speciesEntry(r.mon.species);
      if (e) out.push(e);
    }
    if (filters.types.size > 0) {
      return out.filter((e) => e.types.some((t) => filters.types.has(t as TypeName)));
    }
    return out;
  }, [recents, showRecents, filters.types]);

  const showRecentsHeader = showRecents && !query && recentEntries.length > 0;

  function toggleType(t: TypeName) {
    setFilters((f) => {
      const next = new Set(f.types);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return { ...f, types: next };
    });
  }

  function clearFilters() {
    setFilters(emptyFilters());
  }

  const fcount = filterCount(filters);

  const filtersSlot = (
    <>
      <div className="flex items-center justify-between mt-1.5 mb-1 px-1 gap-2">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          aria-controls="species-filters-panel"
          data-testid="species-filters-toggle"
          className="text-xxs uppercase tracking-wider opacity-70 hover:opacity-100 underline underline-offset-2"
        >
          {filtersOpen ? 'Hide filters' : 'Filters'}
          {fcount > 0 && (
            <span
              data-testid="species-filters-count"
              className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[16px] px-1 rounded text-[9px] font-bold bg-accent/20 text-accent border border-accent/30"
            >
              {fcount}
            </span>
          )}
        </button>
        {fcount > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            data-testid="species-filters-clear"
            aria-label="Clear all species filters"
            className="text-xxs uppercase tracking-wider opacity-60 hover:opacity-100 underline underline-offset-2"
          >
            Clear
          </button>
        )}
      </div>

      {filtersOpen && (
        <div id="species-filters-panel" data-testid="species-filters-panel" className="mb-2 px-1 pb-2 border-t border-surface-hi pt-2 space-y-2.5">
          <div>
            <div className="text-[9px] uppercase tracking-wider opacity-50 mb-1">Type</div>
            <div className="flex flex-wrap gap-1">
              {ALL_TYPES.map((t) => {
                const active = filters.types.has(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleType(t)}
                    aria-pressed={active}
                    aria-label={`${t} type filter`}
                    data-testid={`species-filter-type-${t}`}
                    className={`text-[10px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 border ${
                      active ? 'border-accent bg-accent/20 text-accent' : 'border-surface-hi opacity-70 hover:opacity-100'
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[9px] uppercase tracking-wider opacity-50 mb-1">Sort</div>
            <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label="Sort">
              {(
                [
                  ['az', 'A→Z'],
                  ['power', 'Power'],
                  ['bulk', 'Bulk'],
                  ['speed', 'Speed'],
                ] as const
              ).map(([val, lbl]) => {
                const active = filters.sort === val;
                return (
                  <button
                    key={val}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={`Sort: ${lbl}`}
                    data-testid={`species-sort-${val}`}
                    onClick={() => setFilters((f) => ({ ...f, sort: val }))}
                    className={`text-[10px] font-bold uppercase tracking-wider rounded px-2 py-1 border ${
                      active ? 'border-accent bg-accent/20 text-accent' : 'border-surface-hi opacity-70 hover:opacity-100'
                    }`}
                  >
                    {lbl}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </>
  );

  return (
    <PickerShell
      open={open}
      onClose={onClose}
      search={{ value: query, onChange: setQuery, placeholder: 'Search Pokémon' }}
      filters={filtersSlot}
    >
      {/* mt-2 keeps the recents header from kissing the filters block. */}
      <div className="mt-2">
        {showRecentsHeader && (
          <>
            <div className="text-xxs uppercase tracking-wider opacity-50 px-2 mb-1.5">Recent</div>
            {recentEntries.map((e) => (
              <Row
                key={`r-${e.name}`}
                species={e.name}
                onPick={() => {
                  onPick(e.name);
                  onClose();
                }}
              />
            ))}
            <div className="text-xxs uppercase tracking-wider opacity-50 px-2 mt-3 mb-1.5">All</div>
          </>
        )}
        {filtered.map((e) => (
          <Row
            key={e.name}
            species={e.name}
            onPick={() => {
              onPick(e.name);
              onClose();
            }}
          />
        ))}
      </div>
    </PickerShell>
  );
}

function Row({ species, onPick }: { species: string; onPick: () => void }) {
  return (
    <button type="button" onClick={onPick} className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-surface text-left">
      <img src={spriteUrl(species)} alt="" className="w-8 h-8 rounded" />
      <span className="font-medium">{species}</span>
    </button>
  );
}
