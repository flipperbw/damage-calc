import { ReactNode, useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  /**
   * Vertical alignment on mobile. Default `'sheet'` (items-end → bottom
   * sheet) is right for tall picker lists; `'centered'` keeps the modal
   * vertically centered which reads better for short prompt/confirm
   * dialogs that don't justify a full-height sheet.
   */
  align?: 'sheet' | 'centered';
  children: ReactNode;
}

/**
 * Blur whatever input is currently focused inside the picker before it
 * unmounts. iOS Safari/Brave occasionally fail to release the auto-zoom
 * that was triggered by focusing a sub-16px input — and even when the
 * input itself is 16px+, removing a focused input from the DOM without
 * an explicit blur can leave the visual viewport zoomed in. This is a
 * belt-and-suspenders fix on top of the text-base sizing already applied
 * to every search input.
 *
 * We blur in two places:
 *   1. When the user dismisses by tapping the backdrop (close path here).
 *   2. When `open` flips to false from any path (item picked, parent
 *      reset, etc.), via the open-tracking effect below — the picker's
 *      <input autoFocus> is still document.activeElement at that moment.
 */
function blurActive() {
  const a = document.activeElement;
  if (a instanceof HTMLElement) a.blur();
}

export function PickerShell({ open, onClose, title, children, align = 'sheet' }: Props) {
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) blurActive();
    wasOpen.current = open;
  }, [open]);

  if (!open) return null;
  /**
   * Closing via backdrop tap must NOT propagate the click up the React
   * tree. Pickers are nested inside their callers (MonCard, FieldBar,
   * MonEditor); without stopPropagation, a backdrop tap closes the picker
   * AND triggers the parent's onClick (e.g. opens the editor or swaps the
   * opponent), which is never what the user wanted.
   */
  function close(e: React.MouseEvent) {
    e.stopPropagation();
    blurActive();
    onClose();
  }
  const verticalAlign = align === 'centered' ? 'items-center' : 'items-end md:items-center';
  return (
    <div className={`fixed inset-0 z-30 bg-black/60 flex ${verticalAlign} justify-center p-3.5`}
         onClick={close}>
      <div
        data-testid="picker-shell"
        className="w-full max-w-md bg-bg-base bg-panel-gradient border border-surface-hi rounded-card p-3.5 max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {title && <h3 className="text-base font-bold mb-2">{title}</h3>}
        {children}
      </div>
    </div>
  );
}
