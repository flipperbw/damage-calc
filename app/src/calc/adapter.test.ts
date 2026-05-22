import { beforeAll, describe, expect, it } from 'vitest';

import { calculateMatchup, typeEffectiveness } from '@/calc/adapter';
import { preloadPkmn } from '@/data/pkmn';
import type { FieldState, SavedMon } from '@/types';

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

// Tyranitar (Rock/Dark) - Earthquake is 2× super effective; Outrage neutral.
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

// Skarmory (Steel/Flying) - used only for the Sun-weather test where Charizard
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
    const eq = m.attackerMoves.find((r) => r.moveName === 'Earthquake')!;
    expect(eq.damageRange[0]).toBeGreaterThan(0);
    expect(eq.percentRange[1]).toBeGreaterThan(eq.percentRange[0]);
  });

  it('status moves report no damage', () => {
    const m = calculateMatchup(garchomp, tyranitar, blankField());
    const sr = m.defenderMoves.find((r) => r.moveName === 'Stealth Rock')!;
    expect(sr.damageRange).toEqual([0, 0]);
  });

  it('mega toggle changes attacker base stats', () => {
    const baseDmg = calculateMatchup(garchomp, tyranitar, blankField()).attackerMoves[0].damageRange[1];
    const mega: SavedMon = { ...garchomp, mega: 'mega' };
    const megaDmg = calculateMatchup(mega, tyranitar, blankField()).attackerMoves[0].damageRange[1];
    expect(megaDmg).toBeGreaterThan(baseDmg);
  });

  it('respects field weather (Sun boosts Fire moves)', () => {
    const charizard: SavedMon = {
      ...garchomp,
      species: 'Charizard',
      moves: ['Flamethrower', '', '', ''],
      ability: 'Blaze',
    };
    const noSun = calculateMatchup(charizard, skarmory, blankField()).attackerMoves[0].percentRange[1];
    const sun = calculateMatchup(charizard, skarmory, { ...blankField(), weather: 'Sun' }).attackerMoves[0].percentRange[1];
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
    const eq = m.attackerMoves.find((r) => r.moveName === 'Earthquake')!;
    expect(eq.effectiveness).toBe(2);
    const outrage = m.attackerMoves.find((r) => r.moveName === 'Outrage')!;
    // Dragon vs Rock = 1, vs Dark = 1: neutral.
    expect(outrage.effectiveness).toBe(1);
  });

  it('status moves report neutral effectiveness', () => {
    const m = calculateMatchup(garchomp, tyranitar, blankField());
    const sr = m.defenderMoves.find((r) => r.moveName === 'Stealth Rock')!;
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
    const tr = m.attackerMoves.find((r) => r.moveName === 'Trick Room')!;
    expect(tr.priority).toBe(-7);
  });

  it('Roar reports priority -6 (not 0 from calc data)', () => {
    const roarer: SavedMon = {
      ...skarmory,
      moves: ['Roar', 'Brave Bird', '', ''],
    };
    const m = calculateMatchup(roarer, tyranitar, blankField());
    const roar = m.attackerMoves.find((r) => r.moveName === 'Roar')!;
    expect(roar.priority).toBe(-6);
  });

  it('Whirlwind reports priority -6', () => {
    const whirly: SavedMon = {
      ...skarmory,
      moves: ['Whirlwind', 'Brave Bird', '', ''],
    };
    const m = calculateMatchup(whirly, tyranitar, blankField());
    const ww = m.attackerMoves.find((r) => r.moveName === 'Whirlwind')!;
    expect(ww.priority).toBe(-6);
  });

  it('Sucker Punch and Quick Attack remain at +1', () => {
    const fast: SavedMon = {
      ...garchomp,
      species: 'Garchomp',
      moves: ['Sucker Punch', 'Quick Attack', 'Earthquake', ''],
    };
    const m = calculateMatchup(fast, tyranitar, blankField());
    const sp = m.attackerMoves.find((r) => r.moveName === 'Sucker Punch')!;
    const qa = m.attackerMoves.find((r) => r.moveName === 'Quick Attack')!;
    expect(sp.priority).toBe(1);
    expect(qa.priority).toBe(1);
  });

  it('Earthquake has priority 0 (not erroneously overridden)', () => {
    const m = calculateMatchup(garchomp, tyranitar, blankField());
    const eq = m.attackerMoves.find((r) => r.moveName === 'Earthquake')!;
    expect(eq.priority).toBe(0);
  });

  it('Aegislash-Shield uses Blade-form stats when attacking', () => {
    const aegi: SavedMon = {
      id: 'aegi',
      species: 'Aegislash-Shield',
      ability: 'Stance Change',
      nature: 'Adamant',
      sps: { atk: 32 },
      moves: ['Iron Head', '', '', ''],
      mega: '',
      boosts: {},
    };
    const m = calculateMatchup(aegi, tyranitar, blankField());
    // Shield-form Atk is 50; Blade's is 140. After Adamant nature + 32 SP at
    // level 50, the calc'd Atk should be in Blade's range (130+), not
    // Shield's range (~70).
    expect(m.attackerStats.atk).toBeGreaterThan(120);
    // Iron Head's damage should reflect Blade's massive Atk, not Shield's.
    const ih = m.attackerMoves.find((r) => r.moveName === 'Iron Head')!;
    expect(ih.damageRange[1]).toBeGreaterThan(0);
  });

  it('Aegislash-Shield keeps Shield-form bulk when defending', () => {
    // Shield-form has 140/140 Def/SpD; Blade has 50/50. A neutral physical
    // hit (Earthquake from Garchomp) against Aegislash should land much
    // lower than against a paper-thin Blade-statted defender would suggest.
    const aegi: SavedMon = {
      id: 'aegi',
      species: 'Aegislash-Shield',
      ability: 'Stance Change',
      nature: 'Bold',
      sps: { hp: 32, def: 32 },
      moves: ['', '', '', ''],
      mega: '',
      boosts: {},
    };
    const m = calculateMatchup(garchomp, aegi, blankField());
    // Earthquake from Garchomp vs Aegislash-Shield should hit for far less
    // than 100% even at the high end. (Shield bulk + neutral hit.)
    const eq = m.attackerMoves.find((r) => r.moveName === 'Earthquake')!;
    expect(eq.percentRange[1]).toBeLessThan(100);
  });

  it('uses Floette-Mega stats when Floette-Eternal mega-evolves (irregular -Mega naming)', () => {
    // Floette-Eternal's mega forme is "Floette-Mega" (not "Floette-Eternal-
    // Mega"). Calc links them via baseSpecies; the adapter's species-table
    // fallback should pick it up so the mega's huge SpA (155) drives damage,
    // not the base form's 125.
    const floetteBase: SavedMon = {
      id: 'fb',
      species: 'Floette-Eternal',
      ability: 'Flower Veil',
      nature: 'Modest',
      sps: { spa: 32, spe: 32, hp: 2 },
      moves: ['Moonblast', '', '', ''],
      mega: '',
      boosts: {},
    };
    const floetteMega: SavedMon = {
      ...floetteBase,
      item: 'Floettite',
      mega: 'mega',
    };
    const baseDmg = calculateMatchup(floetteBase, tyranitar, blankField()).attackerMoves[0].damageRange[1];
    const megaDmg = calculateMatchup(floetteMega, tyranitar, blankField()).attackerMoves[0].damageRange[1];
    expect(megaDmg).toBeGreaterThan(baseDmg);
    // Stats reported should match the mega forme's SpA at level 50 with
    // 32 SP + Modest — well above the base's ~150-ish range.
    expect(calculateMatchup(floetteMega, tyranitar, blankField()).attackerStats.spa).toBeGreaterThan(
      calculateMatchup(floetteBase, tyranitar, blankField()).attackerStats.spa,
    );
  });

  it('returns a degraded matchup (no throw) when a mon has an invalid species', () => {
    // Regression guard: stale localStorage from before species validation
    // could carry a typo'd species name. The BattleScreen render must not
    // unwind on the resulting Pokemon-constructor throw.
    const broken: SavedMon = {
      id: 'x',
      species: 'NotAPokemon',
      nature: 'Hardy',
      sps: {},
      moves: ['', '', '', ''],
      mega: '',
      boosts: {},
    };
    expect(() => calculateMatchup(broken, garchomp, blankField())).not.toThrow();
    expect(() => calculateMatchup(garchomp, broken, blankField())).not.toThrow();
    const m = calculateMatchup(broken, garchomp, blankField());
    expect(m.attackerStats.hp).toBe(0);
    expect(m.attackerMoves.every((mv) => mv.damageRange[1] === 0)).toBe(true);
  });

  it('Palafin uses Hero-form stats in both attacker and defender roles', () => {
    // Palafin-Zero: 70 Atk. Palafin-Hero: 160 Atk. We expect Hero's stats
    // when Palafin is the attacker — and Hero's bulk when defending.
    const palafin: SavedMon = {
      id: 'pal',
      species: 'Palafin',
      ability: 'Zero to Hero',
      nature: 'Adamant',
      sps: { atk: 32, spe: 32 },
      moves: ['Jet Punch', '', '', ''],
      mega: '',
      boosts: {},
    };
    const asAttacker = calculateMatchup(palafin, tyranitar, blankField());
    // Hero-form Atk after Adamant + 32 SP should be well above Zero's ~95.
    expect(asAttacker.attackerStats.atk).toBeGreaterThan(180);

    const asDefender = calculateMatchup(garchomp, palafin, blankField());
    // Hero-form Def 97 vs Zero-form Def 72 — defender HP/Def are higher,
    // so Earthquake's percent range should be lower against Hero than it
    // would be against Zero. Sanity-check it's not catastrophically high.
    const eq = asDefender.attackerMoves.find((r) => r.moveName === 'Earthquake')!;
    expect(eq.percentRange[1]).toBeLessThan(100);
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
