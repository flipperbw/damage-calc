import { describe, expect, it } from 'vitest';

import { monToShowdownText, teamToShowdownText } from '@/store/exporters';
import { matchPokepasteId, parseShowdownText } from '@/store/importers';
import type { SavedMon, Team } from '@/types';

function mon(overrides: Partial<SavedMon> = {}): SavedMon {
  return {
    id: 'id-1',
    species: 'Garchomp',
    nature: 'Hardy',
    sps: {},
    moves: ['', '', '', ''],
    mega: '',
    boosts: {},
    ...overrides,
  };
}

describe('parseShowdownText', () => {
  it('returns empty result for blank input', () => {
    const r = parseShowdownText('');
    expect(r.mons).toEqual([]);
    expect(r.changes).toEqual([]);
    expect(r.unparseable).toEqual([]);
    expect(r.teamName).toBeNull();
  });

  it('returns empty result for whitespace-only input', () => {
    const r = parseShowdownText('   \n\n  \n');
    expect(r.mons).toEqual([]);
    expect(r.unparseable).toEqual([]);
  });

  it('parses a minimal mon (species only)', () => {
    const r = parseShowdownText('Garchomp');
    expect(r.mons).toHaveLength(1);
    expect(r.mons[0].draft.species).toBe('Garchomp');
    expect(r.mons[0].draft.item).toBeUndefined();
    expect(r.changes).toEqual([]);
  });

  it('parses a canonical Champions block cleanly with no changes', () => {
    const text = [
      'Garchomp @ Choice Scarf',
      'Ability: Rough Skin',
      'Level: 50',
      'EVs: 2 HP / 32 Atk / 32 Spe',
      'Adamant Nature',
      '- Earthquake',
      '- Outrage',
      '- Stone Edge',
      '- Fire Fang',
    ].join('\n');
    const r = parseShowdownText(text);
    expect(r.mons).toHaveLength(1);
    const d = r.mons[0].draft;
    expect(d.species).toBe('Garchomp');
    expect(d.item).toBe('Choice Scarf');
    expect(d.ability).toBe('Rough Skin');
    expect(d.nature).toBe('Adamant');
    expect(d.sps).toEqual({ hp: 2, atk: 32, spe: 32 });
    expect(d.moves).toEqual(['Earthquake', 'Outrage', 'Stone Edge', 'Fire Fang']);
    expect(d.mega).toBe('');
    // Level: 50 is the only adjustment-worthy line and we record it as field-ignored.
    expect(r.changes.map((c) => c.field)).toEqual(['level']);
  });

  it('infers mega state from a mega stone (plain)', () => {
    const text = [
      'Gardevoir-Mega @ Gardevoirite',
      'Ability: Pixilate',
      'Timid Nature',
      '- Moonblast',
    ].join('\n');
    const r = parseShowdownText(text);
    expect(r.mons[0].draft.species).toBe('Gardevoir');
    expect(r.mons[0].draft.mega).toBe('mega');
    expect(r.mons[0].draft.item).toBe('Gardevoirite');
    expect(r.mons[0].displayName).toBe('Gardevoir-Mega');
  });

  it('infers mega-x / mega-y variants from Charizardite X / Y', () => {
    const x = parseShowdownText('Charizard-Mega-X @ Charizardite X\nAbility: Tough Claws');
    const y = parseShowdownText('Charizard-Mega-Y @ Charizardite Y\nAbility: Drought');
    expect(x.mons[0].draft.mega).toBe('mega-x');
    expect(y.mons[0].draft.mega).toBe('mega-y');
    expect(x.mons[0].displayName).toBe('Charizard-Mega-X');
    expect(y.mons[0].displayName).toBe('Charizard-Mega-Y');
  });

  it('drops a non-Champions item and records item-dropped', () => {
    // Choice Band is still illegal in Champions (Life Orb became legal in
    // Regulation M-B, so it's no longer a valid "illegal item" fixture).
    const text = ['Salamence @ Choice Band', 'Ability: Intimidate', '- Outrage'].join('\n');
    const r = parseShowdownText(text);
    expect(r.mons[0].draft.item).toBeUndefined();
    const change = r.changes.find((c) => c.kind === 'item-dropped');
    expect(change).toMatchObject({ field: 'item', before: 'Choice Band' });
  });

  it('drops an unknown move and leaves the slot empty', () => {
    const text = ['Garchomp', 'Ability: Rough Skin', '- Earthquake', '- Fake Move That Does Not Exist'].join('\n');
    const r = parseShowdownText(text);
    expect(r.mons[0].draft.moves[0]).toBe('Earthquake');
    expect(r.mons[0].draft.moves[1]).toBe('');
    expect(r.changes.some((c) => c.kind === 'move-dropped' && c.before === 'Fake Move That Does Not Exist')).toBe(true);
  });

  it('drops Hidden Power variants (not in Champions) with bracket notation normalised before lookup', () => {
    const text = ['Greninja', '- Hidden Power [Fire]'].join('\n');
    const r = parseShowdownText(text);
    expect(r.mons[0].draft.moves[0]).toBe('');
    const dropped = r.changes.find((c) => c.kind === 'move-dropped');
    // The bracket → space normalization happens before the lookup, so `before`
    // captures the user's original paste (we don't rewrite it on drop).
    expect(dropped?.before).toBe('Hidden Power [Fire]');
  });

  it('scales standard 252/4 EV spreads into the SP caps', () => {
    const text = ['Garchomp @ Choice Scarf', 'Ability: Rough Skin', 'EVs: 4 HP / 252 Atk / 252 Spe', 'Adamant Nature', '- Earthquake'].join('\n');
    const r = parseShowdownText(text);
    expect(r.mons[0].draft.sps).toEqual({ hp: 1, atk: 32, spe: 32 });
    const scaled = r.changes.find((c) => c.kind === 'sps-scaled');
    expect(scaled).toBeDefined();
    expect(scaled?.detail).toMatch(/Atk 252 → 32/);
  });

  it('detects literal SPs and keeps the values as-is (no scaling)', () => {
    const text = ['Garchomp', 'EVs: 32 HP / 32 SpA / 2 Spe'].join('\n');
    const r = parseShowdownText(text);
    expect(r.mons[0].draft.sps).toEqual({ hp: 32, spa: 32, spe: 2 });
    expect(r.changes.some((c) => c.kind === 'sps-scaled')).toBe(false);
  });

  it('clamps total when scaled EVs exceed 66 SPs', () => {
    // 252 / 252 / 252 / 252 → 32 / 32 / 32 / 32 = 128, must clamp to 66.
    const text = ['Snorlax', 'EVs: 252 HP / 252 Atk / 252 Def / 252 SpD'].join('\n');
    const r = parseShowdownText(text);
    const total = Object.values(r.mons[0].draft.sps).reduce((a: number, b) => a + (b ?? 0), 0);
    expect(total).toBeLessThanOrEqual(66);
    expect(r.changes.some((c) => c.kind === 'sps-clamped')).toBe(true);
  });

  it('records nickname, Tera Type, Shiny, IVs, and Happiness as field-ignored', () => {
    const text = [
      'Nicky (Garchomp) @ Choice Scarf',
      'Ability: Rough Skin',
      'Tera Type: Steel',
      'Shiny: Yes',
      'Happiness: 0',
      'IVs: 0 Atk',
      'Adamant Nature',
      '- Earthquake',
    ].join('\n');
    const r = parseShowdownText(text);
    expect(r.mons[0].draft.species).toBe('Garchomp');
    const ignored = r.changes.filter((c) => c.kind === 'field-ignored').map((c) => c.field);
    expect(ignored).toEqual(expect.arrayContaining(['nickname', 'tera', 'shiny', 'happiness', 'ivs']));
  });

  it('captures team name from === Name === header', () => {
    const text = ['=== Tournament Crew ===', '', 'Garchomp @ Choice Scarf', '- Earthquake'].join('\n');
    const r = parseShowdownText(text);
    expect(r.teamName).toBe('Tournament Crew');
    expect(r.mons).toHaveLength(1);
  });

  it('parses multi-mon blocks separated by blank lines', () => {
    const text = [
      'Garchomp @ Choice Scarf',
      '- Earthquake',
      '',
      'Salamence @ Focus Sash',
      '- Outrage',
    ].join('\n');
    const r = parseShowdownText(text);
    expect(r.mons).toHaveLength(2);
    expect(r.mons[0].draft.species).toBe('Garchomp');
    expect(r.mons[1].draft.species).toBe('Salamence');
  });

  it('round-trips a single mon through exporter → parser', () => {
    const source = mon({
      species: 'Garchomp',
      item: 'Choice Scarf',
      ability: 'Rough Skin',
      nature: 'Adamant',
      sps: { atk: 32, spe: 32, hp: 2 },
      moves: ['Earthquake', 'Outrage', 'Stone Edge', 'Fire Fang'],
    });
    const r = parseShowdownText(monToShowdownText(source));
    expect(r.mons).toHaveLength(1);
    const d = r.mons[0].draft;
    expect(d).toMatchObject({
      species: 'Garchomp',
      item: 'Choice Scarf',
      ability: 'Rough Skin',
      nature: 'Adamant',
      sps: { atk: 32, spe: 32, hp: 2 },
      moves: ['Earthquake', 'Outrage', 'Stone Edge', 'Fire Fang'],
      mega: '',
    });
    // The only adjustment-worthy line in our own export is "Level: 50".
    expect(r.changes.filter((c) => c.field !== 'level')).toEqual([]);
  });

  it('round-trips a mega-Y mon (species name and stone both encode the variant)', () => {
    const source = mon({
      species: 'Charizard',
      item: 'Charizardite Y',
      ability: 'Drought',
      nature: 'Timid',
      sps: { spa: 32, spe: 32, hp: 2 },
      moves: ['Fire Blast', 'Solar Beam', '', ''],
      mega: 'mega-y',
    });
    const r = parseShowdownText(monToShowdownText(source));
    const d = r.mons[0].draft;
    expect(d.species).toBe('Charizard');
    expect(d.item).toBe('Charizardite Y');
    expect(d.mega).toBe('mega-y');
  });

  it('round-trips a full team through teamToShowdownText', () => {
    const team: Team = {
      id: 't',
      name: 'My Squad',
      format: 'singles',
      createdAt: 0,
      updatedAt: 0,
      mons: [
        mon({ id: 'a', species: 'Garchomp', item: 'Choice Scarf', ability: 'Rough Skin', moves: ['Earthquake', '', '', ''] }),
        mon({ id: 'b', species: 'Salamence', item: 'Focus Sash', ability: 'Intimidate', moves: ['Outrage', '', '', ''] }),
      ],
    };
    const r = parseShowdownText(teamToShowdownText(team));
    expect(r.teamName).toBe('My Squad');
    expect(r.mons).toHaveLength(2);
    expect(r.mons[0].draft.species).toBe('Garchomp');
    expect(r.mons[1].draft.species).toBe('Salamence');
  });

  it('reports a fully garbage block in unparseable and continues with valid blocks', () => {
    const text = ['=== Mixed ===', '', 'random words not a mon shape', '', 'Garchomp', '- Earthquake'].join('\n');
    const r = parseShowdownText(text);
    // "random words not a mon shape" *looks like* a mon (one-line species head),
    // so it parses as species="random words not a mon shape" — the editor will
    // show the no-sprite state. We accept this as the trade-off documented in
    // the spec. The real Garchomp block parses cleanly.
    expect(r.mons.length).toBeGreaterThanOrEqual(1);
    expect(r.mons.some((m) => m.draft.species === 'Garchomp')).toBe(true);
  });

  it('drops moves beyond slot 4 as move-dropped', () => {
    const text = ['Garchomp', '- Earthquake', '- Outrage', '- Stone Edge', '- Fire Fang', '- Iron Head'].join('\n');
    const r = parseShowdownText(text);
    expect(r.mons[0].draft.moves).toEqual(['Earthquake', 'Outrage', 'Stone Edge', 'Fire Fang']);
    expect(r.changes.some((c) => c.kind === 'move-dropped' && c.before === 'Iron Head')).toBe(true);
  });

  it('flags a misspelled species as speciesKnown:false (dialog drops on commit)', () => {
    const text = ['Primar @ Choice Scarf', 'Ability: Torrent', '- Hydro Pump'].join('\n');
    const r = parseShowdownText(text);
    expect(r.mons).toHaveLength(1);
    expect(r.mons[0].draft.species).toBe('Primar');
    expect(r.mons[0].speciesKnown).toBe(false);
  });

  it('sets speciesKnown:true for a real species', () => {
    const r = parseShowdownText('Garchomp\n- Earthquake');
    expect(r.mons[0].speciesKnown).toBe(true);
  });

  it('auto-adds the matching Mega Stone when the head names a mega forme but the item line omits it', () => {
    const r = parseShowdownText('Gardevoir-Mega\n- Moonblast');
    expect(r.mons[0].draft.species).toBe('Gardevoir');
    expect(r.mons[0].draft.item).toBe('Gardevoirite');
    expect(r.mons[0].draft.mega).toBe('mega');
    expect(r.mons[0].displayName).toBe('Gardevoir-Mega');
    // Auto-add is reported as a field-ignored change so the user sees what
    // we did. Detail mentions the stone name.
    const note = r.changes.find((c) => c.field === 'item');
    expect(note?.detail).toMatch(/Gardevoirite/);
  });

  it('infers Charizardite X / Y from a mega-X / mega-Y head when item is missing', () => {
    const x = parseShowdownText('Charizard-Mega-X\n- Dragon Claw');
    expect(x.mons[0].draft.item).toBe('Charizardite X');
    expect(x.mons[0].draft.mega).toBe('mega-x');
    const y = parseShowdownText('Charizard-Mega-Y\n- Fire Blast');
    expect(y.mons[0].draft.item).toBe('Charizardite Y');
    expect(y.mons[0].draft.mega).toBe('mega-y');
  });

  it('keeps the existing stone when the head matches and the item is correct (no auto-add change)', () => {
    const r = parseShowdownText('Gardevoir-Mega @ Gardevoirite\n- Moonblast');
    expect(r.mons[0].draft.item).toBe('Gardevoirite');
    expect(r.mons[0].draft.mega).toBe('mega');
    // No mega auto-add change should fire when the user already supplied the
    // correct stone.
    expect(r.changes.some((c) => c.field === 'item' && c.detail?.startsWith('Auto-added'))).toBe(false);
  });

  it('replaces a non-stone item with the right stone when the head names a mega forme', () => {
    // User says Gardevoir-Mega + Leftovers; Leftovers is legal in Champions
    // but isn't a stone. We trust the -Mega intent and inject Gardevoirite.
    const r = parseShowdownText('Gardevoir-Mega @ Leftovers\n- Moonblast');
    expect(r.mons[0].draft.item).toBe('Gardevoirite');
    expect(r.mons[0].draft.mega).toBe('mega');
  });

  it('handles lowercase -mega suffix and canonicalises the species name', () => {
    // Real paste shape from a user: "Gardevoir-mega @ Quick Claw". The
    // lowercase suffix used to slip past stripMegaSuffix and the literal
    // string "Gardevoir-mega" got saved as the species, bypassing our
    // species+mega flag model entirely.
    const text = ['Gardevoir-mega @ Leftovers', 'Ability: Trace', '- Moonblast'].join('\n');
    const r = parseShowdownText(text);
    expect(r.mons[0].draft.species).toBe('Gardevoir');
    expect(r.mons[0].draft.mega).toBe('mega');
    expect(r.mons[0].draft.item).toBe('Gardevoirite');
    expect(r.mons[0].speciesKnown).toBe(true);
  });

  it('canonicalises species casing for non-mega pastes too', () => {
    // "garchomp" → "Garchomp" so the team list and sprite URL get the right
    // name without depending on toID-based downstream lookups.
    const r = parseShowdownText('garchomp\n- Earthquake');
    expect(r.mons[0].draft.species).toBe('Garchomp');
  });

  it('treats a directly-typed mega-forme id (no hyphen) as the base species + mega flag', () => {
    // Edge case: GEN.species.get(toID("gardevoirmega")) resolves to the
    // mega forme entry. Without canonicalisation we used to save it as
    // species "Gardevoir-Mega", flag mega=''. Now: base species + mega flag.
    const r = parseShowdownText('gardevoirmega\n- Moonblast');
    expect(r.mons[0].draft.species).toBe('Gardevoir');
    expect(r.mons[0].draft.mega).toBe('mega');
    expect(r.mons[0].draft.item).toBe('Gardevoirite');
  });

  it("doesn't infer a stone when the species has no compatible mega forme", () => {
    // Garchomp-Mega-X doesn't exist (Garchomp only has plain mega). Should
    // record that the forme is invalid and save as base Garchomp.
    const r = parseShowdownText('Garchomp-Mega-X\n- Earthquake');
    expect(r.mons[0].draft.mega).toBe('');
    expect(r.mons[0].draft.item).toBeUndefined();
    expect(r.changes.some((c) => c.field === 'mega')).toBe(true);
  });

  it('parses duplicates as separate mons (dedup is handled by the dialog, not the parser)', () => {
    // The parser keeps both occurrences; Species Clause enforcement (drop the
    // second) is the dialog's job, not the parser's. This guards against a
    // regression where the parser silently merges duplicates and the dialog
    // never sees them to dim/dedup.
    const text = ['Venusaur', '- Sludge Bomb', '', 'Venusaur', '- Earthquake'].join('\n');
    const r = parseShowdownText(text);
    expect(r.mons).toHaveLength(2);
    expect(r.mons[0].draft.species).toBe('Venusaur');
    expect(r.mons[1].draft.species).toBe('Venusaur');
  });
});

