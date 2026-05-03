import { useMemo } from 'react';
import { calculateMatchup } from '../../calc/adapter';
import { emptyField } from '../../store/factories';
import { spriteUrl } from '../../data/sprites';
import type { SavedMon, ThreatList, Team } from '../../types';

interface Props {
  team: Team | null;
  threatList: ThreatList | null;
}

/**
 * N×M damage % grid: each row is one of your mons, each column is a threat
 * mon. The cell value is the *best-case max* (`Math.max` over each move's
 * percentRange[1]) — that's the most optimistic OHKO read for the matchup.
 *
 * Memoised on team + threat-list ids/updatedAt so we don't recompute the
 * full grid every time an unrelated store slice (notation toggle, recent
 * opponents …) changes.
 */
export function MatchupMatrix({ team, threatList }: Props) {
  // We don't take live `field` from the store on purpose — the spec says use
  // the default empty field state so the matchup matrix is a stable readout
  // independent of whatever the user has the field set to in BattleScreen.
  const fallbackField = useMemo(() => emptyField(), []);

  const yourMons = team?.mons ?? [];
  const threats = threatList?.mons ?? [];

  // Memo key encodes:
  //   - team id + updatedAt (covers any mon edit)
  //   - threat list id + updatedAt
  // We deliberately don't depend on individual mon objects — the team's
  // updatedAt bumps whenever upsertMon/removeMon fires.
  const grid = useMemo<number[][]>(() => {
    if (yourMons.length === 0 || threats.length === 0) return [];
    return yourMons.map(you => threats.map(threat => bestPercent(you, threat, fallbackField)));
  }, [team?.id, team?.updatedAt, threatList?.id, threatList?.updatedAt, fallbackField]);

  // Get the notation just for accessibility — but we always render percent
  // here regardless. Damage cells in 48ths would be near-unreadable.
  return (
    <section className="mb-5" data-testid="matchup-matrix">
      <div className="flex items-baseline justify-between mb-2 gap-2">
        <h3 className="text-base font-bold">Matchup matrix</h3>
        <span className="text-[10px] opacity-50 italic shrink-0">
          % of opponent max HP · neutral field
        </span>
      </div>

      {!team || !threatList ? (
        <div className="bg-surface border border-surface-hi rounded-card p-4 text-sm opacity-65 italic">
          Pick a team and a threat list to see matchups.
        </div>
      ) : yourMons.length === 0 ? (
        <div className="bg-surface border border-surface-hi rounded-card p-4 text-sm opacity-65 italic">
          Your selected team has no Pokémon.
        </div>
      ) : threats.length === 0 ? (
        <div className="bg-surface border border-surface-hi rounded-card p-4 text-sm opacity-65 italic">
          The selected threat list has no Pokémon.
        </div>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1 border border-surface-hi rounded-card bg-surface">
          <table className="border-collapse text-xs" data-testid="matrix-table">
            <thead>
              <tr>
                <th className="sticky left-0 bg-surface z-10 p-1.5 text-left text-text-mute font-medium" />
                {threats.map(threat => (
                  <th
                    key={threat.id}
                    className="p-1.5 font-medium text-center min-w-[56px]"
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <img src={spriteUrl(threat.species)} className="w-7 h-7 object-contain" />
                      <span className="text-[10px] truncate max-w-[64px]">{threat.species}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {yourMons.map((you, i) => (
                <tr key={you.id}>
                  <td className="sticky left-0 bg-surface z-10 p-1.5 border-t border-surface-hi">
                    <div className="flex items-center gap-2 min-w-[120px] max-w-[160px]">
                      <img src={spriteUrl(you.species)} className="w-7 h-7 object-contain shrink-0" />
                      <span className="text-[11px] truncate">{you.species}</span>
                    </div>
                  </td>
                  {threats.map((threat, j) => (
                    <Cell key={threat.id} pct={grid[i]?.[j] ?? 0} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Cell({ pct }: { pct: number }) {
  const { cls, label } = cellStyle(pct);
  return (
    <td className="p-1.5 border-t border-surface-hi text-center">
      <span
        className={`inline-flex items-center justify-center w-full min-w-[44px] py-1 rounded font-semibold ${cls}`}
        data-pct={pct}
      >
        {label}
      </span>
    </td>
  );
}

function cellStyle(pct: number): { cls: string; label: string } {
  if (pct <= 0) {
    // Empty mon (no moves) or fully-immune. Don't shout — render dash.
    return { cls: 'bg-surface text-text-mute', label: '—' };
  }
  if (pct >= 100) return { cls: 'bg-danger/40 text-white', label: `${pct}%` };
  if (pct >= 50)  return { cls: 'bg-warn/35 text-black', label: `${pct}%` };
  if (pct >= 34)  return { cls: 'bg-priority/30 text-text', label: `${pct}%` };
  return { cls: 'bg-surface text-text-mute', label: `${pct}%` };
}

/**
 * For one (you × threat) pair, run the calc and return the highest
 * percentRange max across the four attacker moves. Returns 0 for an empty
 * moveset (defensive-only build) or when the calc throws — we'd rather show
 * "—" than crash the matrix.
 */
function bestPercent(
  you: SavedMon,
  threat: SavedMon,
  field: ReturnType<typeof emptyField>,
): number {
  try {
    const res = calculateMatchup(you, threat, field);
    let best = 0;
    for (const m of res.attackerMoves) {
      if (!m.moveName || m.isStatus) continue;
      if (m.percentRange[1] > best) best = m.percentRange[1];
    }
    return best;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`MatchupMatrix: calc threw for ${you.species} vs ${threat.species}`, err);
    return 0;
  }
}

