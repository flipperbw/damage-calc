/* eslint-disable react-hooks/preserve-manual-memoization --
 * React Compiler is NOT enabled in this build (vite.config.ts uses plain
 * @vitejs/plugin-react), so this rule only checks whether these manual memos
 * *would* survive the compiler - it has no runtime effect here. The `reference`
 * and `suggestions` memos are intentional and load-bearing (their store-slice
 * deps are referentially stable), but the rule can't prove preservation because
 * `team`/`reference` flow into cross-module calls it can't analyze. exhaustive-deps
 * still applies. Drop this disable if/when the compiler is adopted. */
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { suggestCountersTo } from '@/calc/counter-suggestions';
import { GEN, toID } from '@/calc/gen';
import { suggestAdditions, type Suggestion, type SuggestionReason } from '@/calc/suggestions';
import { inferTeamTempo } from '@/calc/tempo';
import { SectionToggle } from '@/components/builder/SectionToggle';
import { PickerShell } from '@/components/pickers/PickerShell';
import { TypeBadge } from '@/components/TypeBadge';
import { Sprite } from '@/components/Sprite';
import { useStore } from '@/store';
import { defaultTeamMon } from '@/store/factories';
import { applySynthIfMissing } from '@/store/synthesize';
import type { SavedMon } from '@/types';

interface Props {
  selectedTeamId: string | null;
  /**
   * Mons from the user's currently-selected threat list. Drives the
   * "Focus on:" select — picking one narrows scoring to "what counters
   * this specific mon." When undefined or empty, only the All-threats
   * default is shown.
   */
  focusableThreats?: SavedMon[];
}

/**
 * Top-N candidate Pokémon that complement the active team. Pure type-chart
 * scoring (see calc/suggestions.ts). Tapping a card opens a lightweight
 * detail sheet showing the species' types and the reasons it was suggested
 * - there's no "add to team" affordance because we'd have to make a slot
 * decision for the user.
 */
