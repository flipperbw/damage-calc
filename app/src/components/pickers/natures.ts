export interface NatureEntry {
  name: string;
  plus?: string;   // stat id like 'atk'
  minus?: string;
}

export interface NatureGroup {
  label: string;
  entries: NatureEntry[];
}

const ORDER: { plus: string; label: string }[] = [
  { plus: 'atk', label: '+Atk' },
  { plus: 'def', label: '+Def' },
  { plus: 'spa', label: '+SpA' },
  { plus: 'spd', label: '+SpD' },
  { plus: 'spe', label: '+Spe' },
];

const MINUS_ORDER = ['atk', 'def', 'spa', 'spd', 'spe'];

/**
 * Group natures by stat-modified bucket so the picker is scannable. Order:
 *   - +Atk (sorted by hindered stat)
 *   - +Def
 *   - +SpA
 *   - +SpD
 *   - +Spe
 *   - Neutral (Hardy / Docile / Bashful / Quirky / Serious)
 *
 * Within each non-neutral bucket, entries are sorted by minus-stat in the
 * canonical Atk/Def/SpA/SpD/Spe order. Neutrals are alphabetical.
 */
export function groupNatures(all: NatureEntry[]): NatureGroup[] {
  const groups: NatureGroup[] = ORDER.map(o => ({ label: o.label, entries: [] }));
  const neutral: NatureEntry[] = [];

  for (const n of all) {
    // Neutral natures: calc reports them with plus === minus (e.g. Hardy is
    // +atk/-atk). Treat those, and entries with no plus/minus at all, as neutral.
    if (!n.plus || !n.minus || n.plus === n.minus) {
      neutral.push(n);
      continue;
    }
    const idx = ORDER.findIndex(o => o.plus === n.plus);
    if (idx >= 0) groups[idx].entries.push(n);
  }

  for (const g of groups) {
    g.entries.sort((a, b) => {
      const ai = MINUS_ORDER.indexOf(a.minus ?? '');
      const bi = MINUS_ORDER.indexOf(b.minus ?? '');
      return ai - bi;
    });
  }

  neutral.sort((a, b) => a.name.localeCompare(b.name));

  return [...groups, { label: 'Neutral', entries: neutral }].filter(g => g.entries.length > 0);
}
