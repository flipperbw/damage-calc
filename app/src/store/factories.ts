import { getBuild, getBuildsForSpecies } from '@/data/setdex-champions';
import type { FieldState, SavedMon } from '@/types';
import { uuid } from '@/util/uuid';

export function emptyMon(species: string): SavedMon {
  return {
    id: uuid(),
    species,
    nature: 'Hardy',
    sps: {},
    moves: ['', '', '', ''],
    mega: '',
    boosts: {},
  };
}

export function emptyField(): FieldState {
  return { yourSide: {}, oppSide: {} };
}

/**
 * Build a SavedMon from a curated Champions build. Used by MonEditor and the
 * factories below; centralised here so the same translation logic lives in
 * one place.
 */
export function monFromBuild(species: string, buildName: string): SavedMon | null {
  const b = getBuild(species, buildName);
  if (!b) return null;
  return {
    id: uuid(),
    species,
    buildName,
    item: b.item,
    ability: b.ability,
    nature: b.nature,
    // Shallow-copy so multiple mons spawned from the same build don't alias
    // the SETDEX_CHAMPIONS object; future in-place edits stay isolated.
    sps: { ...b.sps },
    moves: [b.moves[0] ?? '', b.moves[1] ?? '', b.moves[2] ?? '', b.moves[3] ?? ''],
    // Pikalytics meta variants extracted from a mega forme carry their own
    // mega state (e.g. Charizard "Sweeper · Mega Y" → mega='mega-y'). Apply
    // it so picking that build flips the mon to the right forme; default '' for
    // non-mega builds and legacy SM/USUM sets that don't carry the flag.
    mega: b.mega ?? '',
    boosts: {},
  };
}

/**
 * Default opponent factory: when picking an opponent, pre-populate from the
 * first curated build (lowest-indexed entry), so the matchup is meaningful
 * without needing to manually configure moves/items. Falls back to emptyMon
 * when there are no curated builds for the species.
 */
export function defaultOpponentMon(species: string): SavedMon {
  const builds = getBuildsForSpecies(species);
  if (builds.length === 0) return emptyMon(species);
  const built = monFromBuild(species, builds[0]);
  return built ?? emptyMon(species);
}

/**
 * Default team-mon factory: when adding a brand-new mon to a team via the
 * empty-slot → species-picker flow, seed it with the first curated build so
 * the editor opens with stats/moves/item/ability/nature already populated
 * (rather than the "Custom"/0-stat blank). Falls back to emptyMon when there
 * are no curated builds.
 */
export function defaultTeamMon(species: string): SavedMon {
  const builds = getBuildsForSpecies(species);
  if (builds.length === 0) return emptyMon(species);
  const built = monFromBuild(species, builds[0]);
  return built ?? emptyMon(species);
}
