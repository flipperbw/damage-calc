import { useMemo } from 'react';
import { calcStat, MEGA_STONES } from '@smogon/calc';

import { GEN, toID } from '@/calc/gen';
import { natureMods } from '@/calc/helpers';
import { STAT_LABEL, STAT_ORDER, type StatID } from '@/types';

interface Props {
  species: string;
  nature: string;
  sps: Partial<Record<StatID, number>>;
  /** Held item; if it's a mega stone, an extra "Mega" column appears. */
  item?: string;
}

interface Row {
  stat: StatID;
  label: string;
  base: number;
  value: number;
  arrow: '▲' | '▼' | '-';
  megaBase?: number;
  megaValue?: number;
}

/**
 * Resolve a mega-forme name from base species + held item. Charizard /
 * Mewtwo / Raichu have X/Y formes inferred from the stone variant; the
 * rest get a -Mega suffix. Returns null when item isn't a mega stone or
 * the calc data doesn't ship the forme.
 */
export function megaFormeFromItem(species: string, item: string | undefined): string | null {
  if (!item) return null;
  const entry = (MEGA_STONES as Record<string, Record<string, string>>)[item];
  if (!entry) return null;
  // MEGA_STONES is keyed by stone, then by base species -> mega forme name.
  // The base mon may not match the stone; e.g. Charizardite X only megas
  // Charizard, not Garchomp. So look up the species directly.
  const forme = entry[species];
  if (!forme) return null;
  // Confirm the calc actually has the forme.
  if (!GEN.species.get(toID(forme) as any)) return null;
  return forme;
}

function arrowFor(stat: StatID, plus?: StatID, minus?: StatID): '▲' | '▼' | '-' {
  if (stat === 'hp') return '-';
  if (plus && minus && plus === minus) return '-'; // neutral nature
  if (stat === plus) return '▲';
  if (stat === minus) return '▼';
  return '-';
}

export function EffectiveStats({ species, nature, sps, item }: Props) {
  const rows: Row[] = useMemo(() => {
    const sp = GEN.species.get(toID(species) as any);
    const baseStats = sp?.baseStats;
    const { plus, minus } = natureMods(nature);

    const megaForme = megaFormeFromItem(species, item);
    const megaSp = megaForme ? GEN.species.get(toID(megaForme) as any) : null;
    const megaBaseStats = megaSp?.baseStats;

    return STAT_ORDER.map((id) => {
      const base = baseStats?.[id] ?? 0;
      const sp = sps[id] ?? 0;
      // Champions: gen 0; level passed but unused in the formula.
      const value = baseStats ? calcStat(GEN, id, base, 31, sp, 50, nature) : 0;
      // Fall back to the unmega'd base stat if the mega forme's data is
      // missing this stat (defensive against incomplete calc data); avoids
      // passing `undefined` into calcStat and producing NaN.
      const megaBase = typeof megaBaseStats?.[id] === 'number' ? megaBaseStats[id] : base;
      const megaValue = megaBaseStats != null ? calcStat(GEN, id, megaBase, 31, sp, 50, nature) : undefined;
      return {
        stat: id,
        label: STAT_LABEL[id],
        base,
        value,
        arrow: arrowFor(id, plus, minus),
        megaBase,
        megaValue,
      };
    });
  }, [species, nature, sps, item]);

  const showMega = rows.some((r) => r.megaValue !== undefined);

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <div className="text-xxs uppercase tracking-wider opacity-55">Effective Stats</div>
      </div>
      <div className={`grid ${showMega ? 'grid-cols-[auto_1fr_1fr_1fr]' : 'grid-cols-[auto_1fr_1fr]'} gap-x-3 gap-y-1 text-[14px] tabular-nums`}>
        <div />
        <div className="text-[10px] uppercase opacity-50 text-right">Base</div>
        <div className="text-[10px] uppercase opacity-50 text-right">Stat</div>
        {showMega && <div className="text-[10px] uppercase opacity-50 text-right border-l border-accent/40 pl-2">Mega</div>}
        {rows.map((r) => (
          <Cells key={r.stat} row={r} showMega={showMega} />
        ))}
      </div>
    </div>
  );
}

/**
 * Tier the stat magnitude into ok/neutral/warn/danger so the cell colour
 * scans at a glance. Thresholds tuned for L50 Champions: HP scales
 * differently (no nature mod, big base contribution) so it gets its own
 * narrower band; everything else uses a 4-tier scale where 80–129 is
 * "warn" (the 1-stage bands) and below 80 is "danger" (cripple territory).
 */
type Tier = 'ok' | 'neutral' | 'warn' | 'danger';

function tierFor(stat: StatID, value: number): Tier {
  if (stat === 'hp') {
    if (value >= 200) return 'ok';
    if (value >= 150) return 'neutral';
    return 'warn';
  }
  if (value >= 180) return 'ok';
  if (value >= 130) return 'neutral';
  if (value >= 80) return 'warn';
  return 'danger';
}

function tierClass(tier: Tier, bold: boolean): string {
  const weight = bold ? 'font-bold' : '';
  switch (tier) {
    case 'ok':
      return `${weight} text-ok`;
    case 'warn':
      return `${weight} text-warn`;
    case 'danger':
      return `${weight} text-danger`;
    case 'neutral':
      return `${weight} opacity-90`;
  }
}

function Cells({ row, showMega }: { row: Row; showMega: boolean }) {
  const arrowCls = row.arrow === '▲' ? 'text-ok' : row.arrow === '▼' ? 'text-danger' : 'opacity-40';
  const tier = tierFor(row.stat, row.value);
  // The "stat" column gets the strongest emphasis - it's the user-visible
  // post-nature, post-EV value. Bold for ok/neutral so the eye lands on
  // high numbers; warn/danger keep their colour to signal weakness.
  const valueCls = tierClass(tier, true);
  const megaTier = row.megaValue !== undefined ? tierFor(row.stat, row.megaValue) : null;
  const megaCls = megaTier ? tierClass(megaTier, true) : '';
  return (
    <>
      <div className="font-semibold flex items-center gap-1 opacity-90 text-[13px]">
        <span>{row.label}</span>
        <span className={`text-[11px] ${arrowCls}`}>{row.arrow}</span>
      </div>
      <div className="text-right opacity-45">{row.base}</div>
      <div className={`text-right ${valueCls}`}>{row.value}</div>
      {showMega && <div className={`text-right border-l border-accent/40 pl-2 ${megaCls}`}>{row.megaValue !== undefined ? row.megaValue : '-'}</div>}
    </>
  );
}
