# Battle UX Improvements - Design

Date: 2026-07-01

Four independent, user-requested improvements bundled into one spec. Each is
small and self-contained; they share no state and can be implemented in any
order.

1. Reorder mons within a team
2. Fix Deadliest/Tankiest turning a mega into a non-mega
3. A single "reset battle" button that clears both sides at once
4. Battle-state-dependent moves (Last Respects, Rage Fist, ...) get an editable option

## Feature A - Reorder team mons

### Problem
`TeamsScreen` renders `team.mons` in array order with no way to change it. Users
want to control ordering (lead position, etc.).

### Design
- Add a store action `reorderMon(teamId: string, fromIndex: number, toIndex: number)`
  that splices the mon out of `mons` and reinserts it at the target index, then
  bumps `updatedAt`. Ids stay stable, so any battle state keyed by mon id follows
  the mon.
- In the expanded team card list (`team.mons.map(...)` in `TeamsScreen.tsx`), add
  up/down arrow buttons to each mon row. Up is disabled for the first mon, down
  for the last. Buttons meet the 44px touch-target rule already used elsewhere.
- Reordering does not open the editor; it is a direct, in-place action.

### Rationale
Up/down arrows over drag-and-drop: this is a phone-first app, and touch
drag-reorder is unreliable and hard to make accessible. Arrows are simple,
predictable, and keyboard/screen-reader friendly.

## Feature B - Fix Deadliest/Tankiest un-megaing

### Problem
Viewing calcs for, e.g., Mega Swampert as the opponent and clicking Deadliest or
Tankiest turns it into non-mega Swampert.

### Root cause
`findHardestHitter` and `findTankiestBuild` in `app/src/calc/worst-case.ts` build
synthesized candidates from the **base** species and assign a Champions-legal
booster / resist berry / Leftovers as the held item. Megas must hold their mega
stone, so:
- The swapped-in item is no longer a mega stone. `MegaToggle` only renders when
  `isMegaStone(item)` is true, so the mon reads as non-mega even though
  `BattleScreen` preserves the `mega` flag on the result.
- The damage search itself ran on base-forme stats/typing/ability, so the
  "worst case" ranking was computed for the wrong forme.

### Design
Make the worst-case search mega-aware. The two functions gain awareness of the
current opponent's `mega` state and held (mega-stone) item:
- When the opponent is **not** mega: behavior is unchanged (full item search).
- When the opponent **is** mega:
  - Stamp `mega` on the synthesized result and lock the held item to the
    existing mega stone. Skip the booster/berry/Leftovers item search entirely
    (megas cannot hold those items).
  - Score damage on the true mega forme so move/ability ranking is correct. The
    calc already resolves the mega forme's stats and forces its ability via
    `effectiveAbility`, so the ability loop is a harmless no-op in this branch.

Concretely, the functions read `mega`/`item` from the passed-in `currentOpponent`
(already an argument) instead of adding new parameters, and thread them into
`buildAttacker` / `buildWall` so the synthesized `SavedMon` carries the mega flag
and stone. `BattleScreen`'s existing `mega: opponent.mega` preservation then lines
up with a stone-holding item, so `MegaToggle` keeps rendering.

### Rationale
Reuses the existing `currentOpponent` argument and the existing mega-forme
resolution in the calc adapter; no new plumbing, and the fix addresses both the
visual (item/toggle) and correctness (stats) halves of the bug.

## Feature C - Reset battle (both sides)

### Problem
There is no single control to clear the whole battle. Today each card has its own
per-side reset (HP/status/boosts), and the opponent has a separate worst-case
Revert. Users want one "reset everything" for the current battle.

### Design
Add one button on the Battle screen (in the header / field-bar area, visually
distinct from the per-card reset and the opponent Revert). One tap:
- Both sides: `currentHp -> undefined` (full), `boosts -> {}`, `status -> undefined`.
- Clears any active worst-case mode and reverts the opponent to its
  pre-worst-case snapshot (same effect as Revert), then clears the snapshot.
- Resets the field (weather / terrain / screens / other field toggles) to
  default.

Scope is the **current battle only** - it never touches saved team data. Because
it only clears transient tweaks that are cheap to redo, there is no confirmation
dialog.

Assumption (easily changed): the reset includes the field. If field should be
left alone, drop that one line.

### Rationale
Consolidates the existing per-side reset + Revert + field defaults into a single
obvious action without duplicating the per-card controls.

## Feature D - Battle-state-dependent moves

### Problem
Some moves have base power (or other properties) that depend on hidden battle
state the calc cannot infer from a static build. The vendored calc stores these
at their flat base BP (e.g. Last Respects and Rage Fist are both 50 BP) with no
scaling, so the calc under-reports their damage. Users need a way to tell the
calc the battle-state value.

### Scope of qualifying moves
Most "state" moves are already covered by existing editors and need nothing new:

