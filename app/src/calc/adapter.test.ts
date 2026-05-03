import { describe, it, expect, beforeAll } from 'vitest';
import { calculateMatchup, typeEffectiveness } from './adapter';
import { preloadPkmn } from '../data/pkmn';
import type { SavedMon, FieldState } from '../types';

const blankField = (): FieldState => ({ yourSide: {}, oppSide: {} });

const garchomp: SavedMon = {
  id: 'a',
  species: 'Garchomp',
  ability: 'Rough Skin',
  nature: 'Jolly',
  sps: { atk: 32, spe: 32 },
  moves: ['Earthquake', 'Outrage', 'Stone Edge', 'Fire Fang'],
  mega: '',
  boosts: {},
};

// Tyranitar (Rock/Dark) — Earthquake is 2× super effective; Outrage neutral.
// Used as the primary defender so the standard moveset all produces non-zero damage.
const tyranitar: SavedMon = {
  id: 'b',
  species: 'Tyranitar',
  item: 'Leftovers',
  ability: 'Sand Stream',
  nature: 'Careful',
  sps: { hp: 32, spd: 32 },
  moves: ['Stone Edge', 'Crunch', 'Stealth Rock', 'Earthquake'],
  mega: '',
  boosts: {},
};

// Skarmory (Steel/Flying) — used only for the Sun-weather test where Charizard
// hits with Flamethrower (4× SE). Item omitted (Rocky Helmet isn't in the
// Champions item list).
const skarmory: SavedMon = {
  id: 'c',
  species: 'Skarmory',
  ability: 'Sturdy',
  nature: 'Impish',
  sps: { hp: 32, def: 32 },
  moves: ['Brave Bird', 'Stealth Rock', 'Roost', 'Whirlwind'],
  mega: '',
  boosts: {},
};

describe('calculateMatchup', () => {
  it('returns a result per attacker move', () => {
    const m = calculateMatchup(garchomp, tyranitar, blankField());
    expect(m.attackerMoves).toHaveLength(4);
    expect(m.defenderMoves).toHaveLength(4);
  });

  it('Earthquake hits Tyranitar for damage', () => {
    const m = calculateMatchup(garchomp, tyranitar, blankField());
    const eq = m.attackerMoves.find(r => r.moveName === 'Earthquake')!;
    expect(eq.damageRange[0]).toBeGreaterThan(0);
    expect(eq.percentRange[1]).toBeGreaterThan(eq.percentRange[0]);
  });

  it('status moves report no damage', () => {
    const m = calculateMatchup(garchomp, tyranitar, blankField());
    const sr = m.defenderMoves.find(r => r.moveName === 'Stealth Rock')!;
    expect(sr.damageRange).toEqual([0, 0]);
  });

  it('mega toggle changes attacker base stats', () => {
    const baseDmg = calculateMatchup(garchomp, tyranitar, blankField())
      .attackerMoves[0].damageRange[1];
    const mega: SavedMon = { ...garchomp, mega: 'mega' };
    const megaDmg = calculateMatchup(mega, tyranitar, blankField())
      .attackerMoves[0].damageRange[1];
    expect(megaDmg).toBeGreaterThan(baseDmg);
  });

  it('respects field weather (Sun boosts Fire moves)', () => {
    const charizard: SavedMon = {
      ...garchomp, species: 'Charizard', moves: ['Flamethrower', '', '', ''],
      ability: 'Blaze',
    };
    const noSun = calculateMatchup(charizard, skarmory, blankField())
      .attackerMoves[0].percentRange[1];
    const sun = calculateMatchup(charizard, skarmory, { ...blankField(), weather: 'Sun' })
      .attackerMoves[0].percentRange[1];
    expect(sun).toBeGreaterThan(noSun);
  });

  it('reports speed comparison', () => {
    const m = calculateMatchup(garchomp, tyranitar, blankField());
    expect(m.speed.attackerSpe).toBeGreaterThan(m.speed.defenderSpe);
    expect(m.speed.attackerOutspeeds).toBe(true);
  });

  it('reports type effectiveness on each move', () => {
    // Garchomp's Earthquake (Ground) vs Tyranitar (Rock/Dark): 2 * 1 = 2x.
    const m = calculateMatchup(garchomp, tyranitar, blankField());
    const eq = m.attackerMoves.find(r => r.moveName === 'Earthquake')!;
    expect(eq.effectiveness).toBe(2);
    const outrage = m.attackerMoves.find(r => r.moveName === 'Outrage')!;
    // Dragon vs Rock = 1, vs Dark = 1: neutral.
    expect(outrage.effectiveness).toBe(1);
  });

  it('status moves report neutral effectiveness', () => {
    const m = calculateMatchup(garchomp, tyranitar, blankField());
    const sr = m.defenderMoves.find(r => r.moveName === 'Stealth Rock')!;
    expect(sr.effectiveness).toBe(1);
  });
});

