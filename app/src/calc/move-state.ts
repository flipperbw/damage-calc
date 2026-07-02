import { toID } from '@/calc/gen';
import type { SavedMon } from '@/types';

/**
 * Registry of moves whose base power depends on hidden battle state the calc
 * can't infer from a static build. The vendored calc stores these at their
 * flat base power (Last Respects and Rage Fist are both 50 BP) with no
 * scaling, so without user input the calc under-reports their damage.
 *
 * Each entry describes the counter control the UI renders and how the chosen
 * value maps to a base-power override passed to `new Move(..., { overrides })`.
 * Keeping this knowledge in one small table makes adding a move a one-line
 * change and keeps the formulas unit-testable in isolation.
 *
 * `kind: 'toggle'` is reserved for a future tier of conditional doublers
 * (Bolt Beak, Fishious Rend, Payback, Assurance, ...) and is not yet used.
 */
export interface MoveStateSpec {
  kind: 'counter';
  /** Short label shown next to the stepper, e.g. "Allies fainted". */
  label: string;
  min: number;
  max: number;
  /** Value used when the user hasn't set one - 0 reproduces today's behavior. */
  default: number;
  /** Maps the chosen value to the move's effective base power. */
  bp: (value: number) => number;
}

const MOVE_STATE: Record<string, MoveStateSpec> = {
  // Last Respects: BP = 50 * (1 + number of fainted party members). Up to 5
  // allies can have fainted, so BP tops out at 300.
  lastrespects: { kind: 'counter', label: 'Allies fainted', min: 0, max: 5, default: 0, bp: (n) => 50 * (n + 1) },
  // Rage Fist: BP = 50 + 50 * (times the user has been hit), capped at 6 hits
  // (350 BP) in-game.
  ragefist: { kind: 'counter', label: 'Times hit', min: 0, max: 6, default: 0, bp: (n) => 50 + 50 * n },
};

/** The spec for a move by name, or undefined if the move needs no battle state. */
export function getMoveStateSpec(moveName: string | undefined): MoveStateSpec | undefined {
  if (!moveName) return undefined;
  return MOVE_STATE[toID(moveName)];
}

/** Clamp a raw value into the spec's [min, max] range. */
export function clampMoveStateValue(spec: MoveStateSpec, value: number): number {
  if (!Number.isFinite(value)) return spec.default;
  return Math.min(spec.max, Math.max(spec.min, Math.round(value)));
}

/**
 * The base-power override for a mon's move, or undefined when the move needs
 * no battle state (so the caller leaves the calc's default BP untouched). Reads
 * the stored per-move value from `mon.moveState`, falling back to the spec
 * default (which reproduces the flat base power for the counter moves shipped
 * today, since their default is 0).
 */
export function moveStateBasePower(moveName: string | undefined, mon: Pick<SavedMon, 'moveState'>): number | undefined {
  const spec = getMoveStateSpec(moveName);
  if (!spec) return undefined;
  const raw = mon.moveState?.[toID(moveName!)];
  const value = raw === undefined ? spec.default : clampMoveStateValue(spec, raw);
  return spec.bp(value);
}
