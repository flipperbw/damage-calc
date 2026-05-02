import type { SavedMon, FieldState } from '../types';

export function emptyMon(species: string): SavedMon {
  return {
    id: crypto.randomUUID(),
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
