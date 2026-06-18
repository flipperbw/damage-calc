import { describe, expect, it } from 'vitest';

import { GEN } from '@/calc/gen';
import { abilityDescription, canLearn, getLearnableMoveIds, moveDescription, preloadPkmn, priorityOverride } from '@/data/pkmn';

/**
 * These tests exercise the live @pkmn/data + @pkmn/dex bundle (gen 7). They
 * do real dynamic imports the first time around, so we bump the suite-wide
 * timeout. The data is small enough to load in well under a second once
 * cached, but cold start during a fresh `vitest run` can take a beat.
 */

describe('getLearnableMoveIds', () => {
  it('returns a non-empty Set including known Garchomp moves', async () => {
    const ids = await getLearnableMoveIds('Garchomp');
    expect(ids).toBeInstanceOf(Set);
    expect(ids.size).toBeGreaterThan(0);
    expect(ids.has('earthquake')).toBe(true);
    expect(ids.has('outrage')).toBe(true);
  });

  it('does NOT include moves Garchomp cannot learn', async () => {
    const ids = await getLearnableMoveIds('Garchomp');
    expect(ids.has('softboiled')).toBe(false);
    expect(ids.has('recover')).toBe(false);
  });

  it('returns an empty set for unknown species', async () => {
    const ids = await getLearnableMoveIds('NotAPokemon12345');
    expect(ids).toBeInstanceOf(Set);
    expect(ids.size).toBe(0);
  });

  it('inherits moves from the base species (Floette-Eternal → Floette → Draining Kiss)', async () => {
    // Floette-Eternal's own learnset entry in @pkmn/data only holds forme-
    // exclusive moves (Light of Ruin). Draining Kiss lives on the base
    // Floette learnset; getLearnableMoveIds should union the chain.
    const ids = await getLearnableMoveIds('Floette-Eternal');
    expect(ids.has('drainingkiss')).toBe(true);
    expect(ids.has('lightofruin')).toBe(true);
  });

  it('inherits moves from prevo chain in the latest gen (Sneasler → Sneasel-Hisui → Feint)', async () => {
    // Sneasler is gen-9 only — not in gen 7. Feint comes via prevo
    // (Sneasel-Hisui → Feint). getLearnableMoveIds should walk prevo
    // and pick up Feint.
    const ids = await getLearnableMoveIds('Sneasler');
    expect(ids.has('feint')).toBe(true);
    // Sneasler's own signature pick should still be there too.
    expect(ids.has('direclaw')).toBe(true);
  });

  it('does NOT cross-leak moves from regional-variant baseSpecies (Sneasler does not learn Dragon Dance)', async () => {
    // Sneasel-Hisui.baseSpecies = "Sneasel" (regular Sneasel — a
    // biologically separate Pokémon with a different learnset).
    // Walking baseSpecies for regional variants would wrongly inherit
    // Dragon Dance, Beat Up, etc. from regular Sneasel. The walk should
    // only follow baseSpecies for mega formes.
    const ids = await getLearnableMoveIds('Sneasler');
    expect(ids.has('dragondance')).toBe(false);
  });

  it('inherits via baseSpecies for mega formes (Charizard-Mega-Y learns Flamethrower)', async () => {
    // Mega formes share the base species's learnset. Charizard's
    // staple Flamethrower must surface on the mega forme even though
    // the mega entry itself is sparse.
    const ids = await getLearnableMoveIds('Charizard-Mega-Y');
    expect(ids.has('flamethrower')).toBe(true);
  });

  it('inherits via changesFrom for appliance formes (Rotom-Wash learns Thunderbolt)', async () => {
    // Rotom-Wash's own learnset only carries Hydro Pump (its appliance
    // signature). The rest of the Electric staple kit (Thunderbolt,
    // Discharge, …) lives on base Rotom and is inherited via the
    // `changesFrom` field.
    const ids = await getLearnableMoveIds('Rotom-Wash');
    expect(ids.has('hydropump')).toBe(true);
    expect(ids.has('thunderbolt')).toBe(true);
    expect(ids.has('discharge')).toBe(true);
  });

  it('uses the vendored Champions learnsets table — Froslass learns Nasty Plot', async () => {
    // @pkmn/data's gen-9 Froslass learnset doesn't include Nasty Plot,
    // but the Champions mod's authoritative table does (Froslass picks
    // it up via TM and it's Champions-legal). Confirms the vendored
    // table is the primary source.
    const ids = await getLearnableMoveIds('Froslass');
    expect(ids.has('nastyplot')).toBe(true);
  });

  it('Floette-Eternal learns both Draining Kiss and Light of Ruin from Champions table', async () => {
    const ids = await getLearnableMoveIds('Floette-Eternal');
    expect(ids.has('drainingkiss')).toBe(true);
    expect(ids.has('lightofruin')).toBe(true);
  });
});

