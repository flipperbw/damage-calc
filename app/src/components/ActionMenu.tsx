import type { ReactNode } from 'react';

import { PickerShell } from '@/components/pickers/PickerShell';

export interface ActionMenuItem {
  label: ReactNode;
  onClick: () => void;
  tone?: 'default' | 'danger';
  testId?: string;
  disabled?: boolean;
}

interface ActionMenuProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  items: ActionMenuItem[];
  /** Optional content rendered below the items (e.g. "seed lists can't be deleted" hint). */
  footer?: ReactNode;
}

/**
 * Sheet-style action menu: a {@link PickerShell} hosting a column of
 * tappable rows. Replaces the per-screen `MenuButton` + flex-col copies
 * Teams/ThreatList both used to inline. Items are passed as data so the
 * menu can be assembled by callers without redeclaring row markup.
 */
export function ActionMenu({ open, onClose, title, items, footer }: ActionMenuProps) {
  return (
    <PickerShell open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-1.5">
        {items.map((item, i) => {
          const tone = item.tone ?? 'default';
          const cls = tone === 'danger' ? 'bg-danger/10 border-danger/30 text-danger' : 'bg-surface border-surface-hi';
          return (
            <button
              key={i}
              type="button"
              onClick={item.onClick}
              disabled={item.disabled}
              data-testid={item.testId}
              className={`text-left px-3 py-2 rounded-lg border text-sm ${cls} disabled:opacity-50`}
            >
              {item.label}
            </button>
          );
        })}
        {footer}
      </div>
    </PickerShell>
  );
}
