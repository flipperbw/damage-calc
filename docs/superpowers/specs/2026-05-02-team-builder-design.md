# Phase 2 — Team Builder

**Date:** 2026-05-02
**Status:** Approved, ready to build
**Predecessor:** 2026-05-02-champions-redesign-design.md (Phase 1, shipped)

## Goal

Help the owner build their teams with awareness of:
1. Their team's offensive and defensive coverage gaps.
2. The current Pokémon Champions metagame — what they're likely to face and how they fare.
3. What single Pokémon they could add to most efficiently fix their weaknesses.

## Non-goals

- No team importing from Showdown text or URLs (Phase 2.5).
- No archetype filters (Sun, Perish Trap, etc.).
- No damage-calc-driven suggestion scoring; v1 uses type-chart math for speed.
- No automated team generation from scratch (only single-mon suggestions for an existing partial team).
- No PvP, no community sharing, no cloud features.

## Surface

A new **Builder** tab in the primary nav, between Teams and Settings. Three stacked sections, single column on mobile, capped column width on desktop:

1. **Coverage** — pick a saved team, see two readouts:
   - **Offensive gaps**: types your team can't hit super-effectively (no STAB or known coverage move with ≥2× into that type)
   - **Defensive overlaps**: types that 3+ of your mons share as a weakness
2. **Suggestions** — top 8 Pokémon to add, each card shows the species + a short explanation ("covers Fairy gap; resists Ground; 2× Charizard").
3. **Matchup matrix** — pick (your team, a threat list), see an N × M grid with each cell showing the % of the opponent's max HP your mon's best move does. Color-coded (green = OHKO, yellow = 2HKO, red = 3HKO+).

## Data model

### `ThreatList`

A flat list of Pokémon to evaluate against. Reuses `SavedMon` so movesets, items, abilities are all editable just like teams. Allows more than 6 mons.

```ts
interface ThreatList {
  id: string;
  name: string;
  format: 'singles' | 'doubles' | 'any';
  mons: SavedMon[];          // unbounded
  isSeed: boolean;            // curated lists ship with the app; non-deletable
  createdAt: number;
  updatedAt: number;
}
```

Persisted in the store under a new `threatLists` slice. Bumps persist version to 4.

### Seed data

On v4 migration (and on first load), inject these four curated lists. Each entry is materialized via the existing `defaultOpponentMon(species)` factory — uses curated SETDEX builds when available, falls back to the auto-build synthesizer.

1. **Top Threats — Singles** (7): Garchomp, Sneasler, Pelipper, Charizard (Mega-Y), Primarina, Kangaskhan, Floette-Eternal
2. **Top Threats — Doubles / VGC** (8): Incineroar, Sneasler, Garchomp, Kangaskhan, Floette-Eternal, Kingambit, Pelipper, Rillaboom
3. **Top Megas** (6): Charizard-Mega-Y, Gengar-Mega, Delphox-Mega, Greninja-Mega, Hawlucha-Mega, Garchomp-Mega
4. **Most-Used (any format)** (3): Incineroar, Kingambit, Garchomp

Seed lists may be edited (per-mon moveset/item/ability tweaks). They cannot be deleted. The user can also create their own threat lists from scratch.

### `TopPool`

A static constant in `app/src/data/top-pool.ts` — list of ~30 Pokémon that the suggestion algorithm considers. Pulled from the same meta sources as the seed threats, plus hand-picked coverage staples (Heatran, Toxapex, Clefable, Ferrothorn) that don't appear at S-tier but solve common holes.

## Coverage analysis

Pure type-chart math. No `calculateMatchup`.

### Offensive gaps

For each defending type T (1..18 types):
- Compute the max effectiveness multiplier across all team mons' STAB types and *known* coverage moves (from each mon's saved `moves[]`, look up calc move data, take its `type`).
- If max < 2.0, T is an **offensive gap**.

Result: list of types the team can't super-effective.

### Defensive overlaps

