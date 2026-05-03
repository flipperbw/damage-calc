import { useEffect, useMemo, useRef, useState } from 'react';

import { calculateMatchup, type MoveResult } from '@/calc/adapter';
import { PickerShell } from '@/components/pickers/PickerShell';
import { TypeBadge } from '@/components/TypeBadge';
import { spriteUrl } from '@/data/sprites';
import { emptyField } from '@/store/factories';
import type { SavedMon, Team, ThreatList } from '@/types';

interface CellInfo {
  /** Best move's max % (used for the cell label and color tier). */
  pct: number;
  /** Best move's min % - shown in the drill-down range. */
  pctLow: number;
  bestMove: MoveResult | null;
  damageLow: number;
  damageHigh: number;
  /** Calc's koChance().text - e.g. "guaranteed OHKO" or "44% chance to 2HKO". */
  koText: string;
}

interface Props {
  team: Team | null;
  threatList: ThreatList | null;
}

/**
 * N×M damage % grid: each row is one of your mons, each column is a threat
 * mon. The cell value is the *best-case max* (`Math.max` over each move's
 * percentRange[1]) - that's the most optimistic OHKO read for the matchup.
 *
 * Memoised on team + threat-list ids/updatedAt so we don't recompute the
 * full grid every time an unrelated store slice (notation toggle, recent
 * opponents …) changes.
 */
