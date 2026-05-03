import { useMemo } from 'react';
import { useStore } from '../../store';
import { analyzeCoverage } from '../../calc/coverage';
import { TypeBadge } from '../TypeBadge';

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
  const teams = useStore(s => s.teams);
  const team = teams.find(t => t.id === selectedTeamId) ?? null;

  // analyzeCoverage is pure but reads species/move data via calc. Memo so
  // unrelated re-renders (e.g. picker open/close) don't redo the chart math.
  const report = useMemo(
    () => analyzeCoverage(team?.mons ?? []),
    [team?.id, team?.updatedAt],
  );

  return (
    <section className="mb-5" data-testid="coverage-section">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-bold">Coverage</h3>
      </div>

      <div className="mb-3">
        <label className="text-xxs uppercase tracking-wider opacity-55 mb-1 block">Team</label>
        {teams.length === 0 ? (
          <div className="text-sm opacity-60 italic">No teams yet — create one in Teams.</div>
        ) : (
          <select
            value={selectedTeamId ?? ''}
            onChange={e => onSelectTeam(e.target.value)}
            data-testid="coverage-team-select"
            className="w-full bg-surface border border-surface-hi rounded-lg px-3 py-2 text-sm text-text"
          >
            {teams.map(t => (
              <option key={t.id} value={t.id} className="bg-bg-base">
                {t.name} ({t.mons.length})
              </option>
            ))}
          </select>
        )}
      </div>

      {team && team.mons.length === 0 && (
        <div className="text-sm opacity-60 italic">
          This team has no Pokémon yet.
        </div>
      )}

      {team && team.mons.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <CoverageBlock title="Offensive gaps" data-testid="offensive-gaps">
            {report.offensiveGaps.length === 0 ? (
              <p className="text-sm opacity-60">
                No offensive gaps — you can hit everything.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {report.offensiveGaps.map(t => (
                  <span
                    key={t}
                    data-testid={`offensive-gap-${t}`}
                  >
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
                {report.defensiveOverlaps.map(o => (
                  <span
                    key={o.type}
                    data-testid={`defensive-overlap-${o.type}`}
                    data-count={o.count}
                    className="inline-flex items-center gap-1.5"
                  >
                    <TypeBadge type={o.type} size="md" />
                    <span className="text-xs opacity-65">×{o.count} mons</span>
                  </span>
                ))}
              </div>
            )}
          </CoverageBlock>
        </div>
      )}
    </section>
  );
}

function CoverageBlock({
  title, children, ...rest
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
