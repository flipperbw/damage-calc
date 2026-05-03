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
    sps: b.sps,
    moves: [b.moves[0] ?? '', b.moves[1] ?? '', b.moves[2] ?? '', b.moves[3] ?? ''],
    mega: '',
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