For each attacking type A:
- Count team mons whose typing makes them weak (multiplier ≥ 2.0) to A.
- If count ≥ 3, A is a **defensive overlap**.

Result: list of `{ type, weakCount }` pairs sorted by `weakCount` desc.

## Suggestion scoring

Inputs: active team's coverage analysis, the `TopPool` constant, the seeded "Most-Used" threat list (proxy for relevant top-meta mons).

For each candidate species C in `TopPool`:
- Skip if C (or its base/mega forme) is already on the team.
- Compute base score:
  - `+3 per offensive gap C closes`. C closes gap T if either of C's STAB types has a 2× into T per the type chart.
  - `+2 per defensive overlap C reduces`. C reduces overlap A if neither of C's types is weak to A (multiplier < 2 against A).
  - `+1 per "type-favorable" matchup vs the Most-Used threat list`. C is favorable vs threat M if (C's defense vs M's STAB types is ≤ 1×) AND (C has a STAB ≥ 2× into one of M's types).
- Reasons array — each scoring contributor adds a short string ("covers Fairy", "OHKOs Garchomp" — note: "OHKOs" here is type-chart shorthand, not a damage calc).

Sort candidates by score descending, break ties alphabetically. Show top 8.

## Matchup matrix

For each (your_mon × threat_mon) cell:
- Run `calculateMatchup(your_mon, threat_mon, defaultField)`.
- Take the highest `percentRange[1]` across the 4 attacker moves (best-case max).
- Color-code: ≥100 green (OHKO), ≥50 yellow (2HKO), ≥34 light orange (3HKO), <34 red (walled).

Matrix is memoized. Re-runs only when team or threat list changes.

## Routing

Builder is a new tab `'builder'` in the nav. Persisted in `tab` field. Nav order: Battle / Teams / Builder / Settings.

## File structure

```
app/src/screens/BuilderScreen.tsx
app/src/components/builder/CoverageSection.tsx
app/src/components/builder/SuggestionsSection.tsx
app/src/components/builder/MatchupMatrix.tsx
app/src/components/builder/ThreatListPicker.tsx
app/src/components/builder/ThreatListEditor.tsx   # reuses MonEditor inline
app/src/data/top-pool.ts                           # 30 candidate species
app/src/data/seed-threats.ts                       # 4 curated lists
app/src/calc/coverage.ts                           # offensive gaps, defensive overlaps
app/src/calc/coverage.test.ts
app/src/calc/suggestions.ts                       # scoring algorithm
app/src/calc/suggestions.test.ts
app/src/store/migrations.ts                        # v4 migration: inject seeds, add threatLists slice
app/src/store/index.ts                             # threatLists actions
```

## Test strategy

- **Coverage analysis**: unit tests against fixture teams. e.g. all-Water team has Electric and Grass as offensive gaps and Electric and Grass as defensive overlaps.
- **Suggestion scorer**: fixture team + fixed TopPool, assert top 3 candidates and their reasons.
- **Persist v4 migration**: starting from a v3 state with no `threatLists`, migration adds the 4 seeds.
- **E2E mobile + desktop**:
  - Navigate to Builder, see seeded threat lists.
  - Pick a saved team → coverage section populates.
  - Suggestions section shows candidates.
  - Matchup matrix renders cells with %.
  - Edit a seeded list (tweak a moveset), reload, change persists.
  - Create a new threat list, add a mon, see it in the list.
- Reuses the existing mobile-webkit + desktop-chromium Playwright projects.

## Implementation order

1. Spec + commit
2. Types, store actions, v4 migration, seed-threats injection
3. `top-pool.ts` constant, `coverage.ts` + tests, `suggestions.ts` + tests
4. Builder screen shell + nav tab wired
5. CoverageSection + SuggestionsSection
6. ThreatListPicker + ThreatListEditor
7. MatchupMatrix
8. E2E tests
9. Final review

Each lands as its own commit (or two when natural).
