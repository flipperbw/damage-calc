import type { FieldState, SideState } from '@/types';

/**
 * Field-pin catalog and helpers. A "pin" is a string key the user has saved
 * for quick one-tap access via the FieldBar's pinned-shortcut row. Each pin
 * encodes one specific field-state value (e.g. `weather:Sun`, `yourSide:tailwind`)
 * and supports two operations: read its current state, and toggle it.
 *
 * Key format:
 *   weather:<Sun|Rain|Sand|Snow>
 *   terrain:<Electric|Grassy|Misty|Psychic>
 *   tr | mr | wr | gravity
 *   <yourSide|oppSide>:<flag>
 *
 * Where <flag> is one of the SideState booleans (reflect, lightScreen,
 * tailwind, ...) or 'spikes' (treated as 0 vs 1+).
 */

export type PinSide = 'yourSide' | 'oppSide';
export type WeatherValue = 'Sun' | 'Rain' | 'Sand' | 'Snow';
export type TerrainValue = 'Electric' | 'Grassy' | 'Misty' | 'Psychic';

const WEATHERS: WeatherValue[] = ['Sun', 'Rain', 'Sand', 'Snow'];
const TERRAINS: TerrainValue[] = ['Electric', 'Grassy', 'Misty', 'Psychic'];

interface SideFlagSpec {
  key: keyof SideState;
  label: string;
}

const SIDE_FLAGS: SideFlagSpec[] = [
  { key: 'reflect', label: 'Reflect' },
  { key: 'lightScreen', label: 'Light Screen' },
  { key: 'auroraVeil', label: 'Aurora Veil' },
  { key: 'tailwind', label: 'Tailwind' },
  { key: 'stealthRock', label: 'Stealth Rock' },
  { key: 'spikes', label: 'Spikes' },
  { key: 'protect', label: 'Protect' },
  { key: 'leechSeed', label: 'Leech Seed' },
  { key: 'saltCure', label: 'Salt Cure' },
  { key: 'helpingHand', label: 'Helping Hand' },
  { key: 'friendGuard', label: 'Friend Guard' },
  { key: 'isPowerTrick', label: 'Power Trick' },
  { key: 'isSwitching', label: 'Switching Out' },
];

export interface PinSpec {
  key: string;
  label: string;
  /** Used to group the catalog in the FieldDrawer's pin-editing mode. */
  section: 'Weather' | 'Terrain' | 'Room' | 'Your side' | 'Opp side';
}

/**
 * Every pinnable value, in a stable order for the catalog UI.
 */
export const ALL_PINS: PinSpec[] = [
  ...WEATHERS.map((w) => ({ key: `weather:${w}`, label: w, section: 'Weather' as const })),
  ...TERRAINS.map((t) => ({ key: `terrain:${t}`, label: `${t} Terrain`, section: 'Terrain' as const })),
  { key: 'tr', label: 'Trick Room', section: 'Room' },
  { key: 'mr', label: 'Magic Room', section: 'Room' },
  { key: 'wr', label: 'Wonder Room', section: 'Room' },
  { key: 'gravity', label: 'Gravity', section: 'Room' },
  { key: 'fairyAura', label: 'Fairy Aura', section: 'Room' },
  ...SIDE_FLAGS.map((f) => ({ key: `yourSide:${f.key}`, label: f.label, section: 'Your side' as const })),
  ...SIDE_FLAGS.map((f) => ({ key: `oppSide:${f.key}`, label: f.label, section: 'Opp side' as const })),
];

const PIN_BY_KEY: Map<string, PinSpec> = new Map(ALL_PINS.map((p) => [p.key, p]));

export function isValidPinKey(key: string): boolean {
  return PIN_BY_KEY.has(key);
}

export function pinSpec(key: string): PinSpec | null {
  return PIN_BY_KEY.get(key) ?? null;
}

/**
 * Display label for a chip in the pinned-shortcut row. Side flags get a
 * subtle `you ·` / `opp ·` prefix so the user can tell the two halves
 * apart at a glance.
 */
export function pinChipLabel(key: string): string {
  const s = pinSpec(key);
  if (!s) return key;
  if (s.section === 'Your side') return `you · ${s.label}`;
  if (s.section === 'Opp side') return `opp · ${s.label}`;
  return s.label;
}

/** Read the pin's current on/off state from a FieldState. */
export function isPinActive(field: FieldState, key: string): boolean {
  if (key.startsWith('weather:')) {
    return field.weather === key.slice(8);
  }
  if (key.startsWith('terrain:')) {
    return field.terrain === key.slice(8);
  }
  switch (key) {
    case 'tr':
      return !!field.isTrickRoom;
    case 'mr':
      return !!field.isMagicRoom;
    case 'wr':
      return !!field.isWonderRoom;
    case 'gravity':
      return !!field.isGravity;
    case 'fairyAura':
      return !!field.isFairyAura;
  }
  if (key.startsWith('yourSide:') || key.startsWith('oppSide:')) {
    const [side, flag] = key.split(':') as [PinSide, keyof SideState];
    const s = field[side];
    if (flag === 'spikes') return !!(s.spikes && s.spikes > 0);
    return !!s[flag];
  }
  return false;
}

/**
 * Toggle the pin's underlying field state. Returns a Partial<FieldState>
 * patch that callers pass to setField. Spikes is binary (0 ↔ 1) since the
 * pinned chip doesn't carry layer count.
 */
export function applyPinToggle(field: FieldState, key: string): Partial<FieldState> {
  if (key.startsWith('weather:')) {
    const v = key.slice(8) as WeatherValue;
    return { weather: field.weather === v ? undefined : v };
  }
  if (key.startsWith('terrain:')) {
    const v = key.slice(8) as TerrainValue;
    return { terrain: field.terrain === v ? undefined : v };
  }
  switch (key) {
    case 'tr':
      return { isTrickRoom: !field.isTrickRoom };
    case 'mr':
      return { isMagicRoom: !field.isMagicRoom };
    case 'wr':
      return { isWonderRoom: !field.isWonderRoom };
    case 'gravity':
      return { isGravity: !field.isGravity };
    case 'fairyAura':
      return { isFairyAura: !field.isFairyAura };
  }
  if (key.startsWith('yourSide:') || key.startsWith('oppSide:')) {
    const [side, flag] = key.split(':') as [PinSide, keyof SideState];
    const cur = field[side];
    let nextValue: SideState[keyof SideState];
    if (flag === 'spikes') {
      const on = !!(cur.spikes && cur.spikes > 0);
      nextValue = on ? 0 : 1;
    } else {
      nextValue = !cur[flag];
    }
    return { [side]: { ...cur, [flag]: nextValue } } as Partial<FieldState>;
  }
  return {};
}