export function SuggestionsSection({ selectedTeamId, focusableThreats }: Props) {
  const teams = useStore((s) => s.teams);
  const threatLists = useStore((s) => s.threatLists);
  const upsertMon = useStore((s) => s.upsertMon);
  const setEditor = useStore((s) => s.setEditor);
  const team = teams.find((t) => t.id === selectedTeamId) ?? null;
  const teamFull = !!team && team.mons.length >= 6;

  function addSpeciesToTeam(species: string) {
    if (!team || teamFull) return;
    // Species Clause: the suggestions list isn't pre-filtered against the
    // current team, so guard at the call site. (If this ever fires, the user
    // sees a clear toast instead of silently getting a duplicate.)
    if (team.mons.some((m) => m.species === species)) {
      toast.error(`${species} is already in ${team.name}`);
      return;
    }
    const mon = defaultTeamMon(species);
    upsertMon(team.id, mon);
    applySynthIfMissing(
      mon,
      () => useStore.getState().teams.find((t) => t.id === team.id)?.mons.find((m) => m.id === mon.id),
      (patched) => upsertMon(team.id, patched),
    );
    toast.success(`Added ${species} to ${team.name}`);
    // Drop the user into the editor only when the curated build filled
    // everything up-front. For un-curated species the editor would open
    // on the empty pre-synth state and look broken; the synth lands
    // moments later and the user can tap to edit afterward.
    if (mon.buildName) setEditor({ kind: 'team-mon', teamId: team.id, monId: mon.id });
  }

  // Reference threat list for "All threats" mode: top three from the seed
  // matching the team's format. Singles teams should be scored against
  // singles threats; doubles teams against doubles. Falls back to any
  // seed (then any list) if the format-matching seed is missing.
  const reference = useMemo(() => {
    const wantKey = team?.format === 'singles' ? 'singles' : 'doubles';
    const matching = threatLists.find((l) => l.seedKey === wantKey);
    if (matching) return { ...matching, mons: matching.mons.slice(0, 3) };
    return threatLists.find((l) => l.isSeed) ?? threatLists[0] ?? null;
  }, [threatLists, team?.format]);

  // Single-threat focus: when set, scoring uses only this mon as the
  // threat list. Empty string === "All threats" (scored against the
  // top-three slice of the seeded doubles list).
  const [focusThreatId, setFocusThreatId] = useState<string>('');
  const [focusPickerOpen, setFocusPickerOpen] = useState(false);
  // Drop stale focus when the selected threat list changes underneath us.
  const focusValid = !!focusThreatId && !!focusableThreats?.some((m) => m.id === focusThreatId);
  const focusedThreat = focusValid ? focusableThreats!.find((m) => m.id === focusThreatId) ?? null : null;

  // Field state drives the calc-based counter scoring. We read the live
  // store value so changes to weather/terrain/screens propagate.
  const field = useStore((s) => s.field);

  // Team tempo: if a drafted mon packs Trick Room or the live field
  // already has TR active, the calc-based counter scorer should run
  // under TR — that flips the speed comparison so slow attackers get
  // credited with "Outspeeds" and a slow nuker rises in the rankings.
  // The field used for scoring is otherwise the live one (weather,
  // screens, terrain).
  const tempo = team ? inferTeamTempo(team, field) : 'normal';
  // Memoized so a TR team doesn't mint a fresh field object every render
  // (which would bust the suggestions memo below on each pass).
  const scoringField = useMemo(
    () => (tempo === 'trick-room' && !field.isTrickRoom ? { ...field, isTrickRoom: true } : field),
    [tempo, field],
  );

  // When the focused threat has no damaging moves modelled, the calc
  // returns 0% across the board for it. The counter scorer correctly
  // refuses to claim immunity in that case, but the resulting ranking
  // is pure offense — the user should know they need to fill the
  // threat's moveset for accurate defensive scoring.
  const focusedThreatMissingMoves = !!focusedThreat && focusedThreat.moves.every((m) => !m);

  const suggestions = useMemo(() => {
    if (!team || team.mons.length === 0) return [];
    if (focusedThreat) {
      // Focused mode: calc-based scoring. Runs ~600 calcs across the
      // top-pool and is fast enough to call synchronously here. The
      // memo key includes the focus id + threat list updatedAt so we
      // recompute when the user changes target or edits the threat,
      // and tempo so toggling Trick Room (or pinning it) reranks.
      return suggestCountersTo(focusedThreat, scoringField, team.format);
    }
    if (!reference) return [];
    return suggestAdditions(team.mons, reference.mons);
    // `team`, `reference`, and `scoringField` are all referentially stable
    // (store slices / memoized), so this only recomputes on a real change.
  }, [team, reference, focusedThreat, scoringField]);

  const [detail, setDetail] = useState<Suggestion | null>(null);
  const [open, setOpen] = useState(true);

  return (
    <section className="mb-5" data-testid="suggestions-section">
      <SectionToggle open={open} onToggle={() => setOpen((o) => !o)} title="Suggestions" testId="suggestions-toggle" />

      {open && (
      <>

      {tempo === 'trick-room' && (
        <div
          data-testid="suggestions-tempo-tr"
          className="mb-2.5 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-priority/15 text-priority border border-priority/30"
          title="Detected Trick Room tempo — counter scoring runs under TR so slow nukers rank higher"
        >
          <span aria-hidden>⏳</span>
          Trick Room tempo
        </div>
      )}

      {focusableThreats && focusableThreats.length > 0 && (
        <div className="flex items-center gap-2 mb-2.5">
          <label id="suggestions-focus-label" className="text-[10px] uppercase tracking-wider opacity-55 shrink-0">
            Focus on
          </label>
          <button
            type="button"
            onClick={() => setFocusPickerOpen(true)}
            aria-labelledby="suggestions-focus-label"
            aria-haspopup="dialog"
            data-testid="suggestions-focus"
            className="flex-1 min-w-0 flex items-center gap-2 bg-surface border border-surface-hi rounded-lg px-2 py-1.5 text-sm text-text text-left hover:border-accent/40 transition-colors"
          >
            {focusedThreat ? (
              <>
                <Sprite species={focusedThreat.species} alt="" className="w-5 h-5 shrink-0" />
                <span className="flex-1 min-w-0 truncate">{focusedThreat.species}</span>
              </>
            ) : (
              <span className="flex-1 min-w-0 truncate">All threats</span>
            )}
            <span aria-hidden className="opacity-50 shrink-0 text-xs">▾</span>
          </button>
        </div>
      )}

      {!team || team.mons.length === 0 ? (
        <div data-testid="suggestions-empty" className="bg-surface border border-surface-hi rounded-card p-4 text-sm opacity-65 italic">
          Build a team first to see suggestions.
        </div>
      ) : suggestions.length === 0 ? (
        <div data-testid="suggestions-no-fit" className="bg-surface border border-surface-hi rounded-card p-4 text-sm opacity-65 italic">
          {focusedThreat
            ? `No candidate in the pool cleanly counters ${focusedThreat.species} right now.`
            : "No candidate fits this team's gaps right now."}
        </div>
      ) : (
        <>
          {focusedThreatMissingMoves && (
            <div
              data-testid="suggestions-threat-no-moves"
              className="mb-2.5 text-[11px] px-3 py-2 rounded-lg bg-warn/10 border border-warn/30 text-warn"
            >
              {focusedThreat!.species} has no moves yet — defensive scoring is unreliable until you pick a moveset.
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {suggestions.map((s) => (
              <SuggestionCard
                key={s.species}
                suggestion={s}
                onOpen={() => setDetail(s)}
                onAdd={teamFull ? null : () => addSpeciesToTeam(s.species)}
              />
            ))}
          </div>
          <p className="text-xs opacity-50 mt-2 text-center">
            {teamFull ? `${team!.name} is full - remove a mon to add a suggestion.` : 'Tap a Pokémon for details, or + to add it to your team.'}
          </p>
        </>
      )}

      </>
      )}

      {focusableThreats && focusableThreats.length > 0 && (
        <FocusThreatPicker
          open={focusPickerOpen}
          threats={focusableThreats}
          selectedId={focusThreatId}
          onPick={(id) => {
            setFocusThreatId(id);
            setFocusPickerOpen(false);
          }}
          onClose={() => setFocusPickerOpen(false)}
        />
      )}

      <SuggestionDetailSheet
        open={!!detail}
        suggestion={detail}
        canAdd={!teamFull}
        onAdd={
          detail
            ? () => {
                addSpeciesToTeam(detail.species);
                setDetail(null);
              }
            : undefined
        }
        onClose={() => setDetail(null)}
      />
    </section>
  );
}

function SuggestionCard({
  suggestion,
  onOpen,
  onAdd,
}: {
  suggestion: Suggestion;
  onOpen: () => void;
  /** When null, the team is full and the + button is hidden. */
  onAdd: (() => void) | null;
}) {
  return (
    <div
      data-testid={`suggestion-${suggestion.species}`}
      // Card is a div, not a button, because we need a nested + button for
      // adding to team. Outer surface is a button-styled div with
      // role=button/keyboard handler so the whole card stays keyboard-friendly.
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="bg-surface border border-surface-hi rounded-card p-2 text-left cursor-pointer flex flex-col gap-1.5 transition-colors hover:bg-accent/[0.06] hover:border-accent/40"
    >
      {/* Top row: sprite + name + add. Score and types each get their own
          line so the row never overflows on narrow mobile cards (the v1
          horizontal layout was overlapping on iPhone widths). */}
      <div className="flex items-center gap-1.5">
        <Sprite species={suggestion.species} alt={suggestion.species} className="w-9 h-9 shrink-0" />
        <div className="font-semibold text-[13px] truncate flex-1 min-w-0">{suggestion.species}</div>
        {onAdd && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            aria-label={`Add ${suggestion.species} to team`}
            data-testid={`suggestion-add-${suggestion.species}`}
            className="w-7 h-7 shrink-0 rounded-full bg-accent text-white text-base font-bold flex items-center justify-center shadow-[0_2px_8px_rgba(124,92,255,0.3)] hover:scale-105 transition-transform"
            style={{ touchAction: 'manipulation' }}
          >
            +
          </button>
        )}
      </div>
      {/* Types + score: full row of their own. Score is title-attributed so a
          hover/long-press reveals what the number means. */}
      <div className="flex items-center gap-1 flex-wrap">
        {suggestion.types.map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
        <span
          className="text-[10px] font-bold bg-accent/20 text-accent rounded px-1 py-0.5 leading-none ml-auto"
          title="Match strength: +3 per coverage gap closed, +2 per shared weakness, +1 per favorable matchup vs top threats"
        >
          +{suggestion.score}
        </span>
      </div>
      {/* Reasons row */}
      <div className="flex flex-wrap gap-1">
        {suggestion.reasons.slice(0, 3).map((r, i) => (
          <ReasonChip key={`${r.kind}-${r.text}-${i}`} reason={r} />
        ))}
      </div>
    </div>
  );
}

/**
 * Bottom-sheet picker for the "Focus on" target. The seeded threat lists run
 * to ~40 mons, so a plain <select> is a long scroll; this gives a search box
 * (and keyboard nav, via PickerShell's data-picker-option contract) plus an
 * "All threats" reset row pinned to the top. Empty `selectedId` === all.
 */
function FocusThreatPicker({
  open,
  threats,
  selectedId,
  onPick,
  onClose,
}: {
  open: boolean;
  threats: SavedMon[];
  selectedId: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');

  // Clear a stale search every time the sheet (re)opens.
  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threats;
    return threats.filter((m) => m.species.toLowerCase().includes(q));
  }, [threats, query]);

  // "All threats" only shows when it isn't filtered out by the query, mirroring
  // the way every other row obeys the search box.
  const showAll = !query.trim() || 'all threats'.includes(query.trim().toLowerCase());

  return (
    <PickerShell
      open={open}
      onClose={onClose}
      title="Focus on"
      search={{ value: query, onChange: setQuery, placeholder: 'Search threats', testId: 'suggestions-focus-search' }}
    >
      <div className="mt-2">
        {showAll && (
          <button
            type="button"
            onClick={() => onPick('')}
            data-picker-option
            data-testid="suggestions-focus-option-all"
            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left hover:bg-surface data-[active=true]:bg-surface ${
              selectedId === '' ? 'text-accent font-semibold' : ''
            }`}
          >
            <span className="w-8 h-8 shrink-0 rounded flex items-center justify-center text-base opacity-70">✶</span>
            <span className="font-medium">All threats</span>
          </button>
        )}
        {filtered.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onPick(m.id)}
            data-picker-option
            data-testid={`suggestions-focus-option-${m.id}`}
            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left hover:bg-surface data-[active=true]:bg-surface ${
              selectedId === m.id ? 'text-accent font-semibold' : ''
            }`}
          >
            <Sprite species={m.species} alt="" className="w-8 h-8 rounded" />
            <span className="font-medium truncate">{m.species}</span>
          </button>
        ))}
      </div>
    </PickerShell>
  );
}

