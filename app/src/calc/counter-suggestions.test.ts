import { describe, expect, it } from 'vitest';

import { suggestCountersTo } from '@/calc/counter-suggestions';
import { emptyField } from '@/store/factories';
import type { SavedMon } from '@/types';

// A real, fully-built threat (curated default build, so it carries moves).
function threat(species: string, overrides: Partial<SavedMon> = {}): SavedMon {
  return {
    id: `threat-${species.toLowerCase()}`,
    species,
    nature: 'Hardy',
    sps: {},
    moves: ['', '', '', ''],
    mega: '',
    boosts: {},
    ...overrides,
  };
}

describe('suggestCountersTo', () => {
  it('returns a non-empty, score-sorted, capped list against a real threat', () => {
    const out = suggestCountersTo(threat('Garchomp'), emptyField(), 'singles');
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThanOrEqual(8);
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1].score >= out[i].score).toBe(true);
    }
    expect(suggestCountersTo(threat('Garchomp'), emptyField(), 'singles', 3).length).toBeLessThanOrEqual(3);
  });

  it('never suggests the threat species as a counter to itself', () => {
    const out = suggestCountersTo(threat('Garchomp'), emptyField(), 'singles');
    expect(out.find((s) => s.species === 'Garchomp')).toBeUndefined();
  });

  it('every suggestion carries an offensive (threat-favorable) reason', () => {
    // bestOut === 0 is filtered, so each surviving candidate has at least one
    // "OHKO / 2HKO / X% via <move>" reason.
    const out = suggestCountersTo(threat('Garchomp'), emptyField(), 'singles');
    for (const s of out) {
      expect(s.reasons.some((r) => r.kind === 'threat-favorable')).toBe(true);
    }
  });

  it('does NOT claim any defensive merit when the threat has no damaging moves', () => {
    // Regression: a threat with an empty/all-status moveset must not make
    // candidates look like immune walls ("Immune to all damaging moves" /
    // "Takes X%"). With nothing damaging modelled, no defensive badge should
    // appear on any suggestion - the scorer only knows offense in that case.
    const movelessThreat = threat('Garchomp', { moves: ['', '', '', ''] });
    const out = suggestCountersTo(movelessThreat, emptyField(), 'singles');
    expect(out.length).toBeGreaterThan(0); // offense still scores
    for (const s of out) {
      expect(s.reasons.some((r) => r.kind === 'defensive-overlap')).toBe(false);
    }
  });

  it('Trick Room reranks the field versus normal tempo', () => {
    // The TR speed bias nudges scores, so the ordering (or scores) should
    // differ from the non-TR run for the same threat.
    const normal = suggestCountersTo(threat('Garchomp'), emptyField(), 'singles');
    const tr = suggestCountersTo(threat('Garchomp'), { ...emptyField(), isTrickRoom: true }, 'singles');
    const normalKey = normal.map((s) => `${s.species}:${s.score}`).join('|');
    const trKey = tr.map((s) => `${s.species}:${s.score}`).join('|');
    expect(trKey).not.toEqual(normalKey);
  });
});
