# Showdown Paste Import

**Date:** 2026-05-17
**Status:** Design — ready for plan
**Builds on:** `app/src/store/exporters.ts` (Showdown text export)

## Goal

Let the user paste a Pokémon Showdown team or single-mon block and turn it into Champions-legal `SavedMon[]` — either as a new team (Teams screen entry point) or to fill a slot in the editor (MonEditor entry point). Optimize for the common case of pasting from Smogon threads, usage stats, or our own export.

## Non-goals

- No round-tripping of non-Champions concepts: IVs, Tera Type, Gigantamax, Dynamax, Shiny, Nickname, Gender, Happiness, EV/IV style fields outside our model are dropped silently.
- No history of past imports, no undo beyond the user re-pasting.
- No "import from URL" — paste-only.
- No reverse direction (export already exists).

## Decisions (from brainstorm)

| # | Decision |
|---|----------|
| Entry points | Two: Teams screen "Import" button (whole team) and MonEditor "Paste Showdown" action (single slot, with multi-mon handling). |
| Validation | Lenient. Drop illegal items/abilities/moves; clamp out-of-range SPs. Always import what's salvageable. |
| EV → SP | Detect spread style. If the spread looks like literal SPs (every value ≤ 32, total ≤ 66) keep it literal; otherwise scale `sp = round(ev * 32 / 252)` and trim from the smallest non-zero stat if total > 66. |
| Teams target | Always creates a new team — auto-named from `=== Name ===` header if present, else `"{first species}'s team"`. |
| MonEditor multi-mon | Preview shows all parsed mons. Footer offers two actions: fill the current slot with the first mon, or import all as a new team. |
| Feedback | Live preview as the user pastes. Clean pastes commit in one click + success toast. When the parser made any adjustments, the preview surfaces them inline per mon (yellow = scaled/clamped, red = dropped, gray = ignored). |

## Architecture

Three pieces, with the parser fully decoupled from React.

### `app/src/store/importers.ts`

Pure parser + adapter. No React, no toast, no store access. Exports:

```ts
export type ImportChangeKind =
  | 'item-dropped'        // value not in Champions allowlist
  | 'ability-dropped'
  | 'move-dropped'
  | 'sps-scaled'          // EV style detected, converted to SP
  | 'sps-clamped'         // values truncated to fit caps after scaling
  | 'field-ignored'       // Tera/Shiny/IVs/Nickname/Level/etc.
  | 'mon-dropped';        // surplus mons past the team cap of 6

export interface ImportChange {
  monIndex: number;       // index within the paste
  kind: ImportChangeKind;
  field: string;          // 'item' | 'ability' | 'moves[2]' | 'sps' | 'tera' | ...
  before: string;         // raw value from the paste
  after?: string;         // value used (omitted for drops/ignored)
  detail?: string;        // human-readable detail, e.g. "Atk 252 → 32"
}

export interface ParsedMon {
  /** Result is suitable to pass through existing factories.makeMon then validators. */
  draft: Omit<SavedMon, 'id'>;
  /** Display name for the preview row. */
  displayName: string;
}

export interface ParseResult {
  mons: ParsedMon[];
  teamName: string | null;     // from === Name === header
  changes: ImportChange[];     // empty when paste is clean
  unparseable: string[];       // text blocks that didn't match any mon shape
}

export function parseShowdownText(text: string): ParseResult;
```

The parser is the source of truth for "is this Champions-legal." It looks up items/abilities/moves against the same data the existing validators/adapters use (the `@smogon/calc` Champions allowlist and our setdex). Drops are recorded, not thrown.

### `app/src/components/ShowdownImportDialog.tsx`

The single shared UI. A modal/sheet with:

- **Title** — "Import Showdown" (or context-specific subtitle: "Replace slot 3" for MonEditor entry).
- **Textarea** — auto-focused. Placeholder shows a one-mon example in our export format.
- **Live preview** — re-renders on every textarea change, debounced 100 ms. Renders one row per `ParsedMon`:
  - Sprite + display name (with mega prefix when inferred from item)
  - Item, ability, nature, moves
  - Compact SP summary, e.g. `32 HP / 32 SpA / 2 Spe`
  - Inline change chips for any `ImportChange` whose `monIndex` matches: yellow for `sps-scaled`/`sps-clamped`, red for `*-dropped`, gray for `field-ignored`