function ReasonChip({ reason }: { reason: SuggestionReason }) {
  const tone = reasonTone(reason.kind);
  return (
    <span data-kind={reason.kind} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${tone}`}>
      {reason.text}
    </span>
  );
}

function reasonTone(kind: SuggestionReason['kind']): string {
  // Violet for offensive coverage closes, green for defensive resists,
  // orange for "punishes a top-meta threat".
  switch (kind) {
    case 'offensive-gap':
      return 'bg-accent/20 text-accent';
    case 'defensive-overlap':
      return 'bg-ok/15 text-ok';
    case 'threat-favorable':
      return 'bg-priority/20 text-priority';
  }
}

function SuggestionDetailSheet({
  open,
  suggestion,
  canAdd,
  onAdd,
  onClose,
}: {
  open: boolean;
  suggestion: Suggestion | null;
  canAdd: boolean;
  onAdd?: () => void;
  onClose: () => void;
}) {
  if (!suggestion) return null;
  const sp = GEN.species.get(toID(suggestion.species) as any);
  const types = (sp?.types as readonly string[] | undefined) ?? suggestion.types;
  return (
    <PickerShell open={open} onClose={onClose}>
      <div className="overflow-y-auto -mx-1 px-1">
        <div className="flex items-center gap-3 mb-3">
          <Sprite species={suggestion.species} className="w-14 h-14" />
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold">{suggestion.species}</h3>
            <div className="flex gap-1 mt-1">
              {types.map((t) => (
                <TypeBadge key={t} type={t} size="md" />
              ))}
            </div>
          </div>
          <span className="text-sm font-bold bg-accent/20 text-accent rounded px-2 py-1">+{suggestion.score}</span>
        </div>

        <div className="text-xxs uppercase tracking-wider opacity-55 mb-2">Why suggested</div>
        <ul className="flex flex-col gap-1.5 mb-3">
          {suggestion.reasons.map((r, i) => (
            <li key={`${r.kind}-${r.text}-${i}`} className="flex items-center gap-2">
              <ReasonChip reason={r} />
            </li>
          ))}
        </ul>

        {canAdd && onAdd ? (
          <button
            type="button"
            onClick={onAdd}
            className="w-full py-3 rounded-card font-bold text-base bg-accent text-white hover:bg-accent-2 transition-colors"
          >
            + Add {suggestion.species} to team
          </button>
        ) : (
          <p className="text-xs opacity-55 italic">Team is full - remove a mon to add a new one.</p>
        )}
      </div>
    </PickerShell>
  );
}
