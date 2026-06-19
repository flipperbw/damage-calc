interface Props {
  /** Primary label, e.g. "No move" / "No item". */
  label: string;
  /** Faint secondary hint, e.g. "empties this slot". */
  hint?: string;
  onSelect: () => void;
  testId?: string;
}

/**
 * The "clear this selection" row at the top of a picker (replaces the old bare
 * "(none)" text). A circle-slash glyph in the same column as the move/item
 * info icons keeps it aligned with the list below, and it's keyboard-navigable
 * like any other option (data-picker-option).
 */
export function NoneRow({ label, hint, onSelect, testId }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={testId}
      data-picker-option
      className="w-full flex items-center gap-2 px-2 py-2 mb-1.5 rounded-lg hover:bg-surface text-left text-text-mute"
    >
      <span
        aria-hidden
        className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-white/[0.04] border border-surface-hi opacity-70"
      >
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
        </svg>
      </span>
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="text-xxs opacity-50">{hint}</span>}
    </button>
  );
}
