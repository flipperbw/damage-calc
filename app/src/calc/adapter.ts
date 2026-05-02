import {
  Generations,
  Pokemon,
  Move,
  Field,
  calculate,
  toID,
} from '@smogon/calc';
import type { SavedMon, FieldState, SideState, StatusName } from '../types';

const STATUS_TO_CALC: Record<Exclude<StatusName, 'Healthy'>, 'psn' | 'tox' | 'brn' | 'par' | 'slp' | 'frz'> = {
  Poisoned: 'psn',
  'Badly Poisoned': 'tox',
  Burned: 'brn',
  Paralyzed: 'par',
  Asleep: 'slp',
  Frozen: 'frz',
};

const GEN = Generations.get(0); // Champions

export interface MoveResult {
  moveName: string;
  type: string;
  category: string;
  priority: number;
  damageRange: [number, number];     // raw HP damage
  percentRange: [number, number];    // % of defender max HP, integer
  koChanceText: string;              // e.g. "guaranteed OHKO", "44.5% chance to 2HKO"
  isStatus: boolean;
}

export interface MatchupResult {
  attackerMoves: MoveResult[];
  defenderMoves: MoveResult[];
  speed: {
    attackerSpe: number;
    defenderSpe: number;
    attackerOutspeeds: boolean;
    delta: number;
  };
  defenderMaxHp: number;
  attackerMaxHp: number;
}

function speciesForCalc(mon: SavedMon): string {
  // The mega flag is a UI affordance; calc identifies mega by species suffix.
  // Saved species is the canonical (non-mega) form unless edited. We resolve
  // to a mega forme based on mon.mega and validate the species exists in the
  // calc's species DB; if not, fall back to the base species.
  if (!mon.mega) return mon.species;
  // If species is already a mega forme, trust it.
  if (mon.species.endsWith('-Mega') || mon.species.includes('-Mega-')) {
    return mon.species;
  }
  const suffix =
    mon.mega === 'mega' ? '-Mega'
    : mon.mega === 'mega-x' ? '-Mega-X'
    : mon.mega === 'mega-y' ? '-Mega-Y'
    : '';
  if (!suffix) return mon.species;
  const candidate = `${mon.species}${suffix}`;
  if (GEN.species.get(toID(candidate) as any)) return candidate;
  // eslint-disable-next-line no-console
  console.warn(`Mega forme "${candidate}" not found; falling back to "${mon.species}".`);
  return mon.species;
}

function buildPokemon(mon: SavedMon) {
  return new Pokemon(GEN, speciesForCalc(mon), {
    item: mon.item || undefined,
    ability: mon.ability || undefined,
    nature: mon.nature,
    evs: mon.sps,                  // Champions: sps map onto evs (verified in spike)
    boosts: mon.boosts,
    status:
      !mon.status || mon.status === 'Healthy'
        ? ''
        : STATUS_TO_CALC[mon.status],
    curHP: mon.currentHp,
  });
}

function buildField(state: FieldState): Field {
  return new Field({
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

function buildMoveResult(
  moveName: string,
  attacker: Pokemon,
  defender: Pokemon,
  field: Field,
): MoveResult {
  if (!moveName) {
    return emptyMoveResult();
  }
  const move = new Move(GEN, moveName);
  const result = calculate(GEN, attacker, defender, move, field);
  const range = result.range();             // [min, max] raw damage
  const maxHp = defender.maxHP();
  const isStatus = move.category === 'Status' || range[1] === 0;
  const percent: [number, number] = isStatus
    ? [0, 0]
    : [Math.floor((range[0] / maxHp) * 100), Math.floor((range[1] / maxHp) * 100)];
  let koText = '';
  try {
    koText = isStatus ? '' : result.kochance().text;
  } catch {
    koText = '';
  }
  return {
    moveName: move.name,
    type: move.type,
    category: move.category,
    priority: move.priority ?? 0,
    damageRange: isStatus ? [0, 0] : [range[0], range[1]],
    percentRange: percent,
    koChanceText: koText,
    isStatus,
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
  };
}

export function calculateMatchup(
  you: SavedMon,
  opp: SavedMon,
  field: FieldState,
): MatchupResult {
  const yourSide = buildField(field);
  // Field is asymmetric — attacker/defender perspective swaps. Build twice.
  const oppSide = buildField({ ...field, yourSide: field.oppSide, oppSide: field.yourSide });

  const attacker = buildPokemon(you);
  const defender = buildPokemon(opp);

  const attackerMoves = you.moves.map(m =>
    buildMoveResult(m, attacker.clone(), defender.clone(), yourSide),
  );
  const defenderMoves = opp.moves.map(m =>
    buildMoveResult(m, defender.clone(), attacker.clone(), oppSide),
  );

  const attackerSpe = attacker.stats.spe;
  const defenderSpe = defender.stats.spe;

  return {
    attackerMoves,
    defenderMoves,
    speed: {
      attackerSpe,
      defenderSpe,
      attackerOutspeeds: attackerSpe > defenderSpe,
      delta: attackerSpe - defenderSpe,
    },
    attackerMaxHp: attacker.maxHP(),
    defenderMaxHp: defender.maxHP(),
  };
}
