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
  /** True iff move.category === 'Status' (Swords Dance, Roar, Thunder Wave). */
  isStatus: boolean;
  /**
   * True iff the move is damaging but deals 0 to this defender (ability
   * immunity like Flash Fire, type immunity like Normal vs Ghost). Distinct
   * from isStatus so the UI can render "Immune" instead of "-".
   */
  isImmune: boolean;
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

type CalcRole = 'attacker' | 'defender';

/**
 * Mid-battle forme switch: pre-activation form is what the user team-builds
 * with (and what the species picker exposes), but the activated form's stats
 * are what apply during the calculation. Role-aware because some species only
 * switch in one direction:
 *
 *   - Aegislash (Stance Change): Shield ↔ Blade flips per attacking move.
 *     When attacking, use Blade (140 Atk / 140 SpA, 50 Def / 50 SpD). When
 *     defending, stay in Shield (50/50 offensive, 140/140 defensive).
 *   - Palafin (Zero to Hero): Zero → Hero is a permanent one-way switch after
 *     the first switch-out. By the time a matchup is being calc'd it's almost
 *     always already activated, so substitute Hero in both roles.
 *
 * Mimikyu-Busted, Morpeko-Hangry, Castform-Sunny/Rainy/Snowy are mid-battle
 * formes too but share base stats with their parent, so calc doesn't care.
 */
function inBattleForme(species: string, role: CalcRole): string {
  if (role === 'attacker') {
    if (species === 'Aegislash' || species === 'Aegislash-Shield') return 'Aegislash-Blade';
    if (species === 'Palafin') return 'Palafin-Hero';
  } else {
    if (species === 'Palafin') return 'Palafin-Hero';
  }
  return species;
}

function speciesForCalc(mon: SavedMon, role: CalcRole): string {
  // First apply the in-battle forme switch so the calc sees the form whose
  // stats actually matter in this role. Then layer the mega-stone suffix on
  // top — Aegislash / Palafin don't have megas, so the two stages don't
  // overlap in practice, but order it this way for safety.
  const base = inBattleForme(mon.species, role);
  if (!mon.mega) return base;
  // Standard {base}-Mega(-X|-Y)? naming first — covers nearly every mega.
  const candidate = megaFormeName(base, mon.mega);
  if (candidate !== base && GEN.species.get(toID(candidate) as any)) return candidate;
  // Irregular naming fallback: scan the species table for a mega forme
  // that links back to this species via calc's `baseSpecies` field.
  // Floette-Eternal → Floette-Mega is the live example; the name doesn't
  // follow `{base}-Mega` so the lookup above misses it.
  for (const sp of GEN.species) {
    const linkedBase = (sp as unknown as { baseSpecies?: string }).baseSpecies;
    if (linkedBase !== base) continue;
    const n = sp.name;
    if (mon.mega === 'mega-x' && n.endsWith('-Mega-X')) return n;
    if (mon.mega === 'mega-y' && n.endsWith('-Mega-Y')) return n;
    if (mon.mega === 'mega' && n.endsWith('-Mega') && !n.endsWith('-Mega-X') && !n.endsWith('-Mega-Y')) return n;
  }
  // eslint-disable-next-line no-console
  console.warn(`Mega forme for "${base}" (mega=${mon.mega}) not found; falling back to base.`);
  return base;
}

