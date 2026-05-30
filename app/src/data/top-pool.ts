import { GEN, toID } from '@/calc/gen';
import { PIKALYTICS_TOP_POOL } from '@/data/generated/pikalytics-pool.generated';

/**
 * One candidate species the suggestion engine can recommend. The `types`
 * tuple is snapshotted from calc at module load so consumers don't have to
 * re-query the species DB on every score pass.
 */
export interface TopPoolEntry {
  species: string;
  /** STAB types from calc - derived once at module load. */
  types: readonly string[];
}

// Candidate species pool comes from Pikalytics's Champions VGC usage leader-
// board (top 60 by usage). Replaces the prior hand-curated list — the meta is
// the meta, and chasing it manually was always going to drift. Calc's gen-0
// Champions-legal subset is the constraint; species the scraper picks up but
// calc doesn't recognise (e.g. some Champions-exclusive megas not in calc's
// data) get silently dropped here, with a dev-mode error so the gap is visible.
function buildTopPool(): readonly TopPoolEntry[] {
  const out: TopPoolEntry[] = [];
  const missing: string[] = [];
  for (const entry of PIKALYTICS_TOP_POOL) {
    const sp = GEN.species.get(toID(entry.species) as any);
    if (!sp) {
      missing.push(entry.species);
      continue;
    }
    const types = (sp.types as readonly string[] | undefined) ?? [];
    out.push({ species: sp.name, types: [...types] });
  }
  if (missing.length > 0) {
    const msg = `top-pool: ${missing.length} Pikalytics species missing from calc gen 0: ${missing.join(', ')}`;
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
