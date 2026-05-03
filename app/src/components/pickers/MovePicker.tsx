import { useEffect, useMemo, useState } from 'react';
import { Generations, toID } from '@smogon/calc';
import { PickerShell } from './PickerShell';
import { TypeBadge } from '../TypeBadge';
import { getKnownMovesForSpecies } from '../../data/setdex-champions';
import {
  getLearnableMoveIds, priorityOverride, moveBoostsUser, moveLowersTarget, usePkmnReady,
} from '../../data/pkmn';
import { MoveDetailSheet } from '../MoveDetailSheet';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (moveName: string) => void;
  species?: string;
  /**
   * When true, the "Lowers target" stat-boost toggle defaults on - useful
   * when the user is picking moves that the opponent will use against the
   * active mon. Has no effect on the available filters; only the initial
   * state.
   */
  isForOpponent?: boolean;
}

const GEN = Generations.get(0);

interface MoveOption {
  name: string;
  type: string;
  category: 'Physical' | 'Special' | 'Status';
  bp: number;
  priority: number;
  isStatus: boolean;
  /** True iff move's `self.boosts` raises any stat. */
  boostsUser: boolean;
  /** True iff move has a secondary that lowers a target stat. */
  lowersTarget: boolean;
}

/** All Pokémon types in display order - used for the type filter chips. */
const ALL_TYPES = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
  'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
  'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
] as const;
type TypeName = (typeof ALL_TYPES)[number];

type PriorityFilter = 'any' | 'pos' | 'neg';
type SortMode = 'az' | 'bp-desc' | 'prio-desc' | 'phys' | 'spec';
type CategoryFilter = 'any' | 'physical' | 'special' | 'status';

function moveOption(name: string): MoveOption {
  const m = GEN.moves.get(toID(name) as any) as any;
  const bp = (m?.bp ?? m?.basePower ?? 0) as number;
  // Calc's gen-0 omits priority on several moves (Trick Room, Roar, …); fall
  // back to @pkmn/data when calc reports 0. Returns null until preloaded.
  const calcPrio = (m?.priority ?? 0) as number;
  const pkmnPrio = priorityOverride(name);
  const priority = calcPrio === 0 && pkmnPrio !== null ? pkmnPrio : calcPrio;
  const rawCat = m?.category as 'Physical' | 'Special' | 'Status' | undefined;
  const category: 'Physical' | 'Special' | 'Status' =
    rawCat ?? (bp === 0 ? 'Status' : 'Physical');
  const isStatus = category === 'Status' || bp === 0;
  // Boost detection lives in @pkmn/data - calc's gen-0 doesn't carry stat-
  // change info on status moves. Falls back to false until preloadPkmn()
  // resolves; the user's filter sees nothing tagged before that, which is
  // the safest default (no false negatives in the active session).
  const boostsUser = moveBoostsUser(name);
  const lowersTarget = moveLowersTarget(name);
  return {
    name,
    type: (m?.type as string) ?? '???',
    category,
    bp,
    priority,
    isStatus,
    boostsUser,
    lowersTarget,
  };
}

/**
 * Recompute every MoveOption - needed because some fields (priority,
 * boostsUser, lowersTarget) are sourced from the @pkmn/data cache which
 * loads async. Components useMemo this against `usePkmnReady()` so they
 * pick up the better values once the cache lands.
 */
function buildAllMoves(): MoveOption[] {
  const out: MoveOption[] = [];
  for (const m of GEN.moves) out.push(moveOption(m.name));
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/** Loading state for the species learnset fetch. */
type LearnsetState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; ids: Set<string> }
  | { kind: 'error' };

interface FilterState {
  types: Set<TypeName>;
  priority: PriorityFilter;
  category: CategoryFilter;
  boostsUser: boolean;
  lowersTarget: boolean;
  sort: SortMode;
}

function emptyFilters(isForOpponent: boolean | undefined): FilterState {
  return {
    types: new Set(),
    priority: 'any',
    category: 'any',
    boostsUser: false,
    lowersTarget: !!isForOpponent,
    sort: 'az',
  };
}

