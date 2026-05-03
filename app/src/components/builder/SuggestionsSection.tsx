import { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { suggestAdditions, type Suggestion, type SuggestionReason } from '../../calc/suggestions';
import { spriteUrl } from '../../data/sprites';
import { TypeBadge } from '../TypeBadge';
import { PickerShell } from '../pickers/PickerShell';
import { Generations, toID } from '@smogon/calc';

const GEN = Generations.get(0);

interface Props {
  selectedTeamId: string | null;
}

/**
 * Top-N candidate Pokémon that complement the active team. Pure type-chart
 * scoring (see calc/suggestions.ts). Tapping a card opens a lightweight
 * detail sheet showing the species' types and the reasons it was suggested
 * — there's no "add to team" affordance because we'd have to make a slot
 * decision for the user.
 */
export function SuggestionsSection({ selectedTeamId }: Props) {
  const teams = useStore(s => s.teams);
  const threatLists = useStore(s => s.threatLists);
  const team = teams.find(t => t.id === selectedTeamId) ?? null;

  // Use the seeded "Most-Used" list as the threat reference. We look up by
  // the stable seedKey rather than display name so a renamed seed still
  // resolves correctly. Falls back to any other seed, then any list.
  const reference = useMemo(() => {
    return (
      threatLists.find(l => l.seedKey === 'most-used')
      ?? threatLists.find(l => l.isSeed)
      ?? threatLists[0]
      ?? null
    );
  }, [threatLists]);

  const suggestions = useMemo(() => {
    if (!team || team.mons.length === 0) return [];
    if (!reference) return [];
    return suggestAdditions(team.mons, reference.mons);
  }, [team?.id, team?.updatedAt, reference?.id, reference?.updatedAt]);

  const [detail, setDetail] = useState<Suggestion | null>(null);

  return (
    <section className="mb-5" data-testid="suggestions-section">
      <h3 className="text-base font-bold mb-2">Suggestions</h3>

      {(!team || team.mons.length === 0) ? (
        <div
          data-testid="suggestions-empty"
          className="bg-surface border border-surface-hi rounded-card p-4 text-sm opacity-65 italic"
        >
          Build a team first to see suggestions.
        </div>
      ) : suggestions.length === 0 ? (
        <div
          data-testid="suggestions-no-fit"
          className="bg-surface border border-surface-hi rounded-card p-4 text-sm opacity-65 italic"
        >
          No candidate fits this team's gaps right now.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {suggestions.map(s => (
              <SuggestionCard key={s.species} suggestion={s} onOpen={() => setDetail(s)} />
            ))}
          </div>
          <p className="text-xs opacity-50 mt-2 text-center">
            Tap a Pokémon to view details
          </p>
        </>
      )}

      <SuggestionDetailSheet
        open={!!detail}
        suggestion={detail}
        onClose={() => setDetail(null)}
      />
    </section>
  );
}

function SuggestionCard({ suggestion, onOpen }: {
  suggestion: Suggestion; onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid={`suggestion-${suggestion.species}`}
      className="bg-surface border border-surface-hi rounded-card p-2.5 text-left hover:bg-surface-hi/40 cursor-pointer flex flex-col gap-1.5"
    >
      <div className="flex items-center gap-2">
        <img
          src={spriteUrl(suggestion.species)}
          alt={suggestion.species}
          className="w-10 h-10 object-contain"
        />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{suggestion.species}</div>
          <div className="flex gap-1 mt-0.5">
            {suggestion.types.map(t => (
              <TypeBadge key={t} type={t} />
            ))}
          </div>
        </div>
        <span className="text-xs font-bold bg-accent/20 text-accent rounded px-1.5 py-0.5">
          +{suggestion.score}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {suggestion.reasons.slice(0, 3).map((r, i) => (
          <ReasonChip key={`${r.kind}-${r.text}-${i}`} reason={r} />
        ))}
      </div>
    </button>
  );
}

function ReasonChip({ reason }: { reason: SuggestionReason }) {
  const tone = reasonTone(reason.kind);
  return (
    <span
      data-kind={reason.kind}
      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${tone}`}
    >
      {reason.text}
    </span>
  );
}

function reasonTone(kind: SuggestionReason['kind']): string {
  // Violet for offensive coverage closes, green for defensive resists,
  // orange for "punishes a top-meta threat".
  switch (kind) {
    case 'offensive-gap': return 'bg-accent/20 text-accent';
    case 'defensive-overlap': return 'bg-ok/15 text-ok';
    case 'threat-favorable': return 'bg-priority/20 text-priority';
  }
}

function SuggestionDetailSheet({ open, suggestion, onClose }: {
  open: boolean; suggestion: Suggestion | null; onClose: () => void;
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
              {types.map(t => <TypeBadge key={t} type={t} size="md" />)}
            </div>
          </div>
          <span className="text-sm font-bold bg-accent/20 text-accent rounded px-2 py-1">
            +{suggestion.score}
          </span>
        </div>

        <div className="text-xxs uppercase tracking-wider opacity-55 mb-2">Why suggested</div>
        <ul className="flex flex-col gap-1.5 mb-3">
          {suggestion.reasons.map((r, i) => (
            <li key={`${r.kind}-${r.text}-${i}`} className="flex items-center gap-2">
              <ReasonChip reason={r} />
            </li>
          ))}
        </ul>

        <p className="text-xs opacity-55 italic">
          Add this mon manually from Teams — we don't auto-pick a slot.
        </p>
      </div>
    </PickerShell>
  );
}
