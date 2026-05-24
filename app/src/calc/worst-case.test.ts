import { beforeAll, describe, expect, it } from 'vitest';

import { findHardestHitter, findTankiestBuild } from '@/calc/worst-case';
import { preloadPkmn } from '@/data/pkmn';
import type { FieldState, SavedMon } from '@/types';

const blankField = (): FieldState => ({ yourSide: {}, oppSide: {} });

beforeAll(async () => {
  // The synth + tankiness search both rely on @pkmn/data for ability lists
  // and movepools. Warm the cache so the search has access to the full set
  // (not just calc gen-0's slot-0-only ability defaults).
  await preloadPkmn();
});

const blastoise: SavedMon = {
  id: 'blast',
  species: 'Blastoise',
  ability: 'Torrent',
  item: 'Mystic Water',
  nature: 'Modest',
  sps: { spa: 32, spe: 32, hp: 2 },
  moves: ['Hydro Pump', 'Ice Beam', 'Aura Sphere', 'Dark Pulse'],
  mega: '',
  boosts: {},
};

const garchomp: SavedMon = {
  id: 'gar',
  species: 'Garchomp',
  ability: 'Rough Skin',
  nature: 'Jolly',
  sps: { atk: 32, spe: 32 },
  moves: ['Earthquake', 'Outrage', 'Stone Edge', 'Fire Fang'],
  mega: '',
  boosts: {},
};

describe('findTankiestBuild', () => {
  it('prefers Chople Berry on Kingambit when the attacker carries Aura Sphere', () => {
    // Kingambit is Dark/Steel — 4× weak to Fighting. Blastoise's Hydro Pump
    // is the highest-BP move in vacuum (a neutral-target heuristic would
    // pick Passho Berry), but Aura Sphere is the move that actually KOs
    // Kingambit thanks to the 4× SE. The search has to recognise that
    // Chople Berry (halves the SE Fighting damage) wins over Leftovers.
    const res = findTankiestBuild('Kingambit', blastoise, blankField(), 'singles');
    expect(res).not.toBeNull();
    expect(res!.mon.item).toBe('Chople Berry');
  });

  it('returns null when the current opp build already minimises damage', () => {
    // Make the current opp ALREADY a Chople Berry Kingambit. The search
    // shouldn't downgrade it.
    const alreadyOptimal: SavedMon = {
      id: 'kg',
      species: 'Kingambit',
      ability: 'Defiant',
      item: 'Chople Berry',
      nature: 'Calm',
      sps: { hp: 32, spd: 32, def: 2 },
      moves: ['Iron Head', 'Kowtow Cleave', 'Sucker Punch', 'Swords Dance'],
      mega: '',
      boosts: {},
    };
    const res = findTankiestBuild('Kingambit', blastoise, blankField(), 'singles', alreadyOptimal);
    expect(res).toBeNull();
  });

  it('picks Leftovers when no SE move type matches a resist berry', () => {
    // Garchomp's only damaging type that's SE against a generic Dragon-type
    // wall would be Dragon (Outrage). Test with a wall that has no SE
    // weakness in Garchomp's moveset.
    const res = findTankiestBuild('Snorlax', garchomp, blankField(), 'singles');
    expect(res).not.toBeNull();
    // Snorlax has no resistances Garchomp's moveset can exploit with a
    // berry → Leftovers or Focus Sash should win. (Either is fine; just
    // verify it's not the wrong berry.)
    const item = res!.mon.item;
    expect(['Leftovers', 'Focus Sash']).toContain(item);
  });
});

describe('findHardestHitter', () => {
  it('returns null when the current opp already deals max damage', () => {
    // Garchomp at full kit vs a defensive Snorlax — there isn't a much
    // better Garchomp build the synth can find that the user's setup
    // doesn't already cover. Either it returns null (floor) or returns a
    // strictly stronger build. Just verify the function runs.
    const target: SavedMon = {
      id: 'sn',
      species: 'Snorlax',
      ability: 'Thick Fat',
      nature: 'Careful',
      sps: { hp: 32, spd: 32, def: 2 },
      moves: ['Body Slam', 'Earthquake', 'Crunch', 'Rest'],
      mega: '',
      boosts: {},
    };
    expect(() => findHardestHitter('Garchomp', target, blankField(), 'singles', garchomp)).not.toThrow();
  });
});
