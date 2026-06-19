import { ReactNode, RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';

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
        // Contain keydowns too (mirrors the click containment above). The
        // picker is rendered inside interactive surfaces like MonCard's
        // role="button" card, whose Enter/Space handler opens the species
        // picker — without this, pressing Enter to pick an item would bubble
        // up and re-open that picker. A modal owns its own keyboard.
        onKeyDown={(e) => e.stopPropagation()}
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
  const bodyRef = useRef<HTMLDivElement>(null);
  const localInputRef = useRef<HTMLInputElement>(null);
  const resolvedInputRef = inputRef ?? localInputRef;
  // Keyboard navigation uses "virtual focus": the search input keeps real DOM
  // focus (so the user can keep typing to filter), while a highlighted index
  // tracks the active option. Options are opaque children, so we drive the
  // highlight imperatively against the DOM — any picker row tagged with
  // `data-picker-option` participates automatically.
  const [activeIndex, setActiveIndex] = useState(0);
  // Mirror activeIndex into a ref so the document-level key listener (bound once
  // on open) always reads the latest value without re-binding.
  const activeIndexRef = useRef(0);
  activeIndexRef.current = activeIndex;

  function optionEls(): HTMLElement[] {
    if (!bodyRef.current) return [];
    return Array.from(bodyRef.current.querySelectorAll<HTMLElement>('[data-picker-option]'));
  }

  // Focus the search input on open so the user can type to filter immediately.
  // Keyboard *navigation* no longer depends on this (see the document listener
  // below) — it's purely for typing convenience.
  useEffect(() => {
    if (autoFocus) resolvedInputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard navigation, bound at the document level (capture phase) while the
  // picker is open. This is deliberately FOCUS-INDEPENDENT: relying on the
  // search input holding focus is fragile for a modal opened from inside the
  // editor (a stolen/never-granted focus silently kills the feature, and a
  // bubbled Enter/Space hits MonCard's role="button" and opens the species
  // picker). Capturing at document means arrows/Enter work regardless of what
  // holds focus, and stopPropagation keeps them from leaking to the card.
  // Letters/Backspace are left untouched so typing still filters.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return;
      const opts = optionEls();
      if (opts.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'ArrowDown') {
        setActiveIndex((i) => Math.min(i + 1, opts.length - 1));
      } else if (e.key === 'ArrowUp') {
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else {
        opts[Math.min(activeIndexRef.current, opts.length - 1)]?.click();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A new filter string re-orders/replaces the list, so snap back to the top
  // result — Enter should pick the best match without an extra arrow press.
  useEffect(() => {
    setActiveIndex(0);
  }, [value]);

  // Re-apply the highlight after every render (the option list changes as the
  // user types/filters) and keep the active row scrolled into view. block:
  // 'nearest' is a no-op when it's already visible, so manual scrolls aren't
  // yanked — and the body only re-renders on navigation-style changes anyway.
  useLayoutEffect(() => {
    const opts = optionEls();
    if (opts.length === 0) return;
    const idx = Math.min(activeIndex, opts.length - 1);
    opts.forEach((el, i) => {
      if (i === idx) el.setAttribute('data-active', 'true');
      else el.removeAttribute('data-active');
    });
    // Optional-chain the method too: jsdom (test env) doesn't implement it.
    opts[idx]?.scrollIntoView?.({ block: 'nearest' });
  });

  return (
    <>
      <input
        ref={resolvedInputRef}
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
        ref={bodyRef}
        // overscroll-behavior contains scroll chaining (pull-to-refresh,
        // bounce affecting the page underneath). touch-action pan-y is a
        // belt-and-suspenders hint to iOS WebKit that this region is a
        // vertical scroll container — without it some layouts get treated
        // as the document scroll which interacts badly with sticky filter
        // panels. overflow-x-hidden contains any row whose truncate failed
        // (e.g. missing min-w-0 on a flex child) so it can't push a
        // horizontal scrollbar onto the picker.
        className="overflow-y-auto overflow-x-hidden flex-1 -mx-1 px-1 [overscroll-behavior:contain] [touch-action:pan-y]"
      >
        {children}
      </div>
    </>
  );
}
