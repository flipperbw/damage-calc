import { Generations, toID } from '@smogon/calc';
import type { Format, SavedMon, ThreatList } from '../types';
import { defaultOpponentMon } from '../store/factories';
import { uuid } from '../util/uuid';

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
  name: string;
  format: Format | 'any';
  entries: SeedEntry[];
}

// Curated lists. These are the source of truth for the v4 migration's seed
// state. Order is preserved (used in the picker UI).
//
// Some entries specify a `mega` evolution + the corresponding Mega Stone.
// `buildSeedThreatLists` validates each item against calc's data and silently
// drops the override when the item isn't known — the mon still gets the
// `mega` flag so it shows as Mega-evolved, just without an explicit item set.
const SPECS: SeedSpec[] = [
  {
    name: 'Top Threats — Singles',
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
    name: 'Top Threats — Doubles / VGC',
    format: 'doubles',
    entries: [
      { species: 'Incineroar' },
      { species: 'Sneasler' },
      { species: 'Garchomp' },
      { species: 'Kangaskhan' },
      { species: 'Floette-Eternal' },
      { species: 'Kingambit' },
      { species: 'Pelipper' },
      { species: 'Rillaboom' },
    ],
  },
  {
    name: 'Top Megas',
    format: 'any',
    entries: [
      { species: 'Charizard', mega: 'mega-y', item: 'Charizardite Y' },
      { species: 'Gengar', mega: 'mega', item: 'Gengarite' },
      { species: 'Delphox', mega: 'mega', item: 'Delphoxite' },
      { species: 'Greninja', mega: 'mega', item: 'Greninjite' },
      // Hawlucha's mega item in calc data is "Hawluchanite", not "Hawluchite".
      // The validator below would drop an unknown item; we use the correct
      // name explicitly so the mega has its stone set.
      { species: 'Hawlucha', mega: 'mega', item: 'Hawluchanite' },
      { species: 'Garchomp', mega: 'mega', item: 'Garchompite' },
    ],
  },
  {
    name: 'Most-Used',
    format: 'any',
    entries: [
      { species: 'Incineroar' },
      { species: 'Kingambit' },
      { species: 'Garchomp' },
    ],
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
  // forme — the user can add an item later if needed.
  const item =
    entry.item && itemExists(entry.item) ? entry.item : base.item;
  return { ...base, mega: entry.mega, item };
}

// Module-load-time warn dedup: we only want to log a given missing species
// once per session, no matter how many seed lists reference it.
const warnedMissingSpecies = new Set<string>();

export function buildSeedThreatLists(): ThreatList[] {
  const now = Date.now();
  return SPECS.map(spec => {
    const validEntries = spec.entries.filter(e => {
      if (speciesExists(e.species)) return true;
      if (!warnedMissingSpecies.has(e.species)) {
        warnedMissingSpecies.add(e.species);
        // eslint-disable-next-line no-console
        console.warn(
          `seed-threats: dropping "${e.species}" from "${spec.name}" — species not found in calc gen 0`,
        );
      }
      return false;
    });
    return {
      id: uuid(),
      name: spec.name,
      format: spec.format,
      mons: validEntries.map(entryToMon),
      isSeed: true,
      createdAt: now,
      updatedAt: now,
    };
  });
}
