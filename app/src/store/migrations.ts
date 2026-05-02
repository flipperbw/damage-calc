import type { AppState } from '../types';

export const CURRENT_VERSION = 1;

export interface PersistedShape {
  version: number;
  state: AppState;
}

type Migrator = (s: any) => any;

// Add migrators when bumping CURRENT_VERSION.
const MIGRATORS: Record<number, Migrator> = {
  // 1: (s) => ({...s, somethingNew: defaultValue}),
};

export function migrate(input: any): PersistedShape | null {
  if (!input || typeof input !== 'object') return null;
  if (typeof input.version !== 'number' || !input.state) return null;
  if (input.version > CURRENT_VERSION) {
    throw new Error(`Persisted state is from a future version (${input.version})`);
  }
  let state = input.state;
  for (let v = input.version; v < CURRENT_VERSION; v++) {
    const fn = MIGRATORS[v + 1];
    if (fn) state = fn(state);
  }
  return { version: CURRENT_VERSION, state };
}