function activeFilterCount(f: FilterState): number {
  let n = 0;
  if (f.types.size > 0) n += 1;
  if (f.priority !== 'any') n += 1;
  if (f.category !== 'any') n += 1;
  if (f.boostsUser) n += 1;
  if (f.lowersTarget) n += 1;
  if (f.sort !== 'az') n += 1;
  return n;
}

/** Apply chip filters and sort to a list of moves. */
function applyFilters(list: MoveOption[], f: FilterState): MoveOption[] {
  let out = list;
  if (f.types.size > 0) {
    out = out.filter(m => f.types.has(m.type as TypeName));
  }
  if (f.priority === 'pos') out = out.filter(m => m.priority > 0);
  else if (f.priority === 'neg') out = out.filter(m => m.priority < 0);
  if (f.category === 'physical') out = out.filter(m => m.category === 'Physical');
  else if (f.category === 'special') out = out.filter(m => m.category === 'Special');
  else if (f.category === 'status') out = out.filter(m => m.category === 'Status');
  if (f.boostsUser) out = out.filter(m => m.boostsUser);
  if (f.lowersTarget) out = out.filter(m => m.lowersTarget);
  if (f.sort === 'bp-desc') {
    // Status / 0-bp moves last, then highest BP first; tiebreak by name.
    out = [...out].sort((a, b) => {
      const aZ = a.bp === 0 ? 1 : 0;
      const bZ = b.bp === 0 ? 1 : 0;
      if (aZ !== bZ) return aZ - bZ;
      if (a.bp !== b.bp) return b.bp - a.bp;
      return a.name.localeCompare(b.name);
    });
  } else if (f.sort === 'prio-desc') {
    out = [...out].sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.name.localeCompare(b.name);
    });
  } else if (f.sort === 'phys') {
    // Physical first (Atk-based), then Special, then Status. Ties → BP desc.
    out = [...out].sort((a, b) => catRank(a, 'phys') - catRank(b, 'phys') || b.bp - a.bp || a.name.localeCompare(b.name));
  } else if (f.sort === 'spec') {
    out = [...out].sort((a, b) => catRank(a, 'spec') - catRank(b, 'spec') || b.bp - a.bp || a.name.localeCompare(b.name));
  }
  return out;
}

function catRank(m: MoveOption, mode: 'phys' | 'spec'): number {
  const order = mode === 'phys'
    ? { Physical: 0, Special: 1, Status: 2 }
    : { Special: 0, Physical: 1, Status: 2 };
  return order[m.category];
}

