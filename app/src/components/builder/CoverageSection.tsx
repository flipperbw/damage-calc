import { useMemo, useState } from 'react';

import { analyzeCoverage } from '@/calc/coverage';
import { SectionToggle } from '@/components/builder/SectionToggle';
import { SpeciesPicker } from '@/components/pickers/SpeciesPicker';
import { TypeBadge } from '@/components/TypeBadge';
import { spriteUrl } from '@/data/sprites';
import { useStore } from '@/store';
import { defaultTeamMon } from '@/store/factories';

interface Props {
  /** Currently-selected team id. Owned by the parent so it stays in sync with the matchup matrix. */
  selectedTeamId: string | null;
  onSelectTeam: (id: string) => void;
}

/**
 * Pure type-chart coverage readout for the chosen team. Two side-by-side
 * blocks on desktop (offensive gaps / defensive overlaps), stacked on mobile.
 */
export function CoverageSection({ selectedTeamId, onSelectTeam }: Props) {
  const teams = useStore((s) => s.teams);
  const upsertMon = useStore((s) => s.upsertMon);
  const setEditor = useStore((s) => s.setEditor);
  const team = teams.find((t) => t.id === selectedTeamId) ?? null;

  // analyzeCoverage is pure but reads species/move data via calc. Memo so
  // unrelated re-renders (e.g. picker open/close) don't redo the chart math.
  const report = useMemo(() => analyzeCoverage(team?.mons ?? []), [team?.id, team?.updatedAt]);

  // Slot index the user tapped while empty - opens the SpeciesPicker. Once a
  // species is picked, we add a new mon to the team and immediately open the
  // editor on it (matches the TeamsScreen flow).
  const [pickingSlot, setPickingSlot] = useState<number | null>(null);

  const [open, setOpen] = useState(true);

  function addMon(species: string) {
    if (!team) return;
    const mon = defaultTeamMon(species);
    upsertMon(team.id, mon);
    setEditor({ kind: 'team-mon', teamId: team.id, monId: mon.id });
    setPickingSlot(null);
  }

  function editMon(monId: string) {
    if (!team) return;
    setEditor({ kind: 'team-mon', teamId: team.id, monId });
  }

  return (
    <section className="mb-5" data-testid="coverage-section">
      <SectionToggle open={open} onToggle={() => setOpen((o) => !o)} title="Coverage" testId="coverage-toggle" />

      {open && (
      <>
      <div className="mb-3">
        <label className="text-xxs uppercase tracking-wider opacity-55 mb-1 block">Team</label>
        {teams.length === 0 ? (
          <div className="text-sm opacity-60 italic">No teams yet - create one in Teams.</div>
        ) : (
          <select
            value={selectedTeamId ?? ''}
            onChange={(e) => onSelectTeam(e.target.value)}
            data-testid="coverage-team-select"
            className="w-full bg-surface border border-surface-hi rounded-lg px-3 py-2 text-sm text-text"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id} className="bg-bg-base">
                {t.name} ({t.mons.length})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Roster strip: 6 slots showing the team's mons. Tapping a filled
          slot opens the editor; tapping an empty slot opens the species
          picker so the user can add a mon directly from this tab. */}
      {team && (
        <div className="grid grid-cols-6 gap-1.5 mb-3" data-testid="coverage-roster">
          {Array.from({ length: 6 }).map((_, i) => {
            const mon = team.mons[i];
            if (mon) {
              return (
                <button
                  key={mon.id}
                  type="button"
                  onClick={() => editMon(mon.id)}
                  data-testid={`coverage-slot-filled-${i}`}
                  aria-label={`Edit ${mon.species}`}
                  className="aspect-square bg-surface border border-surface-hi rounded-lg flex items-center justify-center hover:border-accent/40"
                >
                  <img src={spriteUrl(mon.species)} className="w-3/4 h-3/4 object-contain" />
                </button>
              );
            }
            return (
              <button
                key={`empty-${i}`}
                type="button"
                onClick={() => setPickingSlot(i)}
                data-testid={`coverage-slot-empty-${i}`}
                aria-label={`Add Pokémon to slot ${i + 1}`}
                className="aspect-square bg-surface border border-dashed border-accent/30 rounded-lg flex items-center justify-center text-accent text-xl opacity-70 hover:opacity-100"
              >
                +
              </button>
            );
          })}
        </div>
      )}

      {team && team.mons.length === 0 && <div className="text-sm opacity-60 italic mb-3">Tap a slot above to add your first Pokémon.</div>}

      {team && team.mons.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <CoverageBlock title="Offensive gaps" data-testid="offensive-gaps">
            {report.offensiveGaps.length === 0 ? (
              <p className="text-sm opacity-60">No offensive gaps - you can hit everything.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {report.offensiveGaps.map((t) => (
                  <span key={t} data-testid={`offensive-gap-${t}`}>
                    <TypeBadge type={t} size="md" />
                  </span>
                ))}
              </div>
            )}
          </CoverageBlock>

          <CoverageBlock title="Defensive overlaps" data-testid="defensive-overlaps">
            {report.defensiveOverlaps.length === 0 ? (
              <p className="text-sm opacity-60">No shared weaknesses.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {report.defensiveOverlaps.map((o) => (
                  <span key={o.type} data-testid={`defensive-overlap-${o.type}`} data-count={o.count} className="inline-flex items-center gap-1.5">
                    <TypeBadge type={o.type} size="md" />
                    <span className="text-xs opacity-65">×{o.count} mons</span>
                  </span>
                ))}
              </div>
            )}
          </CoverageBlock>
        </div>
      )}

      </>
      )}

      <SpeciesPicker
        open={pickingSlot !== null}
        onClose={() => setPickingSlot(null)}
        onPick={addMon}
        showRecents={false}
        excludeSpecies={team ? new Set(team.mons.map((m) => m.species)) : undefined}
      />
    </section>
  );
}

function CoverageBlock({
  title,
  children,
  ...rest
}: {
  title: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="bg-surface border border-surface-hi rounded-card p-3" {...rest}>
      <div className="text-xxs uppercase tracking-wider opacity-55 mb-2">{title}</div>
      {children}
    </div>
  );
}