describe('Regulation M-B drift guards', () => {
  // Newly-legal base species in Regulation M-B. Each must resolve to a
  // non-empty learnset from the vendored Champions table — a species added
  // to the calc allowlist but missing from the learnset vendor pass would
  // surface an empty MovePicker in the app.
  const MB_NEW_SPECIES = [
    'Annihilape', 'Barbaracle', 'Blaziken', 'Dragalge', 'Eelektross',
    'Falinks', 'Gholdengo', 'Grimmsnarl', 'Houndstone', 'Malamar',
    'Mawile', 'Metagross', 'Musharna', 'Overqwil', 'Pyroar', 'Qwilfish',
    'Sceptile', 'Scolipede', 'Scrafty', 'Staraptor', 'Swampert', 'Vileplume',
  ];

  it.each(MB_NEW_SPECIES)('new species %s resolves to a non-empty learnset', async (name) => {
    const ids = await getLearnableMoveIds(name);
    expect(ids.size).toBeGreaterThan(0);
  });

  // Newly-legal Mega formes. These have no standalone learnset entry; they
  // must resolve via suffix-strip to the base species (Sceptile-Mega →
  // sceptile). Raichu-Mega-X/Y strip to the pre-existing Raichu.
  const MB_NEW_MEGAS = [
    'Barbaracle-Mega', 'Blaziken-Mega', 'Dragalge-Mega', 'Eelektross-Mega',
    'Falinks-Mega', 'Malamar-Mega', 'Mawile-Mega', 'Metagross-Mega',
    'Pyroar-Mega', 'Raichu-Mega-X', 'Raichu-Mega-Y', 'Sceptile-Mega',
    'Scolipede-Mega', 'Scrafty-Mega', 'Staraptor-Mega', 'Swampert-Mega',
  ];

  it.each(MB_NEW_MEGAS)('new mega %s inherits its base learnset via suffix-strip', async (name) => {
    const ids = await getLearnableMoveIds(name);
    expect(ids.size).toBeGreaterThan(0);
  });

  it('mega forme learnset equals its base species (Sceptile-Mega → Sceptile)', async () => {
    const base = await getLearnableMoveIds('Sceptile');
    const mega = await getLearnableMoveIds('Sceptile-Mega');
    expect(mega.has('leafblade')).toBe(true);
    expect(mega.has('earthpower')).toBe(true);
    // Suffix-strip should yield exactly the base kit, not a superset/subset.
    expect([...mega].sort()).toEqual([...base].sort());
  });

  it('signature M-B moves are present on their owners', async () => {
    // Use getLearnableMoveIds (the vendored Champions table the MovePicker
    // reads) rather than canLearn, which queries the gen-7 @pkmn bundle
    // where these gen-9 species don't exist.
    expect((await getLearnableMoveIds('Annihilape')).has('ragefist')).toBe(true);
    expect((await getLearnableMoveIds('Gholdengo')).has('makeitrain')).toBe(true);
  });

  it('M-B move changes are reflected in the vendored data', async () => {
    // Removal: Metagross lost Heavy Slam in M-B.
    const metagross = await getLearnableMoveIds('Metagross');
    expect(metagross.has('heavyslam')).toBe(false);
    // Addition: Sceptile gained Earth Power in M-B.
    const sceptile = await getLearnableMoveIds('Sceptile');
    expect(sceptile.has('earthpower')).toBe(true);
  });
});

describe('Champions learnset coverage (comprehensive drift guard)', () => {
  // The strongest future-proofing: every species the calc treats as
  // Champions-legal (gen-0) must resolve to a non-empty learnset. Catches
  // the whole class of "allowlisted a species but the learnset vendor pass
  // doesn't cover it" drift, for this regulation and every future one.
  it('every gen-0 (Champions) species resolves to a non-empty learnset', async () => {
    const empties: string[] = [];
    for (const sp of GEN.species) {
      const ids = await getLearnableMoveIds(sp.name);
      if (ids.size === 0) empties.push(sp.name);
    }
    expect(empties).toEqual([]);
  });
});

describe('canLearn', () => {
  it('Garchomp can learn Earthquake', async () => {
    expect(await canLearn('Garchomp', 'Earthquake')).toBe(true);
  });

  it('Pikachu cannot learn Outrage', async () => {
    expect(await canLearn('Pikachu', 'Outrage')).toBe(false);
  });
});

describe('moveDescription', () => {
  it('returns non-empty desc and shortDesc for Earthquake', async () => {
    const d = await moveDescription('Earthquake');
    expect(d.short).toBeTruthy();
    expect(d.full).toBeTruthy();
    // Earthquake's PS shortDesc mentions hitting Dig users / doubling damage.
    expect((d.short ?? '').length).toBeGreaterThan(0);
    expect((d.full ?? '').length).toBeGreaterThan(0);
  });

  it('returns empty pair for unknown move (no throw)', async () => {
    const d = await moveDescription('NotAMove12345');
    expect(d.short).toBeUndefined();
    expect(d.full).toBeUndefined();
  });
});

describe('abilityDescription', () => {
  it('returns prose for a known ability', async () => {
    const d = await abilityDescription('Levitate');
    expect(d.short).toBeTruthy();
  });

  it('returns empty pair for unknown ability', async () => {
    const d = await abilityDescription('NotAnAbility12345');
    expect(d.short).toBeUndefined();
    expect(d.full).toBeUndefined();
  });
});

describe('priorityOverride', () => {
  it('returns -7 for Trick Room after preload', async () => {
    await preloadPkmn();
    expect(priorityOverride('Trick Room')).toBe(-7);
  });

  it('returns the right priority for other audited moves', async () => {
    await preloadPkmn();
    // calc's gen-0 data already includes Sucker Punch / Quick Attack at +1,
    // so the override is incidental, but pkmn-data should agree.
    expect(priorityOverride('Sucker Punch')).toBe(1);
    expect(priorityOverride('Quick Attack')).toBe(1);
    // Roar / Whirlwind are -6 in real games but calc reports 0 (status moves
    // with no priority field). The override fills the gap.
    expect(priorityOverride('Roar')).toBe(-6);
    expect(priorityOverride('Whirlwind')).toBe(-6);
  });

  it('returns null for plain moves with no special priority', async () => {
    await preloadPkmn();
    expect(priorityOverride('Earthquake')).toBeNull();
    expect(priorityOverride('Tackle')).toBeNull();
  });

  it('returns null for unknown moves', async () => {
    await preloadPkmn();
    expect(priorityOverride('NotAMove12345')).toBeNull();
  });
});
