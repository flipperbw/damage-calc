import type { ProseState } from '@/components/useDescription';

interface Props {
  state: ProseState;
  /**
   * Stable test-id prefix for the loading skeleton + ready content. Existing
   * sheets use 'move-prose' / 'ability-prose' so tests can target them.
   */
  testId: string;
}

/**
 * Renders the @pkmn/data prose payload for a detail sheet. While loading,
 * shows a thin skeleton so the layout doesn't jump when prose arrives.
 * On error or when both fields are empty, renders nothing - the structured
 * info elsewhere on the sheet remains useful.
 */
export function ProseBlock({ state, testId }: Props) {
  if (state.kind === 'idle' || state.kind === 'error') return null;
  if (state.kind === 'loading') {
    return (
      <div className="mb-3 space-y-1.5" data-testid={`${testId}-loading`}>
        <div className="h-3 rounded bg-surface-hi/40 animate-pulse w-3/4" />
        <div className="h-3 rounded bg-surface-hi/40 animate-pulse w-5/6" />
      </div>
    );
  }
  const { short, full } = state.pair;
  if (!short && !full) return null;
  // @pkmn/data sometimes ships the same string in both short and full
  // (especially for one-line abilities like Chlorophyll). Skip the
  // duplicate full line so the sheet doesn't look like a copy-paste bug.
  const showFull = full && full.trim() !== (short ?? '').trim();
  return (
    <div className="mb-3" data-testid={testId}>
      {short && <div className="text-sm font-medium opacity-90 mb-1">{short}</div>}
      {showFull && <p className="text-sm opacity-75 leading-snug">{full}</p>}
    </div>
  );
}