export function MovePicker({ open, onClose, onPick, species, isForOpponent }: Props) {
  const pkmnReady = usePkmnReady();
  const ALL_MOVES = useMemo(buildAllMoves, [pkmnReady]);
  const [detailMove, setDetailMove] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  // "Show all moves" override - when on, the learnset filter is bypassed and
  // we show every move in the gen. Used when calc data and pkmn data
  // disagree on a move name, or for joke/illegal builds.
  const [showAll, setShowAll] = useState(false);
  // Cache learnset per species so re-opening the picker on the same mon is
  // instant. Refetch only when species changes.
  const [learnset, setLearnset] = useState<LearnsetState>({ kind: 'idle' });

  // Filter state and panel visibility - both reset on close.
  const [filters, setFilters] = useState<FilterState>(() => emptyFilters(isForOpponent));
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Reset transient UI state on close so reopening is fresh.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setShowAll(false);
      setFiltersOpen(false);
      setFilters(emptyFilters(isForOpponent));
    }
  }, [open, isForOpponent]);

  // Fetch the learnset whenever the picker opens for a (new) species.
  useEffect(() => {
    if (!open || !species) {
      setLearnset({ kind: 'idle' });
      return;
    }
    let cancelled = false;
    setLearnset({ kind: 'loading' });
    getLearnableMoveIds(species)
      .then(ids => {
        if (cancelled) return;
        // Empty set is a soft-error signal: pkmn-data didn't recognise the
        // species. Fall back to unfiltered rather than showing nothing.
        if (ids.size === 0) setLearnset({ kind: 'error' });
        else setLearnset({ kind: 'ready', ids });
      })
      .catch(() => {
        if (!cancelled) setLearnset({ kind: 'error' });
      });
    return () => { cancelled = true; };
  }, [open, species]);

  const common = useMemo(() => {
    if (!species) return [] as MoveOption[];
    return getKnownMovesForSpecies(species).map(moveOption);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pkmnReady recomputes the moveOption fields populated from @pkmn/data
  }, [species, pkmnReady]);

  const filteredCommon = useMemo(() => {
    let base = common;
    if (query) {
      const q = query.toLowerCase();
      base = base.filter(m => m.name.toLowerCase().includes(q));
    }
    return applyFilters(base, filters);
  }, [common, query, filters]);

  /**
   * The "main list" - either learnable-only or unfiltered, depending on
   * species, learnset state, and the show-all override.
   */
  const filteredMain = useMemo(() => {
    const useLearnsetFilter =
      !!species && !showAll && learnset.kind === 'ready';
    let base: MoveOption[];
    if (useLearnsetFilter) {
      const ids = (learnset as { ids: Set<string> }).ids;
      base = ALL_MOVES.filter(m => ids.has(toID(m.name) as unknown as string));
    } else {
      base = ALL_MOVES;
    }
    if (query) {
      const q = query.toLowerCase();
      base = base.filter(m => m.name.toLowerCase().includes(q));
    }
    return applyFilters(base, filters);
  }, [query, species, showAll, learnset, filters, ALL_MOVES]);

  const showCommonHeader = species && filteredCommon.length > 0;
  const mainHeader = species && !showAll && learnset.kind === 'ready'
    ? 'Learnable'
    : 'All';
  const isLoadingLearnset = !!species && !showAll && learnset.kind === 'loading';
  // Always render the main-list header when a species is set (Common may be
  // empty for non-curated mons, but the Learnable/All distinction still
  // matters and the test relies on it).
  const showMainHeader = !!species;

  const filterCount = activeFilterCount(filters);

  function toggleType(t: TypeName) {
    setFilters(f => {
      const next = new Set(f.types);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return { ...f, types: next };
    });
  }

  function clearFilters() {
    setFilters(emptyFilters(isForOpponent));
  }

  return (
    <PickerShell open={open} onClose={onClose} title="Pick a move">
      <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
             placeholder="Search moves"
             // text-base (16px) avoids iOS Safari/Brave's auto-zoom on focus.
             className="w-full bg-surface border border-surface-hi rounded-lg px-3 py-2 text-base" />

      {/* Filters toggle row. The toggle stays compact when no filters are
          active; once the user enables anything, a count badge surfaces. */}
      <div className="flex items-center justify-between mt-1.5 mb-1 px-1 gap-2">
        <button
          type="button"
          onClick={() => setFiltersOpen(v => !v)}
          aria-expanded={filtersOpen}
          aria-controls="move-filters-panel"
          data-testid="move-filters-toggle"
          className="text-xxs uppercase tracking-wider opacity-70 hover:opacity-100 underline underline-offset-2"
        >
          {filtersOpen ? 'Hide filters' : 'Filters'}
          {filterCount > 0 && (
            <span
              data-testid="move-filters-count"
              className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[16px] px-1 rounded text-[9px] font-bold bg-accent/20 text-accent border border-accent/30"
            >
              {filterCount}
            </span>
          )}
        </button>
        {filterCount > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            data-testid="move-filters-clear"
            aria-label="Clear all move filters"
            className="text-xxs uppercase tracking-wider opacity-60 hover:opacity-100 underline underline-offset-2"
          >
            Clear
          </button>
        )}
      </div>

      {filtersOpen && (
        <div
          id="move-filters-panel"
          data-testid="move-filters-panel"
          className="mb-2 px-1 pb-2 border-t border-surface-hi pt-2 space-y-2.5"
        >
          {/* Type chips */}
          <div>
            <div className="text-[9px] uppercase tracking-wider opacity-50 mb-1">Type</div>
            <div className="flex flex-wrap gap-1">
              {ALL_TYPES.map(t => {
                const active = filters.types.has(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleType(t)}
                    aria-pressed={active}
                    aria-label={`${t} type filter`}
                    data-testid={`move-filter-type-${t}`}
                    className={`text-[10px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 border ${
                      active
                        ? 'border-accent bg-accent/20 text-accent'
                        : 'border-surface-hi opacity-70 hover:opacity-100'
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category filter */}
          <div>
            <div className="text-[9px] uppercase tracking-wider opacity-50 mb-1">Category</div>
            <div className="flex gap-1" role="radiogroup" aria-label="Category filter">
              {([
                ['any', 'Any'],
                ['physical', 'Phys'],
                ['special', 'Spec'],
                ['status', 'Status'],
              ] as const).map(([val, lbl]) => {
                const active = filters.category === val;
                return (
                  <button
                    key={val}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={`${lbl} category filter`}
                    data-testid={`move-filter-cat-${val}`}
                    onClick={() => setFilters(f => ({ ...f, category: val }))}
                    className={`flex-1 text-[10px] font-bold uppercase tracking-wider rounded px-2 py-1 border ${
                      active
                        ? 'border-accent bg-accent/20 text-accent'
                        : 'border-surface-hi opacity-70 hover:opacity-100'
                    }`}
                  >
                    {lbl}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority segmented control */}
          <div>
            <div className="text-[9px] uppercase tracking-wider opacity-50 mb-1">Priority</div>
            <div className="flex gap-1" role="radiogroup" aria-label="Priority filter">
              {([
                ['any', 'Any'],
                ['pos', 'Priority+'],
                ['neg', 'Priority−'],
              ] as const).map(([val, lbl]) => {
                const active = filters.priority === val;
                return (
                  <button
                    key={val}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={`${lbl} priority filter`}
                    data-testid={`move-filter-prio-${val}`}
                    onClick={() => setFilters(f => ({ ...f, priority: val }))}
                    className={`flex-1 text-[10px] font-bold uppercase tracking-wider rounded px-2 py-1 border ${
                      active
                        ? 'border-accent bg-accent/20 text-accent'
                        : 'border-surface-hi opacity-70 hover:opacity-100'
                    }`}
                  >
                    {lbl}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stat-boost toggles - full-width grid like the priority/sort
              segments above, so the controls visually line up. */}
          <div>
            <div className="text-[9px] uppercase tracking-wider opacity-50 mb-1">Stat boost</div>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setFilters(f => ({ ...f, boostsUser: !f.boostsUser }))}
                aria-pressed={filters.boostsUser}
                aria-label="Boosts user filter"
                data-testid="move-filter-boost-user"
                className={`text-[10px] font-bold uppercase tracking-wider rounded px-2 py-1 border ${
                  filters.boostsUser
                    ? 'border-ok bg-ok/15 text-ok'
                    : 'border-surface-hi opacity-70 hover:opacity-100'
                }`}
              >
                Boosts user
              </button>
              <button
                type="button"
                onClick={() => setFilters(f => ({ ...f, lowersTarget: !f.lowersTarget }))}
                aria-pressed={filters.lowersTarget}
                aria-label="Lowers target filter"
                data-testid="move-filter-lower-target"
                className={`text-[10px] font-bold uppercase tracking-wider rounded px-2 py-1 border ${
                  filters.lowersTarget
                    ? 'border-danger bg-danger/15 text-danger'
                    : 'border-surface-hi opacity-70 hover:opacity-100'
                }`}
              >
                Lowers target
              </button>
            </div>
          </div>

          {/* Sort segmented control */}
          <div>
            <div className="text-[9px] uppercase tracking-wider opacity-50 mb-1">Sort</div>
            <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Sort">
              {([
                ['az', 'A→Z'],
                ['bp-desc', 'BP ↓'],
                ['prio-desc', 'Priority ↓'],
                ['phys', 'Phys (Atk)'],
                ['spec', 'Spec (SpA)'],
              ] as const).map(([val, lbl]) => {
                const active = filters.sort === val;
                return (
                  <button
                    key={val}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={`Sort: ${lbl}`}
                    data-testid={`move-sort-${val}`}
                    onClick={() => setFilters(f => ({ ...f, sort: val }))}
                    className={`text-[10px] font-bold uppercase tracking-wider rounded px-2 py-1 border ${
                      active
                        ? 'border-accent bg-accent/20 text-accent'
                        : 'border-surface-hi opacity-70 hover:opacity-100'
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

      {/* Show-all override - only meaningful when a species is set. Without
          a species there's no learnset filter to bypass. */}
      {species && (
        <div className="flex items-center justify-between mt-1.5 mb-3 px-1">
          <span className="text-xxs opacity-55">
            {isLoadingLearnset && 'Loading learnset…'}
            {!isLoadingLearnset && learnset.kind === 'error' && 'Learnset unavailable'}
          </span>
          <button
            type="button"
            onClick={() => setShowAll(v => !v)}
            className="text-xxs uppercase tracking-wider opacity-70 hover:opacity-100 underline underline-offset-2"
          >
            {showAll ? 'Show learnable only' : 'Show all moves'}
          </button>
        </div>
      )}
      <div className="overflow-y-auto flex-1 -mx-1 px-1">
        {showCommonHeader && (
          <>
            <div className="text-xxs uppercase tracking-wider opacity-50 px-2 mb-1.5">Common</div>
            {filteredCommon.map(m => (
              <Row key={`c-${m.name}`} option={m}
                   onPick={() => { onPick(m.name); onClose(); }}
                   onInfo={() => setDetailMove(m.name)} />
            ))}
          </>
        )}
        {showMainHeader && (
          <div className={`text-xxs uppercase tracking-wider opacity-50 px-2 mb-1.5 ${showCommonHeader ? 'mt-3' : ''}`}>
            {mainHeader}
          </div>
        )}
        {filteredMain.map(m => (
          <Row key={m.name} option={m}
               onPick={() => { onPick(m.name); onClose(); }}
               onInfo={() => setDetailMove(m.name)} />
        ))}
      </div>
      <MoveDetailSheet
        open={detailMove !== null}
        moveName={detailMove}
        onClose={() => setDetailMove(null)}
      />
    </PickerShell>
  );
}

function Row({ option, onPick, onInfo }: {
  option: MoveOption;
  onPick: () => void;
  onInfo: () => void;
}) {
  const prioLabel = option.priority === 0 ? null : (option.priority > 0 ? `+${option.priority}` : `${option.priority}`);
  const prioCls = option.priority > 0
    ? 'bg-priority/20 text-priority border-priority/40'
    : 'bg-warn/15 text-warn border-warn/40';
  const catCls =
    option.category === 'Physical' ? 'bg-danger/15 text-danger border-danger/30'
    : option.category === 'Special' ? 'bg-accent/15 text-accent border-accent/30'
    : 'bg-white/5 text-text-mute border-surface-hi';
  const catLabel = option.category === 'Physical' ? 'Phys' : option.category === 'Special' ? 'Spec' : 'Stat';
  return (
    <div className="w-full flex items-center gap-1.5 px-1 py-1 rounded-lg hover:bg-surface">
      {/* Info icon (leftmost) - opens MoveDetailSheet without picking. */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onInfo(); }}
        aria-label={`${option.name} details`}
        title={`${option.name} details`}
        data-testid={`move-row-info-${option.name}`}
        className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-white/[0.04] border border-surface-hi text-[11px] opacity-70 hover:opacity-100 hover:border-accent hover:text-accent"
      >
        i
      </button>
      <button
        type="button"
        onClick={onPick}
        data-testid={`move-row-pick-${option.name}`}
        className="flex-1 flex items-center gap-2 px-1.5 py-1 rounded text-left"
      >
        <TypeBadge type={option.type} fixedWidth />
        <span className="font-medium flex-1 text-left truncate">{option.name}</span>
        {prioLabel && (
          <span
            data-testid={`move-row-prio-${option.name}`}
            className={`text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded border ${prioCls}`}
          >
            {prioLabel}
          </span>
        )}
        {!option.isStatus && option.bp > 0 && (
          <span className="text-[10px] tabular-nums opacity-60">BP {option.bp}</span>
        )}
        <span className={`text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded border ${catCls}`}>
          {catLabel}
        </span>
      </button>
    </div>
  );
}
