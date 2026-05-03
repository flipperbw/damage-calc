import { useEffect, useState } from 'react';

import { PickerShell } from '@/components/pickers/PickerShell';
import { abilityDescription, type DescPair } from '@/data/pkmn';

interface Props {
  open: boolean;
  abilityName: string | null;
  /** When true, render a "Change ability" button at the bottom that calls onChangeRequest. */
  canChange?: boolean;
  onClose: () => void;
  /** Called when the user taps "Change ability"; the sheet closes first, then this fires. */
  onChangeRequest?: () => void;
}

/** Loading state for the @pkmn/data prose fetch. */
type ProseState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ready'; pair: DescPair } | { kind: 'error' };

/**
 * Read-only sheet showing an ability's name, shortDesc and full desc from
 * @pkmn/data. Triggered by tapping a non-edit ability chip on the MonCard.
 * The picker remains the affordance for actually changing the ability - the
 * sheet routes there via the optional "Change ability" button when the chip
 * is editable.
 */
export function AbilityDetailSheet({ open, abilityName, canChange, onClose, onChangeRequest }: Props) {
  const [prose, setProse] = useState<ProseState>({ kind: 'idle' });

  useEffect(() => {
    if (!open || !abilityName) {
      setProse({ kind: 'idle' });
      return;
    }
    let cancelled = false;
    setProse({ kind: 'loading' });
    abilityDescription(abilityName)
      .then((pair) => {
        if (!cancelled) setProse({ kind: 'ready', pair });
      })
      .catch(() => {
        if (!cancelled) setProse({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [open, abilityName]);

  if (!open || !abilityName) return null;

  return (
    <PickerShell open={open} onClose={onClose} title={undefined}>
      <div className="overflow-y-auto -mx-1 px-1">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-bold flex-1">{abilityName}</h3>
        </div>

        <ProseSection state={prose} />

        {/* Fallback when @pkmn/data has nothing - common for niche abilities
            that are only documented by SV-era data. */}
        {prose.kind === 'ready' && !prose.pair.short && !prose.pair.full && (
          <p className="text-sm opacity-60 italic mb-3">No description available for this ability.</p>
        )}

        {canChange && onChangeRequest && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onChangeRequest();
            }}
            data-testid="ability-detail-change"
            className="w-full mt-2 py-2.5 rounded-card font-bold text-sm bg-surface border border-surface-hi hover:bg-surface-hi/40"
          >
            Change ability
          </button>
        )}
      </div>
    </PickerShell>
  );
}

function ProseSection({ state }: { state: ProseState }) {
  if (state.kind === 'idle' || state.kind === 'error') return null;
  if (state.kind === 'loading') {
    return (
      <div className="mb-3 space-y-1.5" data-testid="ability-prose-loading">
        <div className="h-3 rounded bg-surface-hi/40 animate-pulse w-3/4" />
        <div className="h-3 rounded bg-surface-hi/40 animate-pulse w-5/6" />
      </div>
    );
  }
  const { short, full } = state.pair;
  if (!short && !full) return null;
  return (
    <div className="mb-3" data-testid="ability-prose">
      {short && <div className="text-sm font-medium opacity-90 mb-1">{short}</div>}
      {full && <p className="text-sm opacity-75 leading-snug">{full}</p>}
    </div>
  );
}
