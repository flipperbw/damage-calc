import { PickerShell } from '@/components/pickers/PickerShell';

interface Props {
  open: boolean;
  /** Section name — e.g. "Item", "Nature", "Status", "Boosts". */
  title: string;
  /** Current value displayed prominently — e.g. "Floettite", "Modest", "Burned", "None". */
  value: string | null;
  /** Optional explanatory body (stat mods, status effect, boost stages). */
  detail?: React.ReactNode;
  /** When true, render a "Change …" button at the bottom. */
  canChange?: boolean;
  /** Label on the change button — e.g. "Change item". */
  changeLabel?: string;
  onClose: () => void;
  /** Fires after the sheet closes. Caller wires this to opening a picker. */
  onChangeRequest?: () => void;
}

/**
 * Read-only detail sheet shared by the non-ability chips (item, nature,
 * status, boosts). Same shape as AbilityDetailSheet: title, current
 * value, descriptive body, and a "Change …" button that closes the
 * sheet and hands off to a picker. Chips on MonCard route through this
 * sheet so every chip behaves like the ability one — tap to see what's
 * there, tap again to change it.
 */
export function ChipDetailSheet({ open, title, value, detail, canChange, changeLabel, onClose, onChangeRequest }: Props) {
  if (!open) return null;
  return (
    <PickerShell open={open} onClose={onClose} title={undefined}>
      <div className="overflow-y-auto -mx-1 px-1">
        <div className="text-xxs uppercase tracking-wider opacity-55 mb-1">{title}</div>
        <h3 className="text-lg font-bold mb-3">{value ?? 'None'}</h3>

        {detail && <div className="mb-3 text-sm opacity-85">{detail}</div>}

        {canChange && onChangeRequest && changeLabel && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onChangeRequest();
            }}
            data-testid="chip-detail-change"
            className="w-full mt-2 py-2.5 rounded-card font-bold text-sm bg-surface border border-surface-hi hover:bg-surface-hi/40"
          >
            {changeLabel}
          </button>
        )}
      </div>
    </PickerShell>
  );
}
