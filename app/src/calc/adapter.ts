import { calculate, Field, Move, Pokemon, TYPE_CHART } from '@smogon/calc';

import { GEN, toID } from '@/calc/gen';
import { effectiveAbility, megaFormeName } from '@/calc/helpers';
import { priorityOverride } from '@/data/pkmn';
import type { FieldState, SavedMon, SideState, StatusName } from '@/types';

const STATUS_TO_CALC: Record<Exclude<StatusName, 'Healthy'>, 'psn' | 'tox' | 'brn' | 'par' | 'slp' | 'frz'> = {
  Poisoned: 'psn',
  'Badly Poisoned': 'tox',
  Burned: 'brn',
  Paralyzed: 'par',
  Asleep: 'slp',
  Frozen: 'frz',
};

export interface MoveResult {
  moveName: string;
  type: string;
  category: string;
  priority: number;
  damageRange: [number, number]; // raw HP damage
  percentRange: [number, number]; // % of defender max HP, integer
  koChanceText: string; // e.g. "guaranteed OHKO", "44.5% chance to 2HKO"
  isStatus: boolean;
  /**
   * Type-effectiveness multiplier of this move's type vs the defender's
   * types. 0/0.25/0.5/1/2/4. Defaults to 1 for status moves or when the
   * type isn't found in the chart.
   */
  effectiveness: number;
}

export interface ComputedStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface MatchupResult {
  attackerMoves: MoveResult[];
  defenderMoves: MoveResult[];
  speed: {
    attackerSpe: number;
    defenderSpe: number;
    /** Effective: when Trick Room is on, this is reversed from the raw stat. */
    attackerOutspeeds: boolean;
    delta: number;
    /** True when Trick Room is in effect - UI may show a callout. */
    trickRoom: boolean;
  };
  defenderMaxHp: number;
  attackerMaxHp: number;
  attackerStats: ComputedStats;
  defenderStats: ComputedStats;
}

function speciesForCalc(mon: SavedMon): string {
  // The mega flag is a UI affordance; calc identifies mega by species suffix.
  // Resolve to a mega forme based on mon.mega and validate the species exists
  // in the calc's species DB; if not, fall back to the base species.
  const candidate = megaFormeName(mon.species, mon.mega);
  if (candidate === mon.species) return mon.species;
  if (GEN.species.get(toID(candidate) as any)) return candidate;
  // eslint-disable-next-line no-console
  console.warn(`Mega forme "${candidate}" not found; falling back to "${mon.species}".`);
  return mon.species;
}

function buildPokemon(mon: SavedMon) {
  // When mega'd, override the user's base-form ability with the mega forme's
  // ability (Mega Charizard X = Tough Claws, etc.). The base ability is
  // preserved on the saved mon — this is purely a calc-time substitution.
  const ability = effectiveAbility(mon.species, mon.mega, mon.ability);
  return new Pokemon(GEN, speciesForCalc(mon), {
    item: mon.item || undefined,
    ability: ability || undefined,
    nature: mon.nature,
    evs: mon.sps, // Champions: sps map onto evs (verified in spike)
    boosts: mon.boosts,
    status: !mon.status || mon.status === 'Healthy' ? '' : STATUS_TO_CALC[mon.status],
    curHP: mon.currentHp,
  });
}

function buildField(state: FieldState, gameType: 'Singles' | 'Doubles' = 'Singles'): Field {
  return new Field({
    gameType,
    weather: state.weather,
    terrain: state.terrain,
    isMagicRoom: state.isMagicRoom,
    isWonderRoom: state.isWonderRoom,
    isGravity: state.isGravity,
    attackerSide: buildSide(state.yourSide),
    defenderSide: buildSide(state.oppSide),
  });
}

function buildSide(s: SideState) {
  return {
    isSR: !!s.stealthRock,
    spikes: s.spikes ?? 0,
    isReflect: !!s.reflect,
    isLightScreen: !!s.lightScreen,
    isAuroraVeil: !!s.auroraVeil,
    isTailwind: !!s.tailwind,
    isProtected: !!s.protect,
    isSeeded: !!s.leechSeed,
    isSaltCure: !!s.saltCure,
    isHelpingHand: !!s.helpingHand,
    isPowerTrick: !!s.isPowerTrick,
    isFriendGuard: !!s.friendGuard,
    isStatBoost: !!s.isStatBoost,
    isSwitching: s.isSwitching ? ('out' as const) : undefined,
  };
}

// Champions uses gen 0 of TYPE_CHART; chart is keyed [atkType][defType] = mult.
const CHAMPIONS_TYPE_CHART = TYPE_CHART[0];

