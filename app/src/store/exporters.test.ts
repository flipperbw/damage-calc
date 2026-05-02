import { describe, it, expect } from 'vitest';
import { monToShowdownText, teamToShowdownText } from './exporters';
import type { SavedMon, Team } from '../types';

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

describe('monToShowdownText', () => {
  it('emits the canonical block with name + nature + EVs + ability + item + 4 moves', () => {
    const m = mon({
      species: 'Garchomp',
      item: 'Choice Band',
      ability: 'Rough Skin',
      nature: 'Adamant',
      sps: { atk: 32, spe: 32, hp: 2 },
      moves: ['Earthquake', 'Outrage', 'Stone Edge', 'Fire Fang'],
    });
    const text = monToShowdownText(m);
    expect(text).toBe(
      [
        'Garchomp @ Choice Band',
        'Ability: Rough Skin',
        'Level: 50',
        'EVs: 2 HP / 32 Atk / 32 Spe',
        'Adamant Nature',
        '- Earthquake',
        '- Outrage',
        '- Stone Edge',
        '- Fire Fang',
      ].join('\n'),
    );
  });

  it('appends -Mega suffix when mega is set', () => {
    const m = mon({
      species: 'Gardevoir',
      item: 'Gardevoirite',
      ability: 'Trace',
      nature: 'Timid',
      mega: 'mega',
      moves: ['Moonblast', '', '', ''],
    });
    const text = monToShowdownText(m);
    expect(text.split('\n')[0]).toBe('Gardevoir-Mega @ Gardevoirite');
  });

  it('uses -Mega-X / -Mega-Y for x/y mega forms', () => {
    const x = monToShowdownText(mon({ species: 'Charizard', item: 'Charizardite X', ability: 'Tough Claws', mega: 'mega-x', moves: ['', '', '', ''] }));
    const y = monToShowdownText(mon({ species: 'Charizard', item: 'Charizardite Y', ability: 'Drought', mega: 'mega-y', moves: ['', '', '', ''] }));
    expect(x.split('\n')[0]).toBe('Charizard-Mega-X @ Charizardite X');
    expect(y.split('\n')[0]).toBe('Charizard-Mega-Y @ Charizardite Y');
  });

  it('omits the EV row when no SPs are allocated', () => {
    const text = monToShowdownText(mon({ species: 'Ditto', moves: ['Transform', '', '', ''] }));
    expect(text).not.toMatch(/EVs:/);
  });

  it('omits empty move slots', () => {
    const text = monToShowdownText(mon({ moves: ['Earthquake', '', 'Outrage', ''] }));
    const moveLines = text.split('\n').filter(l => l.startsWith('- '));
    expect(moveLines).toEqual(['- Earthquake', '- Outrage']);
  });

  it('omits the item segment when no item is set', () => {
    const text = monToShowdownText(mon({ species: 'Rotom', moves: ['Thunder Wave', '', '', ''] }));
    expect(text.split('\n')[0]).toBe('Rotom');
  });
});

describe('teamToShowdownText', () => {
  it('separates mons with blank lines under a team header', () => {
    const team: Team = {
      id: 't',
      name: 'My Team',
      format: 'singles',
      createdAt: 0,
      updatedAt: 0,
      mons: [
        mon({ species: 'Garchomp', moves: ['Earthquake', '', '', ''] }),
        mon({ species: 'Salamence', moves: ['Dragon Claw', '', '', ''] }),
      ],
    };
    const text = teamToShowdownText(team);
    expect(text.startsWith('=== My Team ===\n\n')).toBe(true);
    expect(text).toContain('Garchomp');
    expect(text).toContain('Salamence');
    // Blocks separated by blank line.
    expect(text).toMatch(/Earthquake\n\nSalamence/);
  });

  it('reports an empty team explicitly', () => {
    const team: Team = {
      id: 't', name: 'Empty', format: 'singles',
      createdAt: 0, updatedAt: 0, mons: [],
    };
    expect(teamToShowdownText(team)).toBe('=== Empty ===\n(empty team)');
  });
});
