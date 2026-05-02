import { describe, it, expect } from 'vitest';
import { migrate, CURRENT_VERSION } from './migrations';

describe('migrate', () => {
  it('returns input unchanged at current version', () => {
    const state = { version: CURRENT_VERSION, state: { teams: [] } };
    expect(migrate(state)).toEqual(state);
  });

  it('throws on a future version', () => {
    expect(() => migrate({ version: CURRENT_VERSION + 1, state: {} } as any))
      .toThrow(/future/i);
  });

  it('returns null on totally invalid input', () => {
    expect(migrate(null as any)).toBeNull();
    expect(migrate({} as any)).toBeNull();
  });
});