export function MatchupMatrix({ team, threatList }: Props) {
  // We don't take live `field` from the store on purpose - the spec says use
  // the default empty field state so the matchup matrix is a stable readout
  // independent of whatever the user has the field set to in BattleScreen.
  const fallbackField = useMemo(() => emptyField(), []);

  const yourMons = team?.mons ?? [];
  const threats = threatList?.mons ?? [];

  // Memo key encodes:
  //   - team id + updatedAt (covers any mon edit)
  //   - threat list id + updatedAt
  // We deliberately don't depend on individual mon objects - the team's
  // updatedAt bumps whenever upsertMon/removeMon fires.
  const grid = useMemo<CellInfo[][]>(() => {
    if (yourMons.length === 0 || threats.length === 0) return [];
    return yourMons.map((you) => threats.map((threat) => bestCellInfo(you, threat, fallbackField)));
  }, [team?.id, team?.updatedAt, threatList?.id, threatList?.updatedAt, fallbackField]);

  // Cell tap → drill-down sheet showing the best move's full range and
  // KO chance text, plus the species names so the user knows which side
  // of the matrix they're on.
  const [detail, setDetail] = useState<{
    you: SavedMon;
    threat: SavedMon;
    cell: CellInfo;
  } | null>(null);

  // Sticky-row-label collapse: as the user scrolls horizontally, fade the
  // species name down so only the sprite is left. Frees a chunk of width
  // when the user is reading the rightmost columns and doesn't need the
  // name anymore.
  const scrollerRef = useRef<HTMLDivElement>(null);
  // 0 -> fully expanded, 1 -> fully collapsed. Tied to scrollLeft / 80px.
  const [collapse, setCollapse] = useState(0);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      // 0..80px scroll → 0..1 collapse fraction. Clamped at the edges.
      const c = Math.max(0, Math.min(1, el.scrollLeft / 80));
      setCollapse(c);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [yourMons.length, threats.length]);

  return (
    <section className="mb-5" data-testid="matchup-matrix">
      <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
        <h3 className="text-base font-bold">Matchup matrix</h3>
        <span className="text-[10px] opacity-55 italic shrink-0">best move's max-roll % · tap a cell for the full breakdown</span>
      </div>

      {!team || !threatList ? (
        <div className="bg-surface border border-surface-hi rounded-card p-4 text-sm opacity-65 italic">
          Pick a team and a threat list to see matchups.
        </div>
      ) : yourMons.length === 0 ? (
        <div className="bg-surface border border-surface-hi rounded-card p-4 text-sm opacity-65 italic">Your selected team has no Pokémon.</div>
      ) : threats.length === 0 ? (
        <div className="bg-surface border border-surface-hi rounded-card p-4 text-sm opacity-65 italic">The selected threat list has no Pokémon.</div>
      ) : (
        <div ref={scrollerRef} className="overflow-x-auto border border-surface-hi rounded-card">
          <table className="border-collapse text-xs" data-testid="matrix-table">
            <thead>
              <tr>
                {/* Sticky-left header cell. Width animates with the row
                    label below — they share the same min/max width so the
                    column collapse stays aligned. */}
                <th
                  className="sticky left-0 bg-surface-solid z-10 p-1.5 text-left text-text-mute font-medium border-r border-surface-hi"
                  style={{ width: collapsedWidth(collapse) }}
                />
                {threats.map((threat) => (
                  <th key={threat.id} className="p-1.5 font-medium text-center min-w-[56px]">
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
                  <td
                    className="sticky left-0 bg-surface-solid z-10 p-1.5 border-t border-r border-surface-hi"
                    style={{ width: collapsedWidth(collapse) }}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <img src={spriteUrl(you.species)} className="w-7 h-7 object-contain shrink-0" />
                      <span
                        className="text-[11px] truncate"
                        style={{
                          maxWidth: `${(1 - collapse) * 110}px`,
                          opacity: 1 - collapse,
                          transition: 'max-width 80ms linear, opacity 80ms linear',
                        }}
                      >
                        {you.species}
                      </span>
                    </div>
                  </td>
                  {threats.map((threat, j) => {
                    const cell = grid[i]?.[j] ?? emptyCell();
                    return <Cell key={threat.id} cell={cell} onTap={() => setDetail({ you, threat, cell })} />;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DetailSheet info={detail} onClose={() => setDetail(null)} />
    </section>
  );
}

function Cell({ cell, onTap }: { cell: CellInfo; onTap: () => void }) {
  const { cls, label } = cellStyle(cell.pct);
  return (
    <td className="p-1.5 border-t border-surface-hi text-center">
      <button
        type="button"
        onClick={onTap}
        aria-label="Show matchup details"
        className={`inline-flex items-center justify-center w-full min-w-[44px] py-1 rounded font-semibold ${cls}`}
        data-pct={cell.pct}
      >
        {label}
      </button>
    </td>
  );
}

function DetailSheet({ info, onClose }: { info: { you: SavedMon; threat: SavedMon; cell: CellInfo } | null; onClose: () => void }) {
  if (!info) return null;
  const { you, threat, cell } = info;
  return (
    <PickerShell open={!!info} onClose={onClose}>
      <div className="px-1">
        <div className="flex items-center gap-2 mb-3">
          <span className="font-bold">{you.species}</span>
          <span className="opacity-60">→</span>
          <span className="font-bold">{threat.species}</span>
        </div>

        {!cell.bestMove ? (
          <p className="text-sm opacity-65 italic">
            {you.species} has no damaging moves that hit {threat.species}.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <TypeBadge type={cell.bestMove.type} />
              <span className="font-semibold">{cell.bestMove.moveName}</span>
              <span className="text-[10px] uppercase tracking-wider opacity-55 ml-auto">Best move</span>
            </div>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm mb-2">
              <dt className="opacity-60">% of HP (range)</dt>
              <dd className="tabular-nums font-semibold text-right">
                {cell.pctLow}–{cell.pct}%
              </dd>
              <dt className="opacity-60">Damage</dt>
              <dd className="tabular-nums text-right">
                {cell.damageLow}–{cell.damageHigh}
              </dd>
              <dt className="opacity-60">KO chance</dt>
              <dd className="text-right text-[12px]">{cell.koText || '-'}</dd>
            </dl>

            <div className="text-[10px] opacity-50 italic mt-3">
              The matrix cell shows the upper bound (best move at max damage roll) against the threat's full HP, neutral field. A 100%+ cell means the
              move's max roll exceeds the target's HP - likely OHKO when the roll lands high; the KO chance row shows the actual odds.
            </div>
          </>
        )}
      </div>
    </PickerShell>
  );
}

function emptyCell(): CellInfo {
  return { pct: 0, pctLow: 0, bestMove: null, damageLow: 0, damageHigh: 0, koText: '' };
}

/**
 * Sticky-column width interpolated by the scroll-fraction collapse value.
 *   collapse = 0 → 150px (sprite + name comfortably fit)
 *   collapse = 1 → 44px  (just the sprite)
 */
function collapsedWidth(collapse: number): string {
  const wide = 150;
  const narrow = 44;
  return `${narrow + (1 - collapse) * (wide - narrow)}px`;
}

function cellStyle(pct: number): { cls: string; label: string } {
  if (pct <= 0) {
    // Empty mon (no moves) or fully-immune. Don't shout - render dash.
    return { cls: 'bg-surface text-text-mute', label: '-' };
  }
  if (pct >= 100) return { cls: 'bg-danger/40 text-white', label: `${pct}%` };
  if (pct >= 50) return { cls: 'bg-warn/35 text-black', label: `${pct}%` };
  if (pct >= 34) return { cls: 'bg-priority/30 text-text', label: `${pct}%` };
  return { cls: 'bg-surface text-text-mute', label: `${pct}%` };
}

/**
 * For one (you × threat) pair, run the calc and return the best move's
 * full info - used both for the cell label (max %) and for the drill-down
 * detail sheet (range, raw damage, KO text). Returns an empty cell when
 * the attacker has no damaging moves or when the calc throws.
 */
function bestCellInfo(you: SavedMon, threat: SavedMon, field: ReturnType<typeof emptyField>): CellInfo {
  try {
    const res = calculateMatchup(you, threat, field);
    let best: MoveResult | null = null;
    for (const m of res.attackerMoves) {
      if (!m.moveName || m.isStatus) continue;
      if (!best || m.percentRange[1] > best.percentRange[1]) best = m;
    }
    if (!best) return emptyCell();
    return {
      pct: best.percentRange[1],
      pctLow: best.percentRange[0],
      bestMove: best,
      damageLow: best.damageRange[0],
      damageHigh: best.damageRange[1],
      koText: best.koChanceText,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`MatchupMatrix: calc threw for ${you.species} vs ${threat.species}`, err);
    return emptyCell();
  }
}