describe('priority override propagates through the adapter', () => {
  beforeAll(async () => {
    // The override is sync but reads a cache populated lazily by @pkmn/data.
    await preloadPkmn();
  });

  it('Trick Room reports priority -7 (not 0 from calc data)', () => {
    const tricky: SavedMon = {
      ...garchomp,
      moves: ['Trick Room', 'Earthquake', '', ''],
    };
    const m = calculateMatchup(tricky, tyranitar, blankField());
    const tr = m.attackerMoves.find(r => r.moveName === 'Trick Room')!;
    expect(tr.priority).toBe(-7);
  });

  it('Roar reports priority -6 (not 0 from calc data)', () => {
    const roarer: SavedMon = {
      ...skarmory,
      moves: ['Roar', 'Brave Bird', '', ''],
    };
    const m = calculateMatchup(roarer, tyranitar, blankField());
    const roar = m.attackerMoves.find(r => r.moveName === 'Roar')!;
    expect(roar.priority).toBe(-6);
  });

  it('Whirlwind reports priority -6', () => {
    const whirly: SavedMon = {
      ...skarmory,
      moves: ['Whirlwind', 'Brave Bird', '', ''],
    };
    const m = calculateMatchup(whirly, tyranitar, blankField());
    const ww = m.attackerMoves.find(r => r.moveName === 'Whirlwind')!;
    expect(ww.priority).toBe(-6);
  });

  it('Sucker Punch and Quick Attack remain at +1', () => {
    const fast: SavedMon = {
      ...garchomp,
      species: 'Garchomp',
      moves: ['Sucker Punch', 'Quick Attack', 'Earthquake', ''],
    };
    const m = calculateMatchup(fast, tyranitar, blankField());
    const sp = m.attackerMoves.find(r => r.moveName === 'Sucker Punch')!;
    const qa = m.attackerMoves.find(r => r.moveName === 'Quick Attack')!;
    expect(sp.priority).toBe(1);
    expect(qa.priority).toBe(1);
  });

  it('Earthquake has priority 0 (not erroneously overridden)', () => {
    const m = calculateMatchup(garchomp, tyranitar, blankField());
    const eq = m.attackerMoves.find(r => r.moveName === 'Earthquake')!;
    expect(eq.priority).toBe(0);
  });
});

describe('typeEffectiveness', () => {
  it('Fire vs Steel/Bug = 4x', () => {
    expect(typeEffectiveness('Fire', ['Steel', 'Bug'])).toBe(4);
  });
  it('Fire vs Steel/Flying = 2x (Steel weak, Flying neutral)', () => {
    expect(typeEffectiveness('Fire', ['Steel', 'Flying'])).toBe(2);
  });
  it('Electric vs Ground = 0', () => {
    expect(typeEffectiveness('Electric', ['Ground'])).toBe(0);
  });
  it('Water vs Fire = 2x (single type)', () => {
    expect(typeEffectiveness('Water', ['Fire'])).toBe(2);
  });
  it('Normal vs Ghost = 0', () => {
    expect(typeEffectiveness('Normal', ['Ghost'])).toBe(0);
  });
  it('Dragon vs Rock/Dark = 1', () => {
    expect(typeEffectiveness('Dragon', ['Rock', 'Dark'])).toBe(1);
  });
  it('returns 1 for unknown type', () => {
    expect(typeEffectiveness('???', ['Fire'])).toBe(1);
    expect(typeEffectiveness('', ['Fire'])).toBe(1);
  });
});
