import { describe, it, expect } from 'vitest';
import { groupNatures, type NatureEntry } from './natures';

const N = (name: string, plus?: string, minus?: string): NatureEntry => ({ name, plus, minus });

describe('groupNatures', () => {
  it('puts +Atk natures first, then +Def, +SpA, +SpD, +Spe', () => {
    const out = groupNatures([
      N('Adamant', 'atk', 'spa'),
      N('Bold', 'def', 'atk'),
      N('Modest', 'spa', 'atk'),
      N('Calm', 'spd', 'atk'),
      N('Timid', 'spe', 'atk'),
      N('Hardy'),
    ]);
    const labels = out.map(g => g.label);
    expect(labels).toEqual(['+Atk', '+Def', '+SpA', '+SpD', '+Spe', 'Neutral']);
  });

  it('places neutral natures (no plus/minus) into the Neutral bucket', () => {
    const out = groupNatures([
      N('Hardy'),
      N('Docile'),
      N('Adamant', 'atk', 'spa'),
    ]);
    const neutral = out.find(g => g.label === 'Neutral')!;
    expect(neutral.entries.map(n => n.name)).toEqual(['Docile', 'Hardy']);
  });

  it('within a +stat bucket, sorts by hindered stat (Atk/Def/SpA/SpD/Spe)', () => {
    // All +Atk: sort by minus (def/spa/spd/spe).
    const out = groupNatures([
      N('Naughty', 'atk', 'spd'),
      N('Adamant', 'atk', 'spa'),
      N('Lonely', 'atk', 'def'),
      N('Brave', 'atk', 'spe'),
    ]);
    const atk = out.find(g => g.label === '+Atk')!;
    expect(atk.entries.map(n => n.name)).toEqual([
      'Lonely',  // -def
      'Adamant', // -spa
      'Naughty', // -spd
      'Brave',   // -spe
    ]);
  });

  it('drops empty groups', () => {
    const out = groupNatures([N('Adamant', 'atk', 'spa')]);
    // No neutrals or other +stat — only +Atk should remain.
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe('+Atk');
  });
});
