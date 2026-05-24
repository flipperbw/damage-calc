import type { SavedMon } from '@/types';

/**
 * Hand-curated example teams that show up in the Teams screen's empty
 * state. Each preset is a real tournament-winning Champions VGC Doubles
 * team (sourced from Pikalytics tournament data, May 2026) so a new user
 * can land on a team that actually plays in the current meta instead of
 * picking six random mons.
 *
 * Set distributions (natures + SPs) follow the standard roles —
 * Pikalytics's summary doesn't include the exact EVs the players ran, so
 * these are sensible defaults a competitive player would recognise rather
 * than a faithful copy of the original sheet.
 *
 * Pikalytics top teams (May 2026):
 *   #1 Altkyle (12-0) — Rain offense
 *   #2 imstone  (11-2) — Sand offense
 *   #3 Feis     (11-0) — Fairy spam / Sneasler
 */

export interface PresetTeam {
  name: string;
  /** One-line vibe so the user knows what they're picking. */
  blurb: string;
  format: 'singles' | 'doubles';
  /** Mons without `id` — TeamsScreen stamps fresh uuids on apply. */
  mons: Omit<SavedMon, 'id'>[];
}

// Roles → SP allocations (Champions: 32 per stat max, 66 total).
const FAST_PHYS = { atk: 32, spe: 32, hp: 2 };
const FAST_SPEC = { spa: 32, spe: 32, hp: 2 };
const SLOW_SPEC = { spa: 32, hp: 32, spd: 2 };
const PHYS_TANK = { hp: 32, def: 32, spd: 2 };
const SPEC_TANK = { hp: 32, spd: 32, def: 2 };
const SUPPORT_BULKY = { hp: 32, spd: 16, atk: 16, def: 2 };