- **Empty state** — when textarea is empty: a short hint + a "paste our format" example.
- **Unparseable state** — when textarea has content but `mons` is empty: "Couldn't detect any mons. Each block should start with a species name." Lists any captured-but-unmatched lines from `result.unparseable`.
- **Summary line** above the preview: `"6 mons detected · 3 adjustments"`.
- **Footer buttons** — context-dependent (see below). Disabled until `mons.length > 0`.

Props:

```ts
type Props =
  | { mode: 'team'; onClose: () => void; }
  | { mode: 'slot'; slotIndex: number; teamId: string; onClose: () => void; };
```

### Entry-point integration

**Teams screen** (`app/src/screens/TeamsScreen.tsx`):
- New "Import" button alongside the existing per-team "Copy as Showdown" action.
- Opens `<ShowdownImportDialog mode="team" />`.
- Footer button: **"Import as new team"** → calls `addTeam(...)` with parsed mons, then switches to that team.

**MonEditor** (`app/src/components/editor/MonEditor.tsx`):
- "Paste Showdown" action in the same menu as the existing "Copy as Showdown" action.
- Opens `<ShowdownImportDialog mode="slot" slotIndex={...} teamId={...} />`.
- Footer buttons depend on parsed count:
  - `mons.length === 1`: single button **"Fill {SpeciesName} slot"** → replaces the target slot.
  - `mons.length > 1`: two buttons — **"Fill slot with {first}"** (replaces target slot only) and **"Import all N as new team"** (calls `addTeam(...)` and switches to it).
- Closing the dialog after commit returns to the editor with the target slot updated (or to the new team).

## Parser internals

Pseudocode of `parseShowdownText`:

```
1. Split text into mon blocks.
   - Detect a leading "=== Name ===" header; capture as teamName.
   - Split remaining text on \n\s*\n (one or more blank lines).
   - Each block is candidate for a mon.

2. For each block (index = monIndex):
   - Line 1 = head: "{species} @ {item}" | "{species}".
     - If "(Nickname)" appears: record field-ignored for 'nickname' and strip it.
     - "Species-Mega-X"/-Y forme suffix on the head is read but normalized: real
       species lookup uses the bare name; mega state comes from the item.
   - Parse remaining lines by prefix:
     - `Ability: X`  → ability candidate
     - `Level: N`    → field-ignored 'level' (we are always 50)
     - `Tera Type:`  → field-ignored 'tera'
     - `Shiny: ...`  → field-ignored 'shiny'
     - `Happiness:`  → field-ignored 'happiness'
     - `IVs: ...`    → field-ignored 'ivs'
     - `Gigantamax`  → field-ignored 'gmax'
     - `EVs: 252 HP / 4 Atk / ...` → raw EV map keyed by Showdown stat label
     - `{Nature} Nature` → nature candidate
     - `- {Move}`    → move candidate (up to 4)
     - Anything else → push to result.unparseable.
   - Normalize values:
     - Item: lookup against Champions item allowlist. Miss → drop, record 'item-dropped'.
     - Ability: same. Mega-forme override (`effectiveAbility`) is applied at calc time, not here — we keep whatever ability the paste declared, dropping only if not in the allowlist.
     - Moves: lookup against Champions move list. Strip bracketed Hidden Power type, normalize hyphenation. Any miss → drop that slot, record 'move-dropped'. Empty slots remain '' so the move grid stays length-4.
     - Nature: if not a valid nature name, default to 'Hardy' and record 'field-ignored'.
   - Convert EVs → SPs (Q3 spec):
     - If raw values are present and (`max(values) ≤ 32 && sum(values) ≤ 66`): keep as literal SPs (we are reading a Champions-native paste).
     - Otherwise: scale `sps[stat] = round(raw * 32 / 252)`, clamp each to 0..32. If sum > 66, repeatedly subtract 1 from the smallest non-zero stat until sum == 66. Record 'sps-scaled', plus 'sps-clamped' when trimming happened.
   - Mega: scan item against the mega-stone table (existing setdex / calc data). Set `mega` to `'mega' | 'mega-x' | 'mega-y'` accordingly. If item is a non-Champions item, drop the item (above) and leave mega as ''.
   - Boosts / currentHp / status: not in Showdown paste format → defaults (no boosts, full HP, no status).

3. Return { mons, teamName, changes, unparseable }.
```

