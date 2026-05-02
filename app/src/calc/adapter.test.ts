import { describe, it, expect } from 'vitest';
import { calculateMatchup } from './adapter';
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
});