export const PRESET_TEAMS: PresetTeam[] = [
  {
    name: 'Rain Offense',
    blurb: 'Mega Dragonite + Pelipper rain — Altkyle 12-0 tournament list',
    format: 'doubles',
    mons: [
      {
        species: 'Dragonite',
        item: 'Dragoninite',
        ability: 'Inner Focus',
        nature: 'Modest',
        sps: FAST_SPEC,
        moves: ['Dragon Pulse', 'Hurricane', 'Tailwind', 'Protect'],
        mega: 'mega',
        boosts: {},
      },
      {
        species: 'Basculegion',
        item: 'Choice Scarf',
        ability: 'Adaptability',
        nature: 'Adamant',
        sps: FAST_PHYS,
        moves: ['Wave Crash', 'Last Respects', 'Aqua Jet', 'Flip Turn'],
        mega: '',
        boosts: {},
      },
      {
        species: 'Scizor',
        item: 'Scizorite',
        ability: 'Technician',
        nature: 'Adamant',
        sps: { atk: 32, hp: 32, spe: 2 },
        moves: ['Bullet Punch', 'Close Combat', 'Swords Dance', 'Protect'],
        mega: 'mega',
        boosts: {},
      },
      {
        species: 'Archaludon',
        item: 'Chople Berry',
        ability: 'Stamina',
        nature: 'Modest',
        sps: SLOW_SPEC,
        moves: ['Electro Shot', 'Dragon Pulse', 'Aura Sphere', 'Protect'],
        mega: '',
        boosts: {},
      },
      {
        species: 'Pelipper',
        item: 'Focus Sash',
        ability: 'Drizzle',
        nature: 'Modest',
        sps: FAST_SPEC,
        moves: ['Hurricane', 'Weather Ball', 'Tailwind', 'Protect'],
        mega: '',
        boosts: {},
      },
      {
        species: 'Incineroar',
        item: 'Sitrus Berry',
        ability: 'Intimidate',
        nature: 'Careful',
        sps: SUPPORT_BULKY,
        moves: ['Fake Out', 'Flare Blitz', 'Throat Chop', 'Parting Shot'],
        mega: '',
        boosts: {},
      },
    ],
  },
  {
    name: 'Sand Offense',
    blurb: 'Mega Tyranitar + Excadrill sand — imstone 11-2 tournament list',
    format: 'doubles',
    mons: [
      {
        species: 'Tyranitar',
        item: 'Tyranitarite',
        ability: 'Sand Stream',
        nature: 'Adamant',
        sps: FAST_PHYS,
        moves: ['Rock Slide', 'Knock Off', 'Low Kick', 'Protect'],
        mega: 'mega',
        boosts: {},
      },
      {
        species: 'Corviknight',
        item: 'Leftovers',
        ability: 'Mirror Armor',
        nature: 'Impish',
        sps: PHYS_TANK,
        moves: ['Brave Bird', 'Bulk Up', 'Roost', 'Tailwind'],
        mega: '',
        boosts: {},
      },
      {
        species: 'Hydreigon',
        item: 'Choice Scarf',
        ability: 'Levitate',
        nature: 'Modest',
        sps: FAST_SPEC,
        moves: ['Dark Pulse', 'Draco Meteor', 'Heat Wave', 'Snarl'],
        mega: '',
        boosts: {},
      },
      {
        species: 'Mimikyu',
        item: 'White Herb',
        ability: 'Disguise',
        nature: 'Adamant',
        sps: FAST_PHYS,
        moves: ['Play Rough', 'Shadow Sneak', 'Will-O-Wisp', 'Protect'],
        mega: '',
        boosts: {},
      },
      {
        species: 'Excadrill',
        item: 'Focus Sash',
        ability: 'Sand Rush',
        nature: 'Adamant',
        sps: FAST_PHYS,
        moves: ['Iron Head', 'Earthquake', 'Rock Slide', 'Protect'],
        mega: '',
        boosts: {},
      },
      {
        species: 'Rotom-Wash',
        item: 'Sitrus Berry',
        ability: 'Levitate',
        nature: 'Modest',
        sps: SPEC_TANK,
        moves: ['Thunderbolt', 'Hydro Pump', 'Will-O-Wisp', 'Protect'],
        mega: '',
        boosts: {},
      },
    ],
  },
  {
    name: 'Fairy Spam',
    blurb: 'Mega Floette + Sneasler — Feis 11-0 tournament list',
    format: 'doubles',
    mons: [
      {
        species: 'Floette-Eternal',
        item: 'Floettite',
        ability: 'Flower Veil',
        nature: 'Modest',
        sps: FAST_SPEC,
        moves: ['Light of Ruin', 'Moonblast', 'Dazzling Gleam', 'Protect'],
        mega: 'mega',
        boosts: {},
      },
      {
        species: 'Basculegion',
        item: 'Focus Sash',
        ability: 'Adaptability',
        nature: 'Adamant',
        sps: FAST_PHYS,
        moves: ['Aqua Jet', 'Liquidation', 'Last Respects', 'Protect'],
        mega: '',
        boosts: {},
      },
      {
        species: 'Whimsicott',
        item: 'Fairy Feather',
        ability: 'Prankster',
        nature: 'Timid',
        sps: FAST_SPEC,
        moves: ['Protect', 'Encore', 'Moonblast', 'Tailwind'],
        mega: '',
        boosts: {},
      },
      {
        species: 'Incineroar',
        item: 'Charcoal',
        ability: 'Intimidate',
        nature: 'Adamant',
        sps: SUPPORT_BULKY,
        moves: ['Fake Out', 'Flare Blitz', 'Throat Chop', 'Protect'],
        mega: '',
        boosts: {},
      },
      {
        species: 'Sneasler',
        item: 'White Herb',
        ability: 'Unburden',
        nature: 'Jolly',
        sps: FAST_PHYS,
        moves: ['Close Combat', 'Fake Out', 'Dire Claw', 'Protect'],
        mega: '',
        boosts: {},
      },
      {
        species: 'Skarmory',
        item: 'Skarmorite',
        ability: 'Sturdy',
        nature: 'Adamant',
        sps: { atk: 32, hp: 32, spe: 2 },
        moves: ['Iron Head', 'Brave Bird', 'Rock Tomb', 'Protect'],
        mega: 'mega',
        boosts: {},
      },
    ],
  },
];