## Edge cases

- **Paste contains both `=== Header ===` and ad-hoc whitespace lines**: the header is matched once at the top of the string; subsequent `===` lines are treated as unparseable.
- **More than 6 mons**: parsed in full; the action surfaces a single inline warning ("8 mons — only first 6 will be imported"). The slice is performed at commit, and each trailing mon is recorded as a `mon-dropped` change so the preview can flag the dropped rows.
- **Round-trip from our own exporter**: header `=== {team name} ===`, no Tera / Level / Shiny, SPs already within caps → preview shows zero changes, clean import.
- **Species not in our setdex**: still parsed, item/ability/moves still validated against Champions allowlist. The editor's existing "unknown species" handling takes over after import.
- **Mega-stone item on the wrong species**: parsed item is dropped via the standard item lookup (mega stones are species-locked in calc data), recorded as 'item-dropped'.

## Testing

- `app/src/store/importers.test.ts`:
  - Round-trip: `monToShowdownText(m) → parseShowdownText → ParsedMon.draft` equals `m` (modulo id/metadata) for a handful of fixtures including mega-X, mega-Y, no-item, scarfer.
  - `teamToShowdownText(t) → parse` recovers team name and all mons clean (no changes).
  - Lenient dropping: Showdown paste with Life Orb, Hidden Power [Fire], Tera Type, Shiny Yes, IVs line, 252/252/4 spread → returns mon with item undefined, HP slot dropped, all extraneous fields ignored, SPs scaled to 32/32/1.
  - Literal-SP detection: paste with `EVs: 32 HP / 32 SpA / 2 Spe` keeps values literal, no `sps-scaled` change recorded.
  - Multi-mon paste with one totally garbage block: yields N-1 mons and a non-empty `unparseable`.
  - Empty / whitespace input → `mons: []`, `unparseable: []`, no exceptions.
- `app/src/components/ShowdownImportDialog.test.tsx` (Vitest + Testing Library):
  - Renders empty state with hint.
  - Renders preview with adjustment chips when parser reports changes.
  - "Fill slot" footer only when `mode==='slot'` and `mons.length === 1`; two buttons when `mode==='slot'` and `mons.length > 1`.
  - "Import as new team" calls `addTeam` once with N mons and switches active team.
- Playwright smoke (one happy path): open Teams → Import → paste a 6-mon Champions block → click Import → assert new team exists and is active.

## File-level summary

**Add**
- `app/src/store/importers.ts` — parser + types.
- `app/src/store/importers.test.ts` — parser tests.
- `app/src/components/ShowdownImportDialog.tsx` — shared dialog component.
- `app/src/components/ShowdownImportDialog.test.tsx` — dialog tests.

**Modify**
- `app/src/screens/TeamsScreen.tsx` — add "Import" button + dialog mount.
- `app/src/components/editor/MonEditor.tsx` — add "Paste Showdown" action + dialog mount.
- `app/src/components/editor/BuildDropdown.tsx` *(if the existing copy action lives here — confirmed at plan time)* — host the paste action alongside copy.

**No changes** to:
- `app/src/store/exporters.ts` (the export side is already correct).
- `app/src/types.ts` (no new fields).
- `app/src/calc/adapter.ts` (existing item/ability guards remain the last line of defense).

## Open question for the plan

The Teams-screen entry point and MonEditor entry point both want a single shared dialog. The plan needs to decide where the dialog is mounted at the React tree level (Teams screen owns it for `mode='team'`; MonEditor owns it for `mode='slot'`) vs. promoting it to `App.tsx` with a small store flag. Lean: each owner mounts its own instance — keeps state local and avoids a global modal flag for a low-frequency feature.
