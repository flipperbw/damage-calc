import { useMemo } from 'react';
import { Generations, calcStat, MEGA_STONES, toID } from '@smogon/calc';
import type { StatID } from '../../types';

const GEN = Generations.get(0);

const STATS: { id: StatID; label: string }[] = [
  { id: 'hp',  label: 'HP'  },
  { id: 'atk', label: 'Atk' },
  { id: 'def', label: 'Def' },
  { id: 'spa', label: 'SpA' },
  { id: 'spd', label: 'SpD' },
  { id: 'spe', label: 'Spe' },
];

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
  arrow: '▲' | '▼' | '—';
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

/** True iff `item` is in the calc's MEGA_STONES table (any stone, any species). */
export function isMegaStone(item: string | undefined): boolean {
  if (!item) return false;
  return Object.prototype.hasOwnProperty.call(MEGA_STONES, item);
}

function natureMods(nature: string): { plus?: StatID; minus?: StatID } {
  const n = GEN.natures.get(toID(nature) as any);
  if (!n) return {};
  return { plus: n.plus as StatID | undefined, minus: n.minus as StatID | undefined };
}

function arrowFor(stat: StatID, plus?: StatID, minus?: StatID): '▲' | '▼' | '—' {
  if (stat === 'hp') return '—';
  if (plus && minus && plus === minus) return '—'; // neutral nature
  if (stat === plus) return '▲';
  if (stat === minus) return '▼';
  return '—';
}

export function EffectiveStats({ species, nature, sps, item }: Props) {
  const rows: Row[] = useMemo(() => {
    const sp = GEN.species.get(toID(species) as any);
    const baseStats = sp?.baseStats;
    const { plus, minus } = natureMods(nature);

    const megaForme = megaFormeFromItem(species, item);
    const megaSp = megaForme ? GEN.species.get(toID(megaForme) as any) : null;
    const megaBaseStats = megaSp?.baseStats;

    return STATS.map(({ id, label }) => {
      const base = baseStats?.[id] ?? 0;
      const sp = sps[id] ?? 0;
      // Champions: gen 0; level passed but unused in the formula.
      const value = baseStats ? calcStat(GEN, id, base, 31, sp, 50, nature) : 0;
      const megaBase = megaBaseStats?.[id];
      const megaValue = megaBaseStats != null
        ? calcStat(GEN, id, megaBase!, 31, sp, 50, nature)
        : undefined;
      return {
        stat: id,
        label,
        base,
        value,
        arrow: arrowFor(id, plus, minus),
        megaBase,
        megaValue,
      };
    });
  }, [species, nature, sps, item]);

  const showMega = rows.some(r => r.megaValue !== undefined);

  return (
    <div className="bg-surface/50 border border-surface-hi rounded-lg p-2.5">
      <div className="flex justify-between items-center mb-1.5">
        <div className="text-xxs uppercase tracking-wider opacity-55">Effective Stats</div>
        <div className="text-[9px] opacity-40">L50</div>
      </div>
      <div className={`grid ${showMega ? 'grid-cols-[auto_1fr_1fr_1fr]' : 'grid-cols-[auto_1fr_1fr]'} gap-x-2 gap-y-0.5 text-[11px] tabular-nums`}>
        <div />
        <div className="text-[9px] uppercase opacity-50 text-right">Base</div>
        <div className="text-[9px] uppercase opacity-50 text-right">Stat</div>
        {showMega && (
          <div className="text-[9px] uppercase opacity-50 text-right border-l border-accent/30 pl-1.5">
            Mega
          </div>
        )}
        {rows.map(r => (
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
    case 'ok': return `${weight} text-ok`;
    case 'warn': return `${weight} text-warn`;
    case 'danger': return `${weight} text-danger`;
    case 'neutral': return `${weight} opacity-90`;
  }
}

function Cells({ row, showMega }: { row: Row; showMega: boolean }) {
  const arrowCls =
    row.arrow === '▲' ? 'text-ok'
    : row.arrow === '▼' ? 'text-danger'
    : 'opacity-40';
  const tier = tierFor(row.stat, row.value);
  // The "stat" column gets the strongest emphasis — it's the user-visible
  // post-nature, post-EV value. Bold for ok/neutral so the eye lands on
  // high numbers; warn/danger keep their colour to signal weakness.
  const valueCls = tierClass(tier, true);
  const megaTier = row.megaValue !== undefined ? tierFor(row.stat, row.megaValue) : null;
  const megaCls = megaTier ? tierClass(megaTier, true) : '';
  return (
    <>
      <div className="font-bold flex items-center gap-1 opacity-80">
        <span>{row.label}</span>
        <span className={`text-[9px] ${arrowCls}`}>{row.arrow}</span>
      </div>
      <div className="text-right opacity-50">{row.base}</div>
      <div className={`text-right ${valueCls}`}>{row.value}</div>
      {showMega && (
        <div className={`text-right border-l border-accent/30 pl-1.5 ${megaCls}`}>
          {row.megaValue !== undefined ? row.megaValue : '—'}
        </div>
      )}
    </>
  );
}
