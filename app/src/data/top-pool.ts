import { Generations, toID } from '@smogon/calc';

const GEN = Generations.get(0);

/**
 * One candidate species the suggestion engine can recommend. The `types`
 * tuple is snapshotted from calc at module load so consumers don't have to
 * re-query the species DB on every score pass.
 */
export interface TopPoolEntry {
  species: string;
  /** STAB types from calc — derived once at module load. */
  types: readonly string[];
}

// Curated list of candidate species. Every entry has been verified against
// calc's Champions legal list (calc/src/data/species.ts ChampionsLegal). In
// dev mode `buildTopPool` THROWS if a candidate is missing — silent drops
// would shrink the suggestion universe without anyone noticing.
//
// Champions doesn't include several popular VGC mons (Heatran, Ferrothorn,
// Magnezone, Rillaboom, Mawile, Urshifu, Tapu*) — only species that are
// part of the Champions-legal subset are listed below.
const CANDIDATE_NAMES: readonly string[] = [
  // Top S-tier offensive
  'Garchomp',
  'Sneasler',
  'Pelipper',
  'Charizard',
  'Primarina',
  'Kangaskhan',
  'Floette-Eternal',
  'Incineroar',
  'Kingambit',
  'Greninja',
  'Gengar',
  'Delphox',
  'Hawlucha',
  // Common defensive / coverage staples
  'Toxapex',
  'Clefable',
  'Skarmory',
  'Tyranitar',
  'Excadrill',
  // Aegislash exists in Champions only as its formes; the Shield (defensive
  // stance) is the canonical reference.
  'Aegislash-Shield',
  // Versatile picks that round out coverage
  'Volcarona',
  'Mamoswine',
  'Rotom-Wash',
  'Hydreigon',
  'Gardevoir',
  'Conkeldurr',
  'Dragapult',
];

function buildTopPool(): readonly TopPoolEntry[] {
  const out: TopPoolEntry[] = [];
  const missing: string[] = [];
  for (const name of CANDIDATE_NAMES) {
    const sp = GEN.species.get(toID(name) as any);
    if (!sp) {
      missing.push(name);
      continue;
    }
    const types = (sp.types as readonly string[] | undefined) ?? [];
    out.push({ species: sp.name, types: [...types] });
  }
  if (missing.length > 0) {
    const msg = `top-pool: ${missing.length} candidate species missing from calc gen 0: ${missing.join(', ')}`;
    // In dev/test, fail loudly so a refactor that breaks calc-data lookup
    // doesn't silently shrink the suggestion pool. In production, downgrade
    // to a console.error so a stale-data load doesn't take the app down.
    // eslint-disable-next-line no-console
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) {
      throw new Error(msg);
    } else {
      // eslint-disable-next-line no-console
      console.error(msg);
    }
  }
  return out;
}

export const TOP_POOL: readonly TopPoolEntry[] = buildTopPool();
