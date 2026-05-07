import { ReactNode, RefObject, useEffect, useRef } from 'react';

interface SearchProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /**
   * Whether to autoFocus the search input on mount. Defaults to true (most
   * pickers want it focused so the user can type immediately). Set to false
   * for callers that prefer no focus (e.g. embedded pickers reached via a
   * touch-then-tap flow that would steal a soft-keyboard slot).
   */
  autoFocus?: boolean;
  testId?: string;
  /** Forwarded onto the search input so callers can imperatively focus/blur it. */
  inputRef?: RefObject<HTMLInputElement>;
}

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
  /**
   * Optional search-input slot. When provided, the shell renders an
   * autoFocus-by-default `<input>` above `children` and wraps `children`
   * in a standard scrollable container. When omitted, the shell renders
   * `children` directly (back-compat for non-search pickers).
   *
   * The shell does NOT own the search state, debounce, key handlers, or
   * filter UI; pickers each own their own and pass `value`/`onChange`
   * back in.
   */
  search?: SearchProps;
  /**
   * Optional content rendered between the search input and the scrollable
   * body. Used for filter chips, sort menus, and other per-picker controls.
   * Only rendered when `search` is also provided (filters without a search
   * input is not a pattern any current caller uses).
   */
  filters?: ReactNode;
  children: ReactNode;
}

/**
 * Blur whatever input is currently focused inside the picker before it
 * unmounts. iOS Safari/Brave occasionally fail to release the auto-zoom
 * that was triggered by focusing a sub-16px input - and even when the
 * input itself is 16px+, removing a focused input from the DOM without
 * an explicit blur can leave the visual viewport zoomed in. This is a
 * belt-and-suspenders fix on top of the text-base sizing already applied
 * to every search input.
 *
 * We blur in two places:
 *   1. When the user dismisses by tapping the backdrop (close path here).
 *   2. When `open` flips to false from any path (item picked, parent
 *      reset, etc.), via the open-tracking effect below - the picker's
 *      <input autoFocus> is still document.activeElement at that moment.
 */
function blurActive() {
  const a = document.activeElement;
  if (a instanceof HTMLElement) a.blur();
}

export function PickerShell({ open, onClose, title, children, align = 'sheet', search, filters }: Props) {
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
  // Sheet-style pickers get a mobile min-height so a short list (e.g.
  // AbilityPicker with 3 entries) doesn't render as a small floating panel
  // while ItemPicker / NaturePicker fill the 80vh cap. Desktop and centered
  // dialogs stay unconstrained so confirm/prompt sheets don't bloat.
  const sizing = align === 'centered' ? 'max-h-[80vh]' : 'min-h-[70vh] md:min-h-0 max-h-[80vh]';
  return (
    <div className={`fixed inset-0 z-30 bg-black/60 flex ${verticalAlign} justify-center p-3.5`} onClick={close}>
      <div
        data-testid="picker-shell"
        className={`w-full max-w-md bg-bg-base bg-panel-gradient border border-surface-hi rounded-card p-3.5 ${sizing} flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h3 className="text-base font-bold mb-2">{title}</h3>}
        {search ? <SearchBody search={search} filters={filters}>{children}</SearchBody> : children}
      </div>
    </div>
  );
}

/**
 * Inner body for the search-input + scrollable list shape. Split out so the
 * `react-hooks/refs` lint rule doesn't latch onto the `search` props bag in
 * the parent and (incorrectly) flag every property access on it as a ref
 * deref. Destructuring at the function boundary sidesteps the heuristic.
 */
function SearchBody({ search, filters, children }: { search: SearchProps; filters?: ReactNode; children: ReactNode }) {
  const { value, onChange, placeholder, autoFocus = true, testId, inputRef } = search;
  return (
    <>
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={testId}
        // text-base (16px) avoids iOS Safari/Brave's auto-zoom on focus.
        // Anything <16px triggers it; pinch-zoom stays available either way.
        // mb-3 lands when there are no filters; when filters are passed
        // they own their own top spacing via mt-* on the first row.
        className={`w-full bg-surface border border-surface-hi rounded-lg px-3 py-2 text-base ${filters ? '' : 'mb-3'}`}
      />
      {filters}
      <div
        // overscroll-behavior contains scroll chaining (pull-to-refresh,
        // bounce affecting the page underneath). touch-action pan-y is a
        // belt-and-suspenders hint to iOS WebKit that this region is a
        // vertical scroll container — without it some layouts get treated
        // as the document scroll which interacts badly with sticky filter
        // panels.
        className="overflow-y-auto flex-1 -mx-1 px-1 [overscroll-behavior:contain] [touch-action:pan-y]"
      >
        {children}
      </div>
    </>
  );
}
