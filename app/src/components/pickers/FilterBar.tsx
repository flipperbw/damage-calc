import type { ReactNode } from 'react';

interface Props {
  open: boolean;
  onToggle: () => void;
  /** Number of active filters; surfaces a count badge and the Clear action. */
  count: number;
  onClear: () => void;
  /** id of the panel this toggle controls (for aria-controls). */
  panelId: string;
  /** Prefix for data-testids, e.g. 'species' or 'move'. */
  testIdPrefix: string;
  /** Optional extra control rendered on the right of the row (before Clear),
   *  e.g. the MovePicker's "All moves / Learnable only" toggle. */
  trailing?: ReactNode;
}

function FilterIcon() {
  // Classic funnel/filter glyph: three shrinking horizontal lines.
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="7" y1="12" x2="17" y2="12" />
      <line x1="10" y1="18" x2="14" y2="18" />
    </svg>
  );
}

/**
 * Prominent, obviously-tappable filters toggle shared by the Species and Move
 * pickers. Renders a bordered chip (icon + label + count + chevron) and, when
 * any filter is active, a Clear action. Replaces the old tiny underlined text
 * link that was easy to miss.
 */
export function FilterBar({ open, onToggle, count, onClear, panelId, testIdPrefix, trailing }: Props) {
  const active = open || count > 0;
  return (
    <div className="flex items-center justify-between mt-2 mb-1 gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        data-testid={`${testIdPrefix}-filters-toggle`}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-lg border text-xs font-semibold transition-colors ${
          active
            ? 'border-accent/40 bg-accent/15 text-accent'
            : 'border-surface-hi bg-surface text-text-mute hover:text-text'
        }`}
      >
        <FilterIcon />
        Filters
        {count > 0 && (
          <span
            data-testid={`${testIdPrefix}-filters-count`}
            className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded text-[9px] font-bold bg-accent/25 text-accent border border-accent/30"
          >
            {count}
          </span>
        )}
        <span aria-hidden className="text-[10px] opacity-70">{open ? '▴' : '▾'}</span>
      </button>
      <div className="flex items-center gap-2 min-w-0">
        {trailing}
        {count > 0 && (
          <button
            type="button"
            onClick={onClear}
            data-testid={`${testIdPrefix}-filters-clear`}
            aria-label="Clear all filters"
            className="text-xs px-2 py-1.5 min-h-[34px] rounded-lg text-text-mute hover:text-text underline underline-offset-2"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
