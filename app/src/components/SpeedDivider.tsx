import type { MatchupResult } from '../calc/adapter';

interface Props {
  speed: MatchupResult['speed'];
  priorityWarning?: string;  // e.g. "Sucker Punch flips order"
}

export function SpeedDivider({ speed, priorityWarning }: Props) {
  const arrow = speed.attackerOutspeeds
    ? `⚡ You +${speed.delta}`
    : speed.delta === 0
      ? `⚡ Speed tie`
      : `⚠ They +${Math.abs(speed.delta)}`;
  const color = speed.attackerOutspeeds ? 'text-ok' : speed.delta === 0 ? 'text-warn' : 'text-danger';
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-card text-[11px] my-2"
         style={{ background: 'linear-gradient(90deg, transparent, rgba(124,92,255,0.15), transparent)' }}>
      <span className={`font-bold ${color}`}>{arrow}</span>
      {priorityWarning && (
        <>
          <span className="opacity-40">·</span>
          <span className="text-priority font-semibold">⚠ {priorityWarning}</span>
        </>
      )}
    </div>
  );
}
