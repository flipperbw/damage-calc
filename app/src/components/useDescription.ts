import { useEffect, useState } from 'react';

import { abilityDescription, itemDescription, moveDescription, type DescPair } from '@/data/pkmn';

/** Loading state for an async @pkmn/data prose fetch. */
export type ProseState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; pair: DescPair }
  | { kind: 'error' };

export type DescriptionKind = 'move' | 'ability' | 'item';

/**
 * Fetch the @pkmn/data short+full description for a move or ability while a
 * detail sheet is open. Resets to `idle` whenever `open` flips false or
 * `name` becomes null. Cancellation flag prevents a stale fetch from racing
 * a faster reopen on a different name.
 */
export function useDescription(name: string | null, kind: DescriptionKind, open: boolean): ProseState {
  const [state, setState] = useState<ProseState>({ kind: 'idle' });

  useEffect(() => {
    if (!open || !name) {
      setState({ kind: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ kind: 'loading' });
    const fetcher = kind === 'move' ? moveDescription : kind === 'item' ? itemDescription : abilityDescription;
    fetcher(name)
      .then((pair) => {
        if (!cancelled) setState({ kind: 'ready', pair });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [open, name, kind]);

  return state;
}