function buildPokemon(mon: SavedMon, role: CalcRole) {
  // When mega'd, override the user's base-form ability with the mega forme's
  // ability (Mega Charizard X = Tough Claws, etc.). The base ability is
  // preserved on the saved mon — this is purely a calc-time substitution.
  const ability = effectiveAbility(mon.species, mon.mega, mon.ability);
  // Guard against items that aren't in Champions' gen-0 item table (e.g.
  // Choice Band, Choice Specs, Life Orb, Assault Vest). Passing one of
  // those crashes calc when it later dereferences the item record. Pass
  // undefined instead so the matchup still resolves.
  const itemKnown = mon.item ? !!GEN.items.get(toID(mon.item) as any) : false;
  return new Pokemon(GEN, speciesForCalc(mon, role), {
    item: itemKnown ? mon.item : undefined,
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
    isFairyAura: state.isFairyAura,
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
    isSaltCured: !!s.saltCure,
    isHelpingHand: !!s.helpingHand,
    isPowerTrick: !!s.isPowerTrick,
    isFriendGuard: !!s.friendGuard,
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
  let move: Move;
  let result: ReturnType<typeof calculate>;
  try {
    move = new Move(GEN, moveName);
    result = calculate(GEN, attacker, defender, move, field);
  } catch (err) {
    // Calc can throw when its internal data lookups fail (e.g. an unknown
    // item that earlier got past our buildPokemon guard, an unknown move
    // name, a species without baseStats). Yield an empty result so one
    // bad row doesn't blow up the whole BattleScreen.
    // eslint-disable-next-line no-console
    console.warn(`calc failed for move "${moveName}":`, err);
    return emptyMoveResult();
  }
  const range = result.range(); // [min, max] raw damage
  const maxHp = defender.maxHP();
  const isStatus = move.category === 'Status';
  // "Immune" = damaging move that deals 0 to this defender (type chart
  // immunity OR ability immunity). Distinct from isStatus so the UI can
  // show the Immune badge rather than suppressing damage entirely.
  const isImmune = !isStatus && range[1] === 0;
  const noDamage = isStatus || isImmune;
  const percent: [number, number] = noDamage ? [0, 0] : [Math.floor((range[0] / maxHp) * 100), Math.floor((range[1] / maxHp) * 100)];
  let koText = '';
  try {
    koText = noDamage ? '' : result.kochance().text;
  } catch {
    koText = '';
  }
  // Effectiveness shown on the row uses the type chart but cross-checks
  // against calc's actual damage range so ability overrides land correctly:
  //   - Scrappy / Mind's Eye let Normal & Fighting hit Ghost — chart says
  //     0, range is positive, so display neutral (1x).
  //   - Levitate / Flash Fire / Volt Absorb / Sap Sipper / etc. — chart
  //     may say 1x+ but calc returns 0 damage; display Immune.
  const chartEff = typeEffectiveness(move.type as string, defender.species.types as readonly string[]);
  let effectiveness: number;
  if (move.category === 'Status') {
    effectiveness = 1;
  } else if (range[1] === 0) {
    effectiveness = 0;
  } else if (chartEff === 0) {
    effectiveness = 1;
  } else {
    effectiveness = chartEff;
  }
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
    damageRange: noDamage ? [0, 0] : [range[0], range[1]],
    percentRange: percent,
    koChanceText: koText,
    isStatus,
    isImmune,
    effectiveness,
  };
}

/**
 * Compute the in-battle speed for a Pokemon, accounting for field/side/item
 * /ability/status modifiers. Mirrors calc's internal `getFinalSpeed` for
 * the Champions (gen 0) generation, which uses post-gen-7 mechanics: 50%
 * paralysis penalty, Choice Scarf 1.5x, weather-ability 2x, etc.
 */
function effectiveSpeed(pokemon: Pokemon, field: FieldState, side: SideState): number {
  // Pokemon.rawStats.spe is the post-nature/SP base; pokemon.boosts.spe is
  // the -6..+6 stage. We layer the modifiers calc would apply on top.
  let speed = withBoostStage((pokemon as unknown as { rawStats: { spe: number } }).rawStats.spe, pokemon.boosts.spe ?? 0);
  const weather = field.weather;
  const terrain = field.terrain;
  const ability = ((pokemon as unknown as { ability?: string }).ability ?? '').toString();
  const item = ((pokemon as unknown as { item?: string }).item ?? '').toString();
  const status = ((pokemon as unknown as { status?: string }).status ?? '').toString();

  // Tailwind doubles speed for the user's side.
  if (side.tailwind) speed = Math.floor(speed * 2);

  // Weather/terrain speed abilities.
  const weatherAbility =
    (ability === 'Chlorophyll' && weather === 'Sun') ||
    (ability === 'Sand Rush' && weather === 'Sand') ||
    (ability === 'Swift Swim' && weather === 'Rain') ||
    (ability === 'Slush Rush' && weather === 'Snow') ||
    (ability === 'Surge Surfer' && terrain === 'Electric');
  if (weatherAbility) speed = Math.floor(speed * 2);
  else if (ability === 'Quick Feet' && status && status !== '') speed = Math.floor(speed * 1.5);

  // Item-based modifiers. Choice Scarf: 1.5x. Iron Ball: 0.5x. Quick Powder
  // doubles speed but only on Ditto (rare; we skip the species check since
  // setting Quick Powder on anything else is user error).
  if (item === 'Choice Scarf') speed = Math.floor(speed * 1.5);
  else if (item === 'Iron Ball') speed = Math.floor(speed * 0.5);

  // Paralysis: 50% in gen 7+ (Champions is gen 0 with post-gen-7 mechanics).
  // Quick Feet immunes the penalty (handled above by giving the +50%).
  if (status === 'par' && ability !== 'Quick Feet') speed = Math.floor(speed * 0.5);

  return Math.max(0, speed);
}

function withBoostStage(stat: number, stage: number): number {
  if (stage === 0) return stat;
  const num = stage > 0 ? 2 + stage : 2;
  const den = stage < 0 ? 2 - stage : 2;
  return Math.floor((stat * num) / den);
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
    isImmune: false,
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

  // Build attacker-role and defender-role variants of each mon so the
  // Aegislash / Palafin in-battle forme switch lands in the right place:
  //   - your moves vs opp: you in attacker role, opp in defender role
  //   - opp's moves vs you: opp in attacker role, you in defender role
  // For mons without a mid-battle forme switch the two variants are
  // identical and the extra construction is cheap.
  //
  // Pokemon construction can throw when the saved species name doesn't
  // resolve in calc's species DB — e.g. a typo that got past an older
  // importer ("erg"), or a forme calc doesn't ship for gen 0. Catch the
  // throw and return a degraded matchup rather than letting it unwind
  // through React's render and brick the page. The UI still renders the
  // mons by name + sprite; only the calc'd damage rows go blank.
  let yourAsAttacker: Pokemon;
  let yourAsDefender: Pokemon;
  let oppAsAttacker: Pokemon;
  let oppAsDefender: Pokemon;
  try {
    yourAsAttacker = buildPokemon(you, 'attacker');
    yourAsDefender = buildPokemon(you, 'defender');
    oppAsAttacker = buildPokemon(opp, 'attacker');
    oppAsDefender = buildPokemon(opp, 'defender');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('calc setup failed (likely an invalid species):', err);
    return emptyMatchup();
  }

  const attackerMoves = you.moves.map((m) => buildMoveResult(m, yourAsAttacker.clone(), oppAsDefender.clone(), yourSide));
  const defenderMoves = opp.moves.map((m) => buildMoveResult(m, oppAsAttacker.clone(), yourAsDefender.clone(), oppSide));

  // Effective speed accounts for Tailwind, Choice Scarf, Iron Ball,
  // paralysis, Chlorophyll/Swift Swim/Sand Rush/Slush Rush in the right
  // weather, Surge Surfer in Electric terrain, Quick Feet with status.
  // Calc's internal getFinalSpeed handles all of this when calculate()
  // runs, but it operates on clones — the originals retain raw stats.spe.
  // Computing it explicitly here keeps the SpeedDivider truthful.
  // Use the attacker-role variant — Spe is the same across our forme
  // substitutions (Aegislash both formes: 60; Palafin both formes: 100).
  const attackerSpe = effectiveSpeed(yourAsAttacker, field, field.yourSide);
  const defenderSpe = effectiveSpeed(oppAsAttacker, field, field.oppSide);

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
    // The displayed stats / max HP on the BattleScreen MonCards reflect the
    // form each mon is in *when attacking*. For Aegislash-Shield the user
    // sees Blade's huge Atk/SpA, which lines up with the "your moves → opp"
    // damage rows. HP is identical across both formes for the substitutions
    // we apply, so the HP bar doesn't drift between perspectives.
    attackerMaxHp: yourAsAttacker.maxHP(),
    defenderMaxHp: oppAsAttacker.maxHP(),
    attackerStats: pickStats(yourAsAttacker.stats),
    defenderStats: pickStats(oppAsAttacker.stats),
  };
}

function pickStats(s: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number }): ComputedStats {
  return { hp: s.hp, atk: s.atk, def: s.def, spa: s.spa, spd: s.spd, spe: s.spe };
}

/**
 * Empty matchup returned when calc setup fails — e.g. one of the saved mons
 * has a species name that doesn't exist in calc's species DB (typically a
 * stale typo in localStorage from before species validation existed). Keeps
 * the BattleScreen renderable instead of unwinding the React tree on a
 * thrown calc error.
 */
function emptyMatchup(): MatchupResult {
  const zeroStats: ComputedStats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  return {
    attackerMoves: [emptyMoveResult(), emptyMoveResult(), emptyMoveResult(), emptyMoveResult()],
    defenderMoves: [emptyMoveResult(), emptyMoveResult(), emptyMoveResult(), emptyMoveResult()],
    speed: { attackerSpe: 0, defenderSpe: 0, attackerOutspeeds: false, delta: 0, trickRoom: false },
    attackerMaxHp: 0,
    defenderMaxHp: 0,
    attackerStats: zeroStats,
    defenderStats: zeroStats,
  };
}
