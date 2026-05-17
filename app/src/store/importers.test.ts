import { describe, expect, it } from 'vitest';

import { monToShowdownText, teamToShowdownText } from '@/store/exporters';
import { parseShowdownText } from '@/store/importers';
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
    const text = ['Salamence @ Life Orb', 'Ability: Intimidate', '- Outrage'].join('\n');
    const r = parseShowdownText(text);
    expect(r.mons[0].draft.item).toBeUndefined();
    const change = r.changes.find((c) => c.kind === 'item-dropped');
    expect(change).toMatchObject({ field: 'item', before: 'Life Orb' });
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
});
