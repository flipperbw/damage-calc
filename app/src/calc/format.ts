import type { SavedMon } from '../types';

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
    const pct = Math.floor(parseFloat(chance[1]));
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
