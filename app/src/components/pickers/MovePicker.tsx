import { useEffect, useMemo, useState } from 'react';
import { Generations, toID } from '@smogon/calc';
import { PickerShell } from './PickerShell';
import { TypeBadge } from '../TypeBadge';
import { getKnownMovesForSpecies } from '../../data/setdex-champions';
import { getLearnableMoveIds } from '../../data/pkmn';

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

/** Loading state for the species learnset fetch. */
type LearnsetState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; ids: Set<string> }
  | { kind: 'error' };

export function MovePicker({ open, onClose, onPick, species }: Props) {
  const [query, setQuery] = useState('');
  // "Show all moves" override — when on, the learnset filter is bypassed and
  // we show every move in the gen. Used when calc data and pkmn data
  // disagree on a move name, or for joke/illegal builds.
  const [showAll, setShowAll] = useState(false);
  // Cache learnset per species so re-opening the picker on the same mon is
  // instant. Refetch only when species changes.
  const [learnset, setLearnset] = useState<LearnsetState>({ kind: 'idle' });

  // Reset transient UI state on close so reopening is fresh.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setShowAll(false);
    }
  }, [open]);

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
  }, [species]);

  const filteredCommon = useMemo(() => {
    if (!query) return common;
    const q = query.toLowerCase();
    return common.filter(m => m.name.toLowerCase().includes(q));
  }, [common, query]);

  /**
   * The "main list" — either learnable-only or unfiltered, depending on
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
    if (!query) return base;
    const q = query.toLowerCase();
    return base.filter(m => m.name.toLowerCase().includes(q));
  }, [query, species, showAll, learnset]);

  const showCommonHeader = species && filteredCommon.length > 0;
  const mainHeader = species && !showAll && learnset.kind === 'ready'
    ? 'Learnable'
    : 'All';
  const isLoadingLearnset = !!species && !showAll && learnset.kind === 'loading';
  // Always render the main-list header when a species is set (Common may be
  // empty for non-curated mons, but the Learnable/All distinction still
  // matters and the test relies on it).
  const showMainHeader = !!species;

  return (
    <PickerShell open={open} onClose={onClose} title="Pick a move">
      <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
             placeholder="Search moves"
             // text-base (16px) avoids iOS Safari/Brave's auto-zoom on focus.
             className="w-full bg-surface border border-surface-hi rounded-lg px-3 py-2 text-base" />
      {/* Show-all override — only meaningful when a species is set. Without
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
                   onPick={() => { onPick(m.name); onClose(); }} />
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