| Battle state | Existing control |
| --- | --- |
| User HP % (Reversal, Flail) | current HP editor |
| User boosts (Stored Power, Power Trip, Punishment) | boosts editor |
| User status (Facade, Hex, Barb Barrage) | status editor |
| Field (Weather Ball, Rising Voltage, Terrain Pulse) | field bar |
| Held item present/absent (Acrobatics) | item picker |
| Defender HP % (Crush Grip, Hard Press, Wring Out) | opponent HP editor |

The genuinely-hidden counters, and the initial scope of this feature, are:
- **Last Respects** (Ghost, Physical): `BP = 50 * (fainted allies + 1)`, allies 0-5.
- **Rage Fist** (Ghost, Physical): `BP = 50 + 50 * (times hit)`, hits 0-6.

A later tier of conditional doublers (Bolt Beak, Fishious Rend, Payback,
Assurance, Avalanche, ...) can be added as `kind: 'toggle'` entries. The registry
is built to grow; these are explicitly out of scope for the first cut.

### Design

**Registry.** A new module (e.g. `app/src/calc/move-state.ts`) exports a map
keyed by move id:

```ts
interface MoveStateSpec {
  kind: 'counter';        // 'toggle' reserved for future conditional doublers
  label: string;          // e.g. 'Allies fainted', 'Times hit'
  min: number;
  max: number;
  default: number;        // 0 - so an unset move behaves exactly as today
  bp: (value: number) => number;
}

const MOVE_STATE: Record<string, MoveStateSpec> = {
  lastrespects: { kind: 'counter', label: 'Allies fainted', min: 0, max: 5, default: 0, bp: n => 50 * (n + 1) },
  ragefist:     { kind: 'counter', label: 'Times hit',      min: 0, max: 6, default: 0, bp: n => 50 + 50 * n },
};
```

Helper: `getMoveStateSpec(moveName): MoveStateSpec | undefined` (normalizes via
`toID`).

**Storage.** Add `moveState?: Record<string, number>` to `SavedMon`, keyed by move
**id** (not slot index) so values survive move reordering and slot edits. This
mirrors the existing per-mon override precedent (`inBattleForme`). Absent/`0`
means default (current behavior), so existing saved teams are unaffected and no
data migration is required.

**Calc.** In the adapter's `buildMoveResult` (which already constructs
`new Move(GEN, name, { overrides: { ... } })` for spread moves), look up the move
in the registry. If it qualifies and the attacker mon has a stored value, inject
`overrides: { bp: spec.bp(value) }`. The attacker's `moveState` must be threaded
from the `SavedMon` into the move-building path (`calculateMatchup` builds
`attackerMoves`); pass the raw `SavedMon` (or just its `moveState` map) alongside
the built `Pokemon` so `buildMoveResult` can read it.

**UI.** Inline stepper on the move row (`MoveRow.tsx`). For a qualifying move,
render a compact `label -/+ value` control at the end of the row. Changing it
writes through to the attacker mon's `moveState[moveId]` (same write path the
battle screen uses for HP/status/boosts, so it works for both the saved YOU mon
and the ad-hoc override, and for the opponent). The stepper clamps to
`[min, max]`. Non-qualifying moves render exactly as today. The move row must
receive the move's id and the current value; `MoveRow`'s props gain the value +
an `onChangeMoveState(moveId, value)` callback.

### Rationale
A data-driven registry keeps the special-case knowledge in one small, testable
place and makes adding moves a one-line change. Keying stored values by move id
avoids reorder/slot bugs. Reusing the existing `overrides` path means no calc
engine changes. Inline stepper is the most discoverable, lowest-friction UX
(chosen by the user) and only appears where relevant.

## Testing

Unit tests (Vitest):
- **A:** `reorderMon` store action - moves up, moves down, no-ops at the ends,
  bumps `updatedAt`, preserves ids.
- **B:** `worst-case.ts` - a mega opponent (e.g. Mega Swampert) run through
  `findHardestHitter` and `findTankiestBuild` returns a result that keeps
  `mega` set and a mega-stone item; damage is scored on the mega forme. A
  non-mega opponent is unchanged (regression guard on the existing item search).
- **C:** the reset handler (extract to a pure helper if practical) clears HP /
  boosts / status on both sides, reverts the worst-case snapshot, and resets the
  field.
- **D:** `move-state.ts` registry - `getMoveStateSpec` normalization; the `bp`
  formulas for Last Respects (0->50, 3->200, 5->300) and Rage Fist (0->50,
  6->350). Adapter test: a mon with `moveState` for Last Respects / Rage Fist
  yields the scaled BP in the calc result; without it, the flat 50 BP.

E2E tests (Playwright):
- **A:** reorder a team's mons via the arrows and assert the new visible order
  persists.
- **C:** tweak both sides (HP + a boost) in a battle, click reset, assert both
  sides return to full/clean.
- **D:** in a battle with a Rage Fist / Last Respects user, bump the inline
  stepper and assert the move's damage percentage increases.

## Out of scope
- Drag-and-drop reordering.
- Conditional-doubler toggle moves (Bolt Beak, Payback, etc.) - registry supports
  them later.
- Persisting worst-case mode across reloads.

## Changelog
Per repo convention, each user-facing change adds a bullet to
`app/src/content/CHANGELOG.md` alongside its code edit.
