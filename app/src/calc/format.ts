import type { SavedMon } from '@/types';

export type KoKind = 'ohko' | 'thko' | 'chance' | 'multi';
export interface KoTag {
  label: string;
  kind: KoKind;
}

export function koTagFromText(text: string): KoTag | null {
  if (!text) return null;
  const guaranteed = /guaranteed (OHKO|\dHKO)/.exec(text);
  if (guaranteed) {
    const label = guaranteed[1];
    return {
      label,
      kind: label === 'OHKO' ? 'ohko' : label === '2HKO' ? 'thko' : 'multi',
    };
  }
  const chance = /(\d+(?:\.\d+)?)% chance to (\dHKO|OHKO)/.exec(text);
  if (chance) {
    // Round UP so a 0.6% chance shows as "1% 4HKO", never "0%". Tiny
    // probabilities are still surfaced; users care that there's any chance
    // at all, not the precise odds.
    const pct = Math.ceil(parseFloat(chance[1]));
    return { label: `${pct}% ${chance[2]}`, kind: 'chance' };
  }
  return null;
}

export function priorityFlag(priority: number): string | null {
  if (priority === 0) return null;
  return priority > 0 ? `+${priority}` : `${priority}`;
}

export function sturdyWarning(defender: SavedMon): boolean {
  if (defender.ability !== 'Sturdy') return false;
  return defender.currentHp === undefined;
}

export interface EffectivenessBadge {
  label: string;
  /** Tailwind utility classes used to colour the badge. */
  cls: string;
}

/**
 * Map a type-effectiveness multiplier to a renderable badge. Status moves
 * and neutral (1x) hits return null so the row doesn't accumulate noise.
 */
export function effectivenessBadge(multiplier: number, isStatus: boolean): EffectivenessBadge | null {
  if (isStatus) return null;
  if (multiplier === 1) return null;
  if (multiplier === 0) return { label: 'Immune', cls: 'bg-black/40 text-white/40 italic' };
  if (multiplier >= 4) return { label: '4×', cls: 'bg-danger text-white' };
  if (multiplier >= 2) return { label: '2×', cls: 'bg-priority text-black' };
  if (multiplier <= 0.25) return { label: '¼×', cls: 'bg-black/40 text-white/40' };
  if (multiplier <= 0.5) return { label: '½×', cls: 'bg-black/40 text-white/60' };
  return null;
}

/** Class string for a KO-tag badge. OHKO/2HKO/chance/multi each get a distinct color. */
export function koBadge(kind: KoKind): { cls: string } {
  switch (kind) {
    case 'ohko':
      return { cls: 'bg-danger text-white' };
    case 'thko':
      return { cls: 'bg-warn text-black' };
    case 'multi':
    case 'chance':
      return { cls: 'bg-black/40 text-white' };
  }
}

export type MoveCategory = 'Physical' | 'Special' | 'Status';

/**
 * Short label + class string for a move's category. The class string includes
 * the `border` utility along with the color border, so callers don't need to
 * prepend their own. Callers that want the long label ("Physical") should use
 * the category string directly; the short label is for compact rows.
 */
export function categoryBadge(category: MoveCategory): { cls: string; label: string } {
  if (category === 'Physical') return { cls: 'border bg-danger/15 text-danger border-danger/30', label: 'Phys' };
  if (category === 'Special') return { cls: 'border bg-accent/15 text-accent border-accent/30', label: 'Spec' };
  return { cls: 'border bg-white/5 text-text-mute border-surface-hi', label: 'Stat' };
}
