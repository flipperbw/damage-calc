import type { MatchupResult } from '../calc/adapter';

interface Props {
  speed: MatchupResult['speed'];
  priorityWarning?: string;  // e.g. "Sucker Punch flips order"
}

export function SpeedDivider({ speed, priorityWarning }: Props) {
  // Under Trick Room, the slower mon acts first. attackerOutspeeds is already
  // the *effective* turn order (adapter applies the flip); the raw stat delta
  // is shown so the user can still see who is faster on the bare stat.
  const tr = speed.trickRoom;
  const fasterDelta = Math.abs(speed.delta);
  const arrow = speed.attackerOutspeeds
    ? `⚡ You move first${tr ? '' : ` (+${fasterDelta})`}`
    : speed.delta === 0
      ? `⚡ Speed tie`
      : `⚠ They move first${tr ? '' : ` (+${fasterDelta})`}`;
  const color = speed.attackerOutspeeds ? 'text-ok' : speed.delta === 0 ? 'text-warn' : 'text-danger';
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-card text-[11px] my-2 flex-wrap"
         style={{ background: 'linear-gradient(90deg, transparent, rgba(124,92,255,0.15), transparent)' }}>
      <span className={`font-bold ${color}`}>{arrow}</span>
      {tr && (
        <>
          <span className="opacity-40">·</span>
          <span className="text-accent font-semibold uppercase tracking-wider text-[10px]">⏱ Trick Room</span>
          <span className="opacity-50 text-[10px]">stats {speed.attackerSpe} / {speed.defenderSpe}</span>
        </>
      )}
      {priorityWarning && (
        <>
          <span className="opacity-40">·</span>
          <span className="text-priority font-semibold">⚠ {priorityWarning}</span>
        </>
      )}
    </div>
  );
}
