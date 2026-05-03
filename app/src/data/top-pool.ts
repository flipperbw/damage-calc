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

// Curated list of candidate species. Pulled from the Phase 2 meta research
// (S-tier offensive picks) plus classic coverage staples (Heatran, Toxapex,
// Clefable, Ferrothorn) that round out type coverage even when not strictly
// top-meta.
//
// Names are validated against calc's gen-0 species DB at module init via
// `buildTopPool` below; any species the calc doesn't know is logged and
// dropped, so the suggestion engine never references a phantom entry.
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
  'Rillaboom',
  'Greninja',
  'Gengar',
  'Delphox',
  'Hawlucha',
  // Common defensive / coverage staples
  'Heatran',
  'Toxapex',
  'Clefable',
  'Ferrothorn',
  'Skarmory',
  'Tyranitar',
  'Excadrill',
  'Magnezone',
  // Versatile picks that round out coverage
  'Volcarona',
  'Mamoswine',
  'Rotom-Wash',
  'Hydreigon',
  'Gardevoir',
  'Conkeldurr',
  'Aegislash',
  'Dragapult',
];

function buildTopPool(): readonly TopPoolEntry[] {
  const out: TopPoolEntry[] = [];
  for (const name of CANDIDATE_NAMES) {
    const sp = GEN.species.get(toID(name) as any);
    if (!sp) {
      // Don't throw — surface the miss in the console and keep going. A
      // missing-from-calc entry is a data issue, not a runtime fault.
      // eslint-disable-next-line no-console
      console.warn(`top-pool: skipping "${name}" — not found in calc gen 0`);
      continue;
    }
    const types = (sp.types as readonly string[] | undefined) ?? [];
    out.push({ species: sp.name, types: [...types] });
  }
  return out;
}

export const TOP_POOL: readonly TopPoolEntry[] = buildTopPool();