/**
 * Compute the type-effectiveness multiplier for moveType vs defender types.
 * Returns 0/0.25/0.5/1/2/4. Falls back to 1 for unknown types.
 */
export function typeEffectiveness(moveType: string, defenderTypes: readonly string[]): number {
  if (!moveType || moveType === '???') return 1;
  const row = (CHAMPIONS_TYPE_CHART as any)[moveType];
  if (!row) return 1;
  let mult = 1;
  for (const def of defenderTypes) {
    if (!def) continue;
    const v = row[def];
    if (typeof v === 'number') mult *= v;
  }
  return mult;
}

function buildMoveResult(moveName: string, attacker: Pokemon, defender: Pokemon, field: Field): MoveResult {
  if (!moveName) {
    return emptyMoveResult();
  }
  const move = new Move(GEN, moveName);
  const result = calculate(GEN, attacker, defender, move, field);
  const range = result.range(); // [min, max] raw damage
  const maxHp = defender.maxHP();
  const isStatus = move.category === 'Status' || range[1] === 0;
  const percent: [number, number] = isStatus ? [0, 0] : [Math.floor((range[0] / maxHp) * 100), Math.floor((range[1] / maxHp) * 100)];
  let koText = '';
  try {
    koText = isStatus ? '' : result.kochance().text;
  } catch {
    koText = '';
  }
  const effectiveness = move.category === 'Status' ? 1 : typeEffectiveness(move.type as string, defender.species.types as readonly string[]);
  // Calc's Champions (gen-0) move data omits priority for several
  // Champions-legal moves (Trick Room, Roar, Whirlwind, …), reporting 0
  // where the real priority is non-zero. When @pkmn/data has a non-zero
  // value we trust it over calc's silence.
  const calcPriority = move.priority ?? 0;
  const override = priorityOverride(move.name as string);
  const priority = calcPriority === 0 && override !== null ? override : calcPriority;
  return {
    moveName: move.name,
    type: move.type,
    category: move.category,
    priority,
    damageRange: isStatus ? [0, 0] : [range[0], range[1]],
    percentRange: percent,
    koChanceText: koText,
    isStatus,
    effectiveness,
  };
}

function emptyMoveResult(): MoveResult {
  return {
    moveName: '',
    type: '',
    category: '',
    priority: 0,
    damageRange: [0, 0],
    percentRange: [0, 0],
    koChanceText: '',
    isStatus: true,
    effectiveness: 1,
  };
}

export function calculateMatchup(you: SavedMon, opp: SavedMon, field: FieldState, format: 'singles' | 'doubles' = 'singles'): MatchupResult {
  // Champions Doubles applies a 0.75x spread reduction to multi-target moves
  // (Earthquake, Discharge, Eruption, Surf, ...). Calc handles the move-target
  // detection internally; we just need to flip Field.gameType.
  const gameType = format === 'doubles' ? 'Doubles' : 'Singles';
  const yourSide = buildField(field, gameType);
  // Field is asymmetric - attacker/defender perspective swaps. Build twice.
  const oppSide = buildField({ ...field, yourSide: field.oppSide, oppSide: field.yourSide }, gameType);

  const attacker = buildPokemon(you);
  const defender = buildPokemon(opp);

  const attackerMoves = you.moves.map((m) => buildMoveResult(m, attacker.clone(), defender.clone(), yourSide));
  const defenderMoves = opp.moves.map((m) => buildMoveResult(m, defender.clone(), attacker.clone(), oppSide));

  const attackerSpe = attacker.stats.spe;
  const defenderSpe = defender.stats.spe;

  // Trick Room reverses speed order - the slower mon moves first. We expose
  // `attackerOutspeeds` as "you act first this turn" so the UI reads naturally.
  const trickRoom = !!field.isTrickRoom;
  const rawOutspeed = attackerSpe > defenderSpe;
  const attackerOutspeeds = trickRoom ? attackerSpe < defenderSpe : rawOutspeed;

  return {
    attackerMoves,
    defenderMoves,
    speed: {
      attackerSpe,
      defenderSpe,
      attackerOutspeeds,
      delta: attackerSpe - defenderSpe,
      trickRoom,
    },
    attackerMaxHp: attacker.maxHP(),
    defenderMaxHp: defender.maxHP(),
    attackerStats: pickStats(attacker.stats),
    defenderStats: pickStats(defender.stats),
  };
}

function pickStats(s: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number }): ComputedStats {
  return { hp: s.hp, atk: s.atk, def: s.def, spa: s.spa, spd: s.spd, spe: s.spe };
}
