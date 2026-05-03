import { Generations, toID } from '@smogon/calc';

import { defaultOpponentMon } from '@/store/factories';
import type { Format, SavedMon, SeedKey, ThreatList } from '@/types';
import { uuid } from '@/util/uuid';

// Champions runs on calc gen 0. Use it to verify items / formes exist before
// applying them, so a typo or a missing-from-calc Mega item doesn't crash the
// migration or pin a Pokemon to an item that calc can't price.
const GEN = Generations.get(0);

type MegaKind = 'mega' | 'mega-x' | 'mega-y';

interface SeedEntry {
  species: string;
  mega?: MegaKind;
  /** Optional Mega item override (e.g. "Charizardite Y"). */
  item?: string;
}

interface SeedSpec {
  /** Stable identifier - survives renames so Suggestions can pin the
   *  Most-Used list independent of display name. */
  seedKey: SeedKey;
  name: string;
  format: Format | 'any';
  entries: SeedEntry[];
}

// Curated lists. These are the source of truth for the v4 migration's seed
// state. Order is preserved (used in the picker UI).
//
// Some entries specify a `mega` evolution + the corresponding Mega Stone.
// `buildSeedThreatLists` validates each item against calc's data and silently
// drops the override when the item isn't known - the mon still gets the
// `mega` flag so it shows as Mega-evolved, just without an explicit item set.
const SPECS: SeedSpec[] = [
  {
    seedKey: 'singles',
    name: 'Top Threats - Singles',
    format: 'singles',
    entries: [
      { species: 'Garchomp' },
      { species: 'Sneasler' },
      { species: 'Pelipper' },
      { species: 'Charizard', mega: 'mega-y', item: 'Charizardite Y' },
      { species: 'Primarina' },
      { species: 'Kangaskhan' },
      { species: 'Floette-Eternal' },
    ],
  },
  {
    seedKey: 'doubles',
    name: 'Top Threats - Doubles / VGC',
    format: 'doubles',
    entries: [
      { species: 'Incineroar' },
      { species: 'Sneasler' },
      { species: 'Garchomp' },
      { species: 'Kangaskhan' },
      { species: 'Floette-Eternal' },
      { species: 'Kingambit' },
      { species: 'Pelipper' },
      // Rillaboom is not in calc's Champions legal list; Aegislash-Shield
      // stands in as a popular Doubles threat that *is* legal.
      { species: 'Aegislash-Shield' },
    ],
  },
  {
    seedKey: 'most-used',
    name: 'Most-Used',
    format: 'any',
    entries: [{ species: 'Incineroar' }, { species: 'Kingambit' }, { species: 'Garchomp' }],
  },
];

function itemExists(name: string): boolean {
  if (!name) return false;
  return GEN.items.get(toID(name) as any) !== undefined;
}

function speciesExists(name: string): boolean {
  if (!name) return false;
  return GEN.species.get(toID(name) as any) !== undefined;
}

function entryToMon(entry: SeedEntry): SavedMon {
  const base = defaultOpponentMon(entry.species);
  if (!entry.mega) return base;
  // Apply mega flag; only pin the item override if calc knows about it. If
  // the item is missing we still keep `mega` set so the UI shows the mega
  // forme - the user can add an item later if needed.
  const item = entry.item && itemExists(entry.item) ? entry.item : base.item;
  return { ...base, mega: entry.mega, item };
}

// Module-load-time warn dedup: we only want to log a given missing species
// once per session, no matter how many seed lists reference it.
const warnedMissingSpecies = new Set<string>();

/**
 * The set of seedKeys this build currently ships. The store uses this in
 * `ensureSeedThreatLists` to drop obsolete seeds (e.g. "megas" after that
 * list was removed from the spec) so users on persisted state don't see
 * stale seed lists they can't delete.
 */
export const CURRENT_SEED_KEYS: readonly SeedKey[] = SPECS.map((s) => s.seedKey);

export function buildSeedThreatLists(): ThreatList[] {
  const now = Date.now();
  const allMissing: string[] = [];
  const lists = SPECS.map((spec) => {
    const validEntries = spec.entries.filter((e) => {
      if (speciesExists(e.species)) return true;
      if (!warnedMissingSpecies.has(e.species)) {
        warnedMissingSpecies.add(e.species);
        // eslint-disable-next-line no-console
        console.error(`seed-threats: dropping "${e.species}" from "${spec.name}" - species not found in calc gen 0`);
      }
      allMissing.push(e.species);
      return false;
    });
    return {
      id: uuid(),
      seedKey: spec.seedKey,
      name: spec.name,
      format: spec.format,
      mons: validEntries.map(entryToMon),
      isSeed: true,
      createdAt: now,
      updatedAt: now,
    };
  });
  // In dev, fail loudly so a refactor or stale spec doesn't silently shrink
  // a curated list. In production, fall through with the warnings above so
  // a stale build still ships something usable.
  if (allMissing.length > 0 && typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) {
    throw new Error(`seed-threats: ${allMissing.length} entries dropped: ${allMissing.join(', ')}`);
  }
  return lists;
}
