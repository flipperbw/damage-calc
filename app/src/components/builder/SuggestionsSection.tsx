import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { suggestCountersTo } from '@/calc/counter-suggestions';
import { GEN, toID } from '@/calc/gen';
import { suggestAdditions, type Suggestion, type SuggestionReason } from '@/calc/suggestions';
import { SectionToggle } from '@/components/builder/SectionToggle';
import { PickerShell } from '@/components/pickers/PickerShell';
import { TypeBadge } from '@/components/TypeBadge';
import { spriteUrl } from '@/data/sprites';
import { useStore } from '@/store';
import { defaultTeamMon } from '@/store/factories';
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
    const mon = defaultTeamMon(species);
    upsertMon(team.id, mon);
    toast.success(`Added ${species} to ${team.name}`);
    // Drop the user into the editor on the new mon so they can pick a build /
    // moves immediately - same flow as the Coverage roster's "+ slot" path.
    setEditor({ kind: 'team-mon', teamId: team.id, monId: mon.id });
  }

  // Use the seeded "Most-Used" list as the threat reference. We look up by
  // the stable seedKey rather than display name so a renamed seed still
  // resolves correctly. Falls back to any other seed, then any list.
  const reference = useMemo(() => {
    return threatLists.find((l) => l.seedKey === 'most-used') ?? threatLists.find((l) => l.isSeed) ?? threatLists[0] ?? null;
  }, [threatLists]);

  // Single-threat focus: when set, scoring uses only this mon as the
  // threat list. Empty string === "All threats" (the default behavior
  // backed by the Most-Used reference list).
  const [focusThreatId, setFocusThreatId] = useState<string>('');
  // Drop stale focus when the selected threat list changes underneath us.
  const focusValid = !!focusThreatId && !!focusableThreats?.some((m) => m.id === focusThreatId);
  const focusedThreat = focusValid ? focusableThreats!.find((m) => m.id === focusThreatId) ?? null : null;

  // Field state drives the calc-based counter scoring. We read the live
  // store value so changes to weather/terrain/screens propagate.
  const field = useStore((s) => s.field);

  const suggestions = useMemo(() => {
    if (!team || team.mons.length === 0) return [];
    if (focusedThreat) {
      // Focused mode: calc-based scoring. Runs ~600 calcs across the
      // top-pool and is fast enough to call synchronously here. The
      // memo key includes the focus id + threat list updatedAt so we
      // recompute when the user changes target or edits the threat.
      return suggestCountersTo(focusedThreat, field, team.format);
    }
    if (!reference) return [];
    return suggestAdditions(team.mons, reference.mons);
  }, [team?.id, team?.updatedAt, team?.format, reference?.id, reference?.updatedAt, focusedThreat, field]);

  const [detail, setDetail] = useState<Suggestion | null>(null);
  const [open, setOpen] = useState(true);

  return (
    <section className="mb-5" data-testid="suggestions-section">
      <SectionToggle open={open} onToggle={() => setOpen((o) => !o)} title="Suggestions" testId="suggestions-toggle" />

      {open && (
      <>

      {focusableThreats && focusableThreats.length > 0 && (
        <div className="flex items-center gap-2 mb-2.5">
          <label htmlFor="suggestions-focus" className="text-[10px] uppercase tracking-wider opacity-55 shrink-0">
            Focus on
          </label>
          <select
            id="suggestions-focus"
            value={focusThreatId}
            onChange={(e) => setFocusThreatId(e.target.value)}
            data-testid="suggestions-focus"
            className="flex-1 min-w-0 bg-surface border border-surface-hi rounded-lg px-2 py-1.5 text-sm text-text"
          >
            <option value="" className="bg-bg-base">All threats (Most-Used)</option>
            {focusableThreats.map((m) => (
              <option key={m.id} value={m.id} className="bg-bg-base">
                {m.species}
              </option>
            ))}
          </select>
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
        <img src={spriteUrl(suggestion.species)} alt={suggestion.species} className="w-9 h-9 object-contain shrink-0" />
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
          title="Match strength: +3 per coverage gap closed, +2 per shared weakness, +1 per favorable matchup vs Most-Used"
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
          <img src={spriteUrl(suggestion.species)} className="w-14 h-14 object-contain" />
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