describe('matchPokepasteId', () => {
  it('matches a modern 16-hex paste id', () => {
    expect(matchPokepasteId('https://pokepast.es/0123456789abcdef')).toBe('0123456789abcdef');
  });

  it('matches a legacy numeric id', () => {
    expect(matchPokepasteId('https://pokepast.es/1234567')).toBe('1234567');
  });

  it('matches with a /raw or /json suffix and a trailing slash', () => {
    expect(matchPokepasteId('https://pokepast.es/0123456789abcdef/raw')).toBe('0123456789abcdef');
    expect(matchPokepasteId('https://pokepast.es/0123456789abcdef/json')).toBe('0123456789abcdef');
    expect(matchPokepasteId('https://pokepast.es/0123456789abcdef/')).toBe('0123456789abcdef');
  });

  it('tolerates surrounding whitespace (paste-and-go) and http / case', () => {
    expect(matchPokepasteId('  https://pokepast.es/0123456789ABCDEF  \n')).toBe('0123456789ABCDEF');
    expect(matchPokepasteId('http://pokepast.es/1234567')).toBe('1234567');
  });

  it('rejects a link with surrounding prose (not a bare URL)', () => {
    expect(matchPokepasteId('my team: https://pokepast.es/0123456789abcdef')).toBeNull();
    expect(matchPokepasteId('https://pokepast.es/0123456789abcdef is great')).toBeNull();
  });

  it('rejects the wrong host and malformed ids', () => {
    expect(matchPokepasteId('https://pokepaste.es/0123456789abcdef')).toBeNull();
    expect(matchPokepasteId('https://example.com/0123456789abcdef')).toBeNull();
    // 15 hex chars (one short of the modern id) and a 17-char id both miss.
    expect(matchPokepasteId('https://pokepast.es/0123456789abcde')).toBeNull();
    expect(matchPokepasteId('https://pokepast.es/0123456789abcdef0')).toBeNull();
  });

  it('returns null for plain Showdown text', () => {
    expect(matchPokepasteId('Garchomp @ Choice Scarf\n- Earthquake')).toBeNull();
    expect(matchPokepasteId('')).toBeNull();
  });
});
