# Champions Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **⚠ COMMIT POLICY:** This repo's owner has set a hard rule: never run `git commit` or `git push` without explicit, in-message authorization. Treat every "Commit" step in this plan as **propose + ask**: stage the changes, surface the diff and proposed message, then **stop and wait** for the owner to say "yes, commit." Do not amend, force-push, or batch-commit. Pass this rule down to any spawned subagents in their prompts.

**Goal:** Replace the legacy vanilla-JS frontend with a mobile-first, single-purpose damage calculator for Pokémon Champions (React + Vite + TS + Tailwind + Zustand), reusing `@smogon/calc` unchanged.

**Architecture:** Workspace monorepo. `calc/` stays as the existing TS package (untouched). New `app/` is a Vite React SPA that consumes `@smogon/calc` directly. State is Zustand-backed and persisted to a single `localStorage` key. Three screens (Battle / Teams / Settings) plus a Mon Editor sheet. All damage calculation flows through one adapter file that owns state→calc translation; UI never touches calc internals.

**Tech Stack:** Vite 5, React 18, TypeScript 5, Tailwind CSS 3, Zustand 4 + persist middleware, `@smogon/calc` (workspace dep), Vitest + @testing-library/react (unit), Playwright (E2E).

---

## File Structure

Created in this plan (under `app/`):

| File | Responsibility |
|---|---|
| `app/package.json` | App package manifest, deps, scripts |
| `app/index.html` | Vite entry HTML |
| `app/vite.config.ts` | Vite + Vitest config |
| `app/tailwind.config.ts` | Tailwind config + design tokens |
| `app/postcss.config.cjs` | PostCSS for Tailwind |
| `app/tsconfig.json` | TS config |
| `app/playwright.config.ts` | Playwright config |
| `app/src/main.tsx` | React root mount |
| `app/src/App.tsx` | Root component, tab routing |
| `app/src/types.ts` | All shared types (StatID, SavedMon, Team, FieldState, etc.) |
| `app/src/data/setdex-champions.ts` | Ported SETDEX_CHAMPIONS data + accessors |
| `app/src/data/types-palette.ts` | Pokémon type → color map |
| `app/src/data/sprites.ts` | Sprite URL resolver |
| `app/src/calc/adapter.ts` | App state → `@smogon/calc` inputs; calc result → app shape |
| `app/src/calc/format.ts` | KO tag, priority flag, ability/item callout helpers |
| `app/src/store/index.ts` | Zustand store with persist middleware |
| `app/src/store/migrations.ts` | Versioned migration runners |
| `app/src/store/validators.ts` | SP validation, recents LRU, etc. |
| `app/src/screens/BattleScreen.tsx` | Battle tab |
| `app/src/screens/TeamsScreen.tsx` | Teams tab |
| `app/src/screens/SettingsScreen.tsx` | Settings tab |
| `app/src/components/Nav.tsx` | Bottom nav (mobile) / top tabs (desktop) |
| `app/src/components/MonCard.tsx` | Active or opponent mon card |
| `app/src/components/HpBar.tsx` | HP bar (raw + %, opponent %-only mode) |
| `app/src/components/TeamCarousel.tsx` | 6-slot team carousel |
| `app/src/components/FieldBar.tsx` | Condensed field-state pills |
| `app/src/components/FieldDrawer.tsx` | Expanded field controls |
| `app/src/components/MoveRow.tsx` | One move row with damage/KO/priority |
| `app/src/components/SpeedDivider.tsx` | Speed + priority callout |
| `app/src/components/MegaToggle.tsx` | Mega evolution toggle |
| `app/src/components/StatChip.tsx` | Item/ability/nature/status/boost chips |
| `app/src/components/TypeBadge.tsx` | Type pill |
| `app/src/components/editor/MonEditor.tsx` | Sheet shell |
| `app/src/components/editor/BuildDropdown.tsx` | SETDEX build picker |
| `app/src/components/editor/SpGrid.tsx` | 6-stat SP allocator |
| `app/src/components/editor/MoveSlots.tsx` | 4 move slots in editor |
| `app/src/components/pickers/SpeciesPicker.tsx` | Species search + recents |
| `app/src/components/pickers/MovePicker.tsx` | Move search |
| `app/src/components/pickers/ItemPicker.tsx` | Item search |
| `app/src/components/pickers/AbilityPicker.tsx` | Ability picker (filtered by species) |
| `app/src/components/pickers/NaturePicker.tsx` | Nature picker |
| `app/src/styles/globals.css` | Tailwind directives + base styles |
| `app/src/test-setup.ts` | Vitest setup (jest-dom, etc.) |
| `app/e2e/golden-path.spec.ts` | First Playwright E2E test |

Modified at repo root:

| File | Change |
|---|---|
| `package.json` | Add workspaces (`calc`, `app`, `import`); add app scripts |
| `.gitignore` | Already has `.superpowers`; add `app/dist/`, `app/playwright-report/`, `app/test-results/` |

Deleted:

| Path | Reason |
|---|---|
| `src/` | Legacy frontend, fully replaced |
| `dist/` | Legacy build output (regenerated under `app/dist/`) |
| `bundler.js` | Legacy bundler |
| `build` (script) | Legacy build script |
| `server.js` | Legacy serve script |
| `Dockerfile` | Legacy serve container |
| `publish` (script) | Legacy publish |
| `smoketest/` | Legacy smoketest (replaced by Playwright E2E) |

---

## Phase 0 — Setup & Cleanup

### Task 1: Create feature branch and confirm starting state

**Files:** none.

- [ ] **Step 1: Confirm clean working tree**

  Run: `git status`
  Expected: only `.gitignore` modified and `docs/` untracked (the spec file). No other dirt.

- [ ] **Step 2: Create feature branch**

  Run: `git checkout -b champions-redesign`
  Expected: `Switched to a new branch 'champions-redesign'`

- [ ] **Step 3: Stop. Confirm with owner before proceeding to destructive cleanup.**

  Surface this state to the owner: "On branch `champions-redesign`. Phase 0 will delete `src/`, `dist/`, `bundler.js`, `server.js`, `Dockerfile`, `publish`, the `build` script, and `smoketest/`. Confirm?"

### Task 2: Delete legacy frontend and build infra

**Files:**
- Delete: `src/` (entire directory)
- Delete: `dist/` (if present)
- Delete: `bundler.js`
- Delete: `build` (script file at repo root)
- Delete: `server.js`
- Delete: `Dockerfile`
- Delete: `publish` (script file at repo root)
- Delete: `smoketest/`
- Modify: `package.json`

- [ ] **Step 1: Delete legacy directories and files**

  Run:
  ```bash
  rm -rf src dist smoketest
  rm -f bundler.js build server.js Dockerfile publish
  ```

- [ ] **Step 2: Strip legacy scripts and devDependencies from `package.json`**

  Replace the entire root `package.json` with:
  ```json
  {
    "private": true,
    "homepage": "https://calc.pokemonshowdown.com/",
    "repository": "github:smogon/damage-calc",
    "license": "MIT",
    "workspaces": ["calc", "app", "import"],
    "scripts": {
      "dev": "npm --workspace app run dev",
      "build": "npm --workspace calc run compile && npm --workspace app run build",
      "test": "npm --workspace calc run test && npm --workspace app run test",
      "lint": "npm --workspace calc run lint && npm --workspace app run lint"
    }
  }
  ```

- [ ] **Step 3: Verify `calc/` and `import/` are untouched**

  Run: `ls calc/src/ && ls import/`
  Expected: same contents as before — calc TS sources, import tooling.

- [ ] **Step 4: Commit (propose + wait for approval)**

  Stage:
  ```bash
  git add -A
  ```
  Proposed message:
  ```
  Remove legacy frontend and convert to workspace root

  Deletes src/, dist/, bundler.js, server.js, Dockerfile, build/publish
  scripts, and smoketest/. Converts package.json to a workspace manifest
  spanning calc, app, import.
  ```
  **Stop. Ask owner: "OK to commit?"**

---

## Phase 1 — Foundations: scaffold, types, calc adapter (with spike)

### Task 3: Scaffold Vite + React + TS app

**Files:**
- Create: `app/package.json`
- Create: `app/index.html`
- Create: `app/vite.config.ts`
- Create: `app/tsconfig.json`
- Create: `app/src/main.tsx`
- Create: `app/src/App.tsx`
- Create: `app/src/styles/globals.css`

- [ ] **Step 1: Create `app/package.json`**

  ```json
  {
    "name": "champions-calc-app",
    "version": "0.1.0",
    "private": true,
    "type": "module",
    "scripts": {
      "dev": "vite",
      "build": "tsc && vite build",
      "preview": "vite preview",
      "test": "vitest run",
      "test:watch": "vitest",
      "test:e2e": "playwright test",
      "lint": "eslint src --ext .ts,.tsx"
    },
    "dependencies": {
      "@smogon/calc": "workspace:../calc",
      "react": "^18.3.1",
      "react-dom": "^18.3.1",
      "zustand": "^4.5.0"
    },
    "devDependencies": {
      "@playwright/test": "^1.45.0",
      "@testing-library/jest-dom": "^6.4.0",
      "@testing-library/react": "^16.0.0",
      "@types/react": "^18.3.0",
      "@types/react-dom": "^18.3.0",
      "@vitejs/plugin-react": "^4.3.0",
      "autoprefixer": "^10.4.0",
      "eslint": "^8.57.0",
      "jsdom": "^24.0.0",
      "postcss": "^8.4.0",
      "tailwindcss": "^3.4.0",
      "typescript": "^5.5.0",
      "vite": "^5.4.0",
      "vitest": "^2.0.0"
    }
  }
  ```

- [ ] **Step 2: Create `app/index.html`**

  ```html
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
      <meta name="theme-color" content="#050714" />
      <title>Champions Calc</title>
    </head>
    <body>
      <div id="root"></div>
      <script type="module" src="/src/main.tsx"></script>
    </body>
  </html>
  ```

- [ ] **Step 3: Create `app/vite.config.ts`**

  ```ts
  import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react';

  export default defineConfig({
    plugins: [react()],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test-setup.ts'],
    },
  });
  ```

- [ ] **Step 4: Create `app/tsconfig.json`**

  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "lib": ["ES2022", "DOM", "DOM.Iterable"],
      "jsx": "react-jsx",
      "module": "ESNext",
      "moduleResolution": "bundler",
      "allowImportingTsExtensions": false,
      "resolveJsonModule": true,
      "esModuleInterop": true,
      "strict": true,
      "noUnusedLocals": true,
      "noUnusedParameters": true,
      "noFallthroughCasesInSwitch": true,
      "skipLibCheck": true,
      "types": ["vitest/globals", "@testing-library/jest-dom"]
    },
    "include": ["src", "e2e"]
  }
  ```

- [ ] **Step 5: Create `app/src/main.tsx`**

  ```tsx
  import React from 'react';
  import ReactDOM from 'react-dom/client';
  import { App } from './App';
  import './styles/globals.css';

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  ```

- [ ] **Step 6: Create placeholder `app/src/App.tsx`**

  ```tsx
  export function App() {
    return (
      <div className="min-h-screen bg-bg-base text-text">
        <h1 className="p-4 text-xl font-bold">Champions Calc</h1>
        <p className="px-4 opacity-60">Scaffold up. Wiring real screens next.</p>
      </div>
    );
  }
  ```

- [ ] **Step 7: Create `app/src/styles/globals.css` (Tailwind comes in next task)**

  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;

  html, body, #root { height: 100%; }
  body {
    background: #050714;
    color: #e8ecff;
    font-family: ui-sans-serif, -apple-system, system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  ```

- [ ] **Step 8: Install deps**

  Run: `npm install` (from repo root)
  Expected: workspaces resolve, `app/node_modules` populated, `calc` linked as workspace dep.

- [ ] **Step 9: Verify dev server boots**

  Run: `npm run dev` (from repo root)
  Expected: Vite prints a localhost URL with no errors.
  **Note for executor:** open the URL with the Chrome MCP, confirm the placeholder renders, then stop the dev server.

- [ ] **Step 10: Commit (propose + wait)**

  Proposed message: `Scaffold Vite + React + TS app at app/`
  **Stop. Ask owner.**

### Task 4: Configure Tailwind with design tokens

**Files:**
- Create: `app/tailwind.config.ts`
- Create: `app/postcss.config.cjs`
- Modify: `app/src/styles/globals.css`

- [ ] **Step 1: Create `app/postcss.config.cjs`**

  ```js
  module.exports = {
    plugins: { tailwindcss: {}, autoprefixer: {} },
  };
  ```

- [ ] **Step 2: Create `app/tailwind.config.ts` with design tokens from spec**

  ```ts
  import type { Config } from 'tailwindcss';

  export default {
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    theme: {
      screens: {
        sm: '640px',
        md: '900px',  // custom desktop breakpoint per spec
        lg: '1280px',
      },
      extend: {
        colors: {
          'bg-base': '#050714',
          surface: 'rgba(255,255,255,0.04)',
          'surface-hi': 'rgba(255,255,255,0.07)',
          text: '#e8ecff',
          'text-mute': '#888fb5',
          accent: '#7c5cff',
          'accent-2': '#5c8cff',
          ok: '#22c55e',
          warn: '#fab005',
          danger: '#ff6b6b',
          priority: '#fb923c',
        },
        backgroundImage: {
          'panel-gradient':
            'linear-gradient(165deg, #0a0e25 0%, #1c0f2e 50%, #0a0e25 100%)',
          'accent-gradient': 'linear-gradient(135deg, #7c5cff, #5c8cff)',
        },
        borderRadius: {
          card: '16px',
        },
        fontFamily: {
          sans: ['ui-sans-serif', '-apple-system', 'system-ui', 'sans-serif'],
        },
        fontSize: {
          xxs: ['10px', '14px'],
        },
      },
    },
    plugins: [],
  } satisfies Config;
  ```

- [ ] **Step 3: Replace placeholder in `App.tsx` with a token-driven test card**

  Replace `app/src/App.tsx`:
  ```tsx
  export function App() {
    return (
      <div className="min-h-screen bg-bg-base bg-panel-gradient text-text p-4">
        <div className="rounded-card bg-surface border border-surface-hi p-4">
          <h1 className="text-lg font-bold">Champions Calc</h1>
          <p className="text-text-mute text-sm">Tokens wired.</p>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 4: Verify in browser via Chrome MCP**

  Run: `npm run dev` (in background)
  Use Chrome MCP to load `http://localhost:5173` and screenshot. Expected: dark panel-gradient bg, frosted card with title.

- [ ] **Step 5: Commit (propose + wait)**

  Proposed message: `Wire Tailwind with Glass Dark design tokens`
  **Stop. Ask owner.**

### Task 5: Set up Vitest test scaffolding

**Files:**
- Create: `app/src/test-setup.ts`
- Create: `app/src/__smoke__.test.ts`

- [ ] **Step 1: Create `app/src/test-setup.ts`**

  ```ts
  import '@testing-library/jest-dom/vitest';
  ```

- [ ] **Step 2: Create a smoke test to confirm Vitest runs**

  `app/src/__smoke__.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';

  describe('vitest setup', () => {
    it('is alive', () => {
      expect(2 + 2).toBe(4);
    });
  });
  ```

- [ ] **Step 3: Run tests**

  Run: `npm --workspace app run test`
  Expected: 1 test passes.

- [ ] **Step 4: Commit (propose + wait)**

  Proposed message: `Add Vitest test scaffolding`
  **Stop. Ask owner.**

### Task 6: Define core types

**Files:**
- Create: `app/src/types.ts`

- [ ] **Step 1: Write the file with all shared types**

  `app/src/types.ts`:
  ```ts
  // Stat IDs aligned with @smogon/calc (no translation at the boundary).
  export type StatID = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
  export type StatIDExceptHP = Exclude<StatID, 'hp'>;
  export type StatusName =
    | 'Healthy'
    | 'Poisoned'
    | 'Badly Poisoned'
    | 'Burned'
    | 'Paralyzed'
    | 'Asleep'
    | 'Frozen';

  export interface SavedMon {
    id: string;             // uuid v4
    species: string;        // canonical species name (e.g. "Garchomp")
    buildName?: string;     // SETDEX_CHAMPIONS key, undefined when "Custom"
    item?: string;
    ability?: string;
    nature: string;         // default 'Hardy'
    sps: Partial<Record<StatID, number>>;     // each 0..32, sum ≤ 66
    moves: [string, string, string, string];  // '' for empty
    isMega: boolean;
    currentHp?: number;     // raw HP; undefined = full
    status?: StatusName;
    boosts: Partial<Record<StatIDExceptHP, number>>; // -6..+6
  }

  export type Format = 'singles' | 'doubles';

  export interface Team {
    id: string;
    name: string;
    format: Format;
    mons: SavedMon[];   // 0..6
    createdAt: number;
    updatedAt: number;
  }

  export interface SideState {
    stealthRock?: boolean;
    spikes?: 0 | 1 | 2 | 3;
    reflect?: boolean;
    lightScreen?: boolean;
    auroraVeil?: boolean;
    tailwind?: boolean;
    protect?: boolean;
    leechSeed?: boolean;
    saltCure?: boolean;
    helpingHand?: boolean;
    isPowerTrick?: boolean;
    friendGuard?: boolean;
    isStatBoost?: boolean;
    isSwitching?: boolean;
  }

  export interface FieldState {
    weather?: 'Sun' | 'Rain' | 'Sand' | 'Snow';
    terrain?: 'Electric' | 'Grassy' | 'Misty' | 'Psychic';
    isMagicRoom?: boolean;
    isWonderRoom?: boolean;
    isGravity?: boolean;
    yourSide: SideState;
    oppSide: SideState;
  }

  export interface RecentOpponent {
    id: string;
    mon: SavedMon;       // snapshot at time of last use
    lastUsed: number;
    useCount: number;
  }

  export type Notation = 'percent' | 'pixels';
  export type Tab = 'battle' | 'teams' | 'settings';

  export interface AppState {
    teams: Team[];
    activeTeamId: string | null;
    activeMonIndex: number;       // 0..5 in active team
    opponent: SavedMon | null;
    recentOpponents: RecentOpponent[];  // capped 30, LRU
    field: FieldState;
    notation: Notation;
    tab: Tab;
  }

  export const SP_PER_STAT_MAX = 32;
  export const SP_TOTAL_MAX = 66;
  export const RECENT_OPPONENT_CAP = 30;
  ```

- [ ] **Step 2: Commit (propose + wait)**

  Proposed message: `Add core app types`
  **Stop. Ask owner.**

### Task 7: Spike — confirm calc API conventions

**Files:**
- Create: `app/src/calc/__spike__.test.ts` (deleted at end of task)

This task resolves the spec's Open Questions before building the adapter.

- [ ] **Step 1: Write a spike test that exercises the calc against known fixtures**

  `app/src/calc/__spike__.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import {
    Generations,
    Pokemon,
    Move,
    Field,
    calculate,
  } from '@smogon/calc';

  describe('calc spike — Champions conventions', () => {
    const gen = Generations.get(0); // Champions

    it('Champions Pokemon defaults to level 50, evs 0, ivs forced to 31', () => {
      // Champions has no IV system — calc forces all IVs to max (31) when gen.num === 0.
      // The app never sets ivs; we just verify the default behavior here.
      const p = new Pokemon(gen, 'Garchomp');
      expect(p.level).toBe(50);
      expect(p.evs.atk).toBe(0);
      expect(p.ivs.atk).toBe(31);
    });

    it('SP allocations map onto evs slot', () => {
      const p = new Pokemon(gen, 'Garchomp', { evs: { atk: 32, spe: 32 } });
      expect(p.evs.atk).toBe(32);
      expect(p.evs.spe).toBe(32);
    });

    it('Mega forme is reachable by species suffix', () => {
      const p = new Pokemon(gen, 'Garchomp-Mega');
      // Mega Garchomp's base atk is 170 vs base 130 for non-mega
      expect(p.species.baseStats.atk).toBeGreaterThan(150);
    });

    it('calculate() runs end-to-end with field flags', () => {
      const attacker = new Pokemon(gen, 'Garchomp', {
        item: 'Life Orb',
        ability: 'Rough Skin',
        nature: 'Jolly',
        evs: { atk: 32, spe: 32 },
      });
      const defender = new Pokemon(gen, 'Tyranitar', {
        item: 'Leftovers',
        ability: 'Sand Stream',
        nature: 'Careful',
        evs: { hp: 32, spd: 32 },
      });
      const move = new Move(gen, 'Earthquake');
      const result = calculate(gen, attacker, defender, move, new Field());
      expect(result.range()).toBeDefined();
      expect(result.range()[0]).toBeGreaterThan(0);
    });
  });
  ```

- [ ] **Step 2: Run the spike**

  Run: `npm --workspace app run test`
  Expected: all 4 spike tests pass. If any fail, **stop and report** — adapter assumptions need updating before continuing.

- [ ] **Step 3: Record findings in the plan**

  In this plan file, append a **Spike Findings** subsection at the bottom of Task 7 with:
  - Confirmed: gen 0 = Champions, level 50, evs is the SP slot, mega via species suffix, mega base stats verified.
  - Any surprises encountered.

- [ ] **Step 4: Delete the spike file (don't keep it as a real test — it's expensive and duplicates the adapter tests below)**

  Run: `rm app/src/calc/__spike__.test.ts`

- [ ] **Step 5: Commit (propose + wait)**

  Proposed message: `Spike: confirm calc API conventions for Champions`
  Stage: this plan file (with findings appended).
  **Stop. Ask owner.**

#### Spike Findings

All 4 spike tests passed on the first run after the plan fixes were applied
(commit `9fcbb52`). Confirmed assumptions for the adapter:

- `Generations.get(0)` returns the Champions generation (`gen.num === 0`).
- Default `Pokemon` level for Champions is `50`.
- `evs` is the slot used for SP allocations (Champions). The legacy
  `sps` field on `SavedMon` maps directly onto `Pokemon.evs` with no
  translation (assuming the long-form stat IDs `hp/atk/def/spa/spd/spe`).
- IVs are auto-forced to 31 by the calc when the gen is Champions — the app
  never sets `ivs` and the spike confirmed `p.ivs.atk === 31` even when no
  IVs were passed in.
- Mega formes are reachable by species suffix: `new Pokemon(gen,
  'Garchomp-Mega')` resolves to the mega base stats (atk > 150, vs 130
  for the non-mega forme).
- `calculate()` runs end-to-end with `new Field()` and produces a non-zero
  damage range for `Garchomp` Earthquake into `Tyranitar`.

Notes carried forward into the adapter:

- `result.kochance()` (and `result.desc()`) can throw when damage is
  `[0, 0]` (status moves, immunities). The adapter wraps `kochance()` in a
  `try/catch` and treats status / zero-damage moves as "no KO text".
- The `currentHp` / `status` fields on `SavedMon` map onto the calc's
  `curHP` and `status` Pokemon options. An empty / `'Healthy'` status maps
  to `''`.

### Task 8: Calc adapter — TDD

**Files:**
- Create: `app/src/calc/adapter.ts`
- Create: `app/src/calc/adapter.test.ts`

- [ ] **Step 1: Write failing tests covering the adapter contract**

  `app/src/calc/adapter.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { calculateMatchup } from './adapter';
  import type { SavedMon, FieldState } from '../types';

  const blankField = (): FieldState => ({ yourSide: {}, oppSide: {} });

  const garchomp: SavedMon = {
    id: 'a',
    species: 'Garchomp',
    item: 'Life Orb',
    ability: 'Rough Skin',
    nature: 'Jolly',
    sps: { atk: 32, spe: 32 },
    moves: ['Earthquake', 'Outrage', 'Stone Edge', 'Fire Fang'],
    isMega: false,
    boosts: {},
  };

  // Tyranitar (Rock/Dark) — Earthquake is 2× super effective; Outrage neutral.
  // Used as the primary defender so the standard moveset all produces non-zero damage.
  const tyranitar: SavedMon = {
    id: 'b',
    species: 'Tyranitar',
    item: 'Leftovers',
    ability: 'Sand Stream',
    nature: 'Careful',
    sps: { hp: 32, spd: 32 },
    moves: ['Stone Edge', 'Crunch', 'Stealth Rock', 'Earthquake'],
    isMega: false,
    boosts: {},
  };

  // Skarmory (Steel/Flying) — used only for the Sun-weather test where Charizard
  // hits with Flamethrower (4× SE). Item omitted (Rocky Helmet isn't in the
  // Champions item list).
  const skarmory: SavedMon = {
    id: 'c',
    species: 'Skarmory',
    ability: 'Sturdy',
    nature: 'Impish',
    sps: { hp: 32, def: 32 },
    moves: ['Brave Bird', 'Stealth Rock', 'Roost', 'Whirlwind'],
    isMega: false,
    boosts: {},
  };

  describe('calculateMatchup', () => {
    it('returns a result per attacker move', () => {
      const m = calculateMatchup(garchomp, tyranitar, blankField());
      expect(m.attackerMoves).toHaveLength(4);
      expect(m.defenderMoves).toHaveLength(4);
    });

    it('Earthquake hits Tyranitar for damage', () => {
      const m = calculateMatchup(garchomp, tyranitar, blankField());
      const eq = m.attackerMoves.find(r => r.moveName === 'Earthquake')!;
      expect(eq.damageRange[0]).toBeGreaterThan(0);
      expect(eq.percentRange[1]).toBeGreaterThan(eq.percentRange[0]);
    });

    it('status moves report no damage', () => {
      const m = calculateMatchup(garchomp, tyranitar, blankField());
      const sr = m.defenderMoves.find(r => r.moveName === 'Stealth Rock')!;
      expect(sr.damageRange).toEqual([0, 0]);
    });

    it('mega toggle changes attacker base stats', () => {
      const baseDmg = calculateMatchup(garchomp, tyranitar, blankField())
        .attackerMoves[0].damageRange[1];
      const mega: SavedMon = { ...garchomp, species: 'Garchomp-Mega', isMega: true };
      const megaDmg = calculateMatchup(mega, tyranitar, blankField())
        .attackerMoves[0].damageRange[1];
      expect(megaDmg).toBeGreaterThan(baseDmg);
    });

    it('respects field weather (Sun boosts Fire moves)', () => {
      const charizard: SavedMon = {
        ...garchomp, species: 'Charizard', moves: ['Flamethrower', '', '', ''],
        ability: 'Blaze',
      };
      const noSun = calculateMatchup(charizard, skarmory, blankField())
        .attackerMoves[0].percentRange[1];
      const sun = calculateMatchup(charizard, skarmory, { ...blankField(), weather: 'Sun' })
        .attackerMoves[0].percentRange[1];
      expect(sun).toBeGreaterThan(noSun);
    });

    it('reports speed comparison', () => {
      const m = calculateMatchup(garchomp, tyranitar, blankField());
      expect(m.speed.attackerSpe).toBeGreaterThan(m.speed.defenderSpe);
      expect(m.speed.attackerOutspeeds).toBe(true);
    });
  });
  ```

- [ ] **Step 2: Run, verify failure**

  Run: `npm --workspace app run test`
  Expected: failure with "calculateMatchup is not defined" or import error.

- [ ] **Step 3: Implement the adapter**

  `app/src/calc/adapter.ts`:
  ```ts
  import {
    Generations,
    Pokemon,
    Move,
    Field,
    calculate,
  } from '@smogon/calc';
  import type { SavedMon, FieldState, SideState, StatID } from '../types';

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
    // Saved species is the canonical (non-mega) form unless edited. When isMega,
    // we resolve to the "{species}-Mega" forme if available.
    if (!mon.isMega) return mon.species;
    if (mon.species.endsWith('-Mega') || mon.species.includes('-Mega-')) {
      return mon.species;
    }
    return `${mon.species}-Mega`;
  }

  function buildPokemon(mon: SavedMon) {
    return new Pokemon(GEN, speciesForCalc(mon), {
      item: mon.item || undefined,
      ability: mon.ability || undefined,
      nature: mon.nature,
      evs: mon.sps,                  // Champions: sps map onto evs (verified in spike)
      boosts: mon.boosts,
      status: mon.status === 'Healthy' || !mon.status ? '' : mon.status,
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
      isSwitching: s.isSwitching ? 'out' : undefined,
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
  ```

- [ ] **Step 4: Run tests, verify all pass**

  Run: `npm --workspace app run test`
  Expected: all 6 adapter tests + smoke test pass.

- [ ] **Step 5: Commit (propose + wait)**

  Proposed message: `Add calc adapter with full matchup tests`
  **Stop. Ask owner.**

### Task 9: KO/priority/ability formatter — TDD

**Files:**
- Create: `app/src/calc/format.ts`
- Create: `app/src/calc/format.test.ts`

- [ ] **Step 1: Failing tests**

  `app/src/calc/format.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { koTagFromText, priorityFlag, sturdyWarning } from './format';
  import type { SavedMon } from '../types';

  describe('koTagFromText', () => {
    it('maps "guaranteed OHKO" to OHKO', () => {
      expect(koTagFromText('guaranteed OHKO')).toEqual({ label: 'OHKO', kind: 'ohko' });
    });
    it('maps "guaranteed 2HKO" to 2HKO', () => {
      expect(koTagFromText('guaranteed 2HKO')).toEqual({ label: '2HKO', kind: 'thko' });
    });
    it('maps "44.5% chance to 2HKO" to chance', () => {
      expect(koTagFromText('44.5% chance to 2HKO')).toEqual({ label: '44% 2HKO', kind: 'chance' });
    });
    it('returns null for empty', () => {
      expect(koTagFromText('')).toBeNull();
    });
  });

  describe('priorityFlag', () => {
    it('flags positive priority', () => {
      expect(priorityFlag(1)).toBe('+1');
      expect(priorityFlag(2)).toBe('+2');
    });
    it('returns null for 0', () => {
      expect(priorityFlag(0)).toBeNull();
    });
    it('flags negative priority', () => {
      expect(priorityFlag(-6)).toBe('-6');
    });
  });

  describe('sturdyWarning', () => {
    const mon = (over: Partial<SavedMon> = {}): SavedMon => ({
      id: 'x', species: 'Skarmory', nature: 'Impish',
      sps: {}, moves: ['','','',''], isMega: false, boosts: {}, ...over,
    });
    it('flags Sturdy at full HP', () => {
      expect(sturdyWarning(mon({ ability: 'Sturdy' }))).toBe(true);
    });
    it('does not flag Sturdy when damaged', () => {
      expect(sturdyWarning(mon({ ability: 'Sturdy', currentHp: 1 }))).toBe(false);
    });
    it('does not flag without Sturdy', () => {
      expect(sturdyWarning(mon())).toBe(false);
    });
  });
  ```

- [ ] **Step 2: Run, verify failure**

  Run: `npm --workspace app run test`
  Expected: import errors.

- [ ] **Step 3: Implement**

  `app/src/calc/format.ts`:
  ```ts
  import type { SavedMon } from '../types';

  export type KoKind = 'ohko' | 'thko' | 'chance' | 'multi';
  export interface KoTag { label: string; kind: KoKind; }

  export function koTagFromText(text: string): KoTag | null {
    if (!text) return null;
    const guaranteed = /guaranteed (OHKO|\dHKO)/.exec(text);
    if (guaranteed) {
      const label = guaranteed[1];
      return { label, kind: label === 'OHKO' ? 'ohko' : label === '2HKO' ? 'thko' : 'multi' };
    }
    const chance = /(\d+(?:\.\d+)?)% chance to (\dHKO|OHKO)/.exec(text);
    if (chance) {
      const pct = Math.floor(parseFloat(chance[1]));
      return { label: `${pct}% ${chance[2]}`, kind: 'chance' };
    }
    return null;
  }

  export function priorityFlag(priority: number): string | null {
    if (priority === 0) return null;
    return priority > 0 ? `+${priority}` : `${priority}`;
  }

  export function sturdyWarning(defender: SavedMon): boolean {
    if (defender.ability !== 'Sturdy') return false;
    // currentHp undefined = full HP
    return defender.currentHp === undefined;
  }
  ```

- [ ] **Step 4: Run, verify pass**

  Run: `npm --workspace app run test`
  Expected: all format tests pass.

- [ ] **Step 5: Commit (propose + wait)**

  Proposed message: `Add KO/priority/sturdy format helpers`
  **Stop. Ask owner.**

---

## Phase 2 — Store, persistence, setdex port

### Task 10: Port SETDEX_CHAMPIONS to typed module

**Files:**
- Create: `app/src/data/setdex-champions.ts`
- Create: `app/src/data/setdex-champions.test.ts`

The legacy file at `src/js/data/sets/champions.js` defines a global `SETDEX_CHAMPIONS`. Since `src/` is being deleted in Task 2, this data must be ported into `app/src/data/` first. **Note for executor:** if you've already deleted `src/`, restore the file via `git show HEAD~N:src/js/data/sets/champions.js` (find the right `N`) before this task.

- [ ] **Step 1: Failing test for the public surface**

  `app/src/data/setdex-champions.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { SETDEX_CHAMPIONS, getBuildsForSpecies, getBuild } from './setdex-champions';
  import type { ChampionsBuild } from './setdex-champions';

  describe('SETDEX_CHAMPIONS', () => {
    it('contains Charizard with multiple builds', () => {
      const charizard = SETDEX_CHAMPIONS['Charizard'];
      expect(charizard).toBeDefined();
      expect(Object.keys(charizard).length).toBeGreaterThan(5);
    });

    it('builds have the expected shape', () => {
      const build: ChampionsBuild | undefined =
        SETDEX_CHAMPIONS['Charizard']?.['SM OU Dragon Dance'];
      expect(build).toBeDefined();
      expect(build!.item).toBe('Charizardite X');
      expect(build!.moves).toContain('Dragon Dance');
    });
  });

  describe('getBuildsForSpecies', () => {
    it('returns build names for a species', () => {
      const names = getBuildsForSpecies('Garchomp');
      expect(names).toBeInstanceOf(Array);
    });
    it('returns empty array for unknown species', () => {
      expect(getBuildsForSpecies('Missingno')).toEqual([]);
    });
  });

  describe('getBuild', () => {
    it('returns a specific build', () => {
      const b = getBuild('Charizard', 'SM OU Dragon Dance');
      expect(b?.nature).toBe('Jolly');
    });
    it('returns undefined for unknown', () => {
      expect(getBuild('Missingno', 'whatever')).toBeUndefined();
    });
  });
  ```

- [ ] **Step 2: Run, verify failure**

  Run: `npm --workspace app run test`
  Expected: import errors.

- [ ] **Step 3: Port the data**

  Convert `src/js/data/sets/champions.js` to `app/src/data/setdex-champions.ts`. The data shape is `{ [species]: { [buildName]: { ability, item, nature, moves, sps } } }`. Port verbatim, retyping at the top:

  ```ts
  import type { StatID } from '../types';

  export interface ChampionsBuild {
    ability: string;
    item: string;
    nature: string;
    moves: string[];
    sps: Partial<Record<StatID, number>>;
  }

  type Setdex = Record<string, Record<string, ChampionsBuild>>;

  // Note: the legacy file used short stat IDs (hp/at/df/sa/sd/sp). Calc uses
  // long IDs (hp/atk/def/spa/spd/spe). Translate at port time so downstream
  // code never sees the legacy form.
  function translateSps(legacy: Record<string, number>): Partial<Record<StatID, number>> {
    const map: Record<string, StatID> = {
      hp: 'hp', at: 'atk', df: 'def', sa: 'spa', sd: 'spd', sp: 'spe',
    };
    const out: Partial<Record<StatID, number>> = {};
    for (const [k, v] of Object.entries(legacy)) {
      const mapped = map[k];
      if (mapped) out[mapped] = v;
    }
    return out;
  }

  // BEGIN PORTED DATA — generated from src/js/data/sets/champions.js
  const RAW: Record<string, Record<string, any>> = {
    // ... paste the full object from champions.js verbatim ...
  };
  // END PORTED DATA

  export const SETDEX_CHAMPIONS: Setdex = Object.fromEntries(
    Object.entries(RAW).map(([species, builds]) => [
      species,
      Object.fromEntries(
        Object.entries(builds).map(([name, b]) => [
          name,
          { ...b, sps: translateSps(b.sps ?? {}) } as ChampionsBuild,
        ]),
      ),
    ]),
  );

  export function getBuildsForSpecies(species: string): string[] {
    return Object.keys(SETDEX_CHAMPIONS[species] ?? {});
  }

  export function getBuild(species: string, buildName: string): ChampionsBuild | undefined {
    return SETDEX_CHAMPIONS[species]?.[buildName];
  }
  ```

- [ ] **Step 4: Paste the full RAW object from `src/js/data/sets/champions.js`**

  Read the full legacy file and copy the JS object literal verbatim into the `RAW` placeholder above. Validate syntactic correctness with `npx tsc --noEmit -p app`.

- [ ] **Step 5: Run tests**

  Run: `npm --workspace app run test`
  Expected: all setdex tests pass.

- [ ] **Step 6: Commit (propose + wait)**

  Proposed message: `Port SETDEX_CHAMPIONS to typed module`
  **Stop. Ask owner.**

### Task 11: Store validators — TDD

**Files:**
- Create: `app/src/store/validators.ts`
- Create: `app/src/store/validators.test.ts`

- [ ] **Step 1: Failing tests**

  `app/src/store/validators.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { validateSps, addRecent } from './validators';
  import type { SavedMon, RecentOpponent } from '../types';
  import { RECENT_OPPONENT_CAP } from '../types';

  describe('validateSps', () => {
    it('passes a clean allocation', () => {
      expect(validateSps({ atk: 32, spe: 32 })).toEqual({ ok: true, total: 64 });
    });
    it('flags per-stat over 32', () => {
      expect(validateSps({ atk: 33 })).toEqual({
        ok: false, total: 33, error: 'atk exceeds 32',
      });
    });
    it('flags total over 66', () => {
      expect(validateSps({ atk: 32, spe: 32, hp: 10 })).toEqual({
        ok: false, total: 74, error: 'total exceeds 66',
      });
    });
    it('passes empty allocation', () => {
      expect(validateSps({})).toEqual({ ok: true, total: 0 });
    });
  });

  describe('addRecent', () => {
    const mon = (species: string): SavedMon => ({
      id: species, species, nature: 'Hardy', sps: {},
      moves: ['','','',''], isMega: false, boosts: {},
    });

    it('adds new recent at the head', () => {
      const list = addRecent([], mon('Skarmory'), 100);
      expect(list).toHaveLength(1);
      expect(list[0].mon.species).toBe('Skarmory');
      expect(list[0].useCount).toBe(1);
    });

    it('bumps existing recent and increments useCount', () => {
      const list1 = addRecent([], mon('Skarmory'), 100);
      const list2 = addRecent(list1, mon('Skarmory'), 200);
      expect(list2).toHaveLength(1);
      expect(list2[0].useCount).toBe(2);
      expect(list2[0].lastUsed).toBe(200);
    });

    it('moves bumped recent to head', () => {
      let list: RecentOpponent[] = [];
      list = addRecent(list, mon('Skarmory'), 100);
      list = addRecent(list, mon('Clefable'), 200);
      list = addRecent(list, mon('Skarmory'), 300);
      expect(list.map(r => r.mon.species)).toEqual(['Skarmory', 'Clefable']);
    });

    it('caps at RECENT_OPPONENT_CAP, evicts oldest', () => {
      let list: RecentOpponent[] = [];
      for (let i = 0; i < RECENT_OPPONENT_CAP + 5; i++) {
        list = addRecent(list, mon(`Mon${i}`), i);
      }
      expect(list).toHaveLength(RECENT_OPPONENT_CAP);
      expect(list[0].mon.species).toBe(`Mon${RECENT_OPPONENT_CAP + 4}`);
      expect(list[list.length - 1].mon.species).toBe('Mon5');
    });
  });
  ```

- [ ] **Step 2: Run, verify failure**

  Run: `npm --workspace app run test`

- [ ] **Step 3: Implement**

  `app/src/store/validators.ts`:
  ```ts
  import type { SavedMon, RecentOpponent, StatID } from '../types';
  import { SP_PER_STAT_MAX, SP_TOTAL_MAX, RECENT_OPPONENT_CAP } from '../types';

  export interface SpValidation {
    ok: boolean;
    total: number;
    error?: string;
  }

  export function validateSps(sps: Partial<Record<StatID, number>>): SpValidation {
    let total = 0;
    for (const [stat, value] of Object.entries(sps) as [StatID, number][]) {
      if (value > SP_PER_STAT_MAX) {
        return { ok: false, total: total + value, error: `${stat} exceeds ${SP_PER_STAT_MAX}` };
      }
      total += value;
    }
    if (total > SP_TOTAL_MAX) {
      return { ok: false, total, error: `total exceeds ${SP_TOTAL_MAX}` };
    }
    return { ok: true, total };
  }

  export function addRecent(
    existing: RecentOpponent[],
    mon: SavedMon,
    now: number,
  ): RecentOpponent[] {
    const idx = existing.findIndex(r => r.mon.species === mon.species);
    if (idx >= 0) {
      const bumped = {
        ...existing[idx],
        mon,
        lastUsed: now,
        useCount: existing[idx].useCount + 1,
      };
      return [bumped, ...existing.slice(0, idx), ...existing.slice(idx + 1)];
    }
    const fresh: RecentOpponent = { id: mon.species, mon, lastUsed: now, useCount: 1 };
    return [fresh, ...existing].slice(0, RECENT_OPPONENT_CAP);
  }
  ```

- [ ] **Step 4: Run, verify pass**

  Run: `npm --workspace app run test`

- [ ] **Step 5: Commit (propose + wait)**

### Task 12: Migrations runner — TDD

**Files:**
- Create: `app/src/store/migrations.ts`
- Create: `app/src/store/migrations.test.ts`

- [ ] **Step 1: Failing test**

  `app/src/store/migrations.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { migrate, CURRENT_VERSION } from './migrations';

  describe('migrate', () => {
    it('returns input unchanged at current version', () => {
      const state = { version: CURRENT_VERSION, state: { teams: [] } };
      expect(migrate(state)).toEqual(state);
    });

    it('throws on a future version', () => {
      expect(() => migrate({ version: CURRENT_VERSION + 1, state: {} } as any))
        .toThrow(/future/i);
    });

    it('returns null on totally invalid input', () => {
      expect(migrate(null as any)).toBeNull();
      expect(migrate({} as any)).toBeNull();
    });
  });
  ```

- [ ] **Step 2: Run, fail**

- [ ] **Step 3: Implement**

  `app/src/store/migrations.ts`:
  ```ts
  import type { AppState } from '../types';

  export const CURRENT_VERSION = 1;

  export interface PersistedShape {
    version: number;
    state: AppState;
  }

  type Migrator = (s: any) => any;

  // Add migrators when bumping CURRENT_VERSION.
  const MIGRATORS: Record<number, Migrator> = {
    // 1: (s) => ({...s, somethingNew: defaultValue}),
  };

  export function migrate(input: any): PersistedShape | null {
    if (!input || typeof input !== 'object') return null;
    if (typeof input.version !== 'number' || !input.state) return null;
    if (input.version > CURRENT_VERSION) {
      throw new Error(`Persisted state is from a future version (${input.version})`);
    }
    let state = input.state;
    for (let v = input.version; v < CURRENT_VERSION; v++) {
      const fn = MIGRATORS[v + 1];
      if (fn) state = fn(state);
    }
    return { version: CURRENT_VERSION, state };
  }
  ```

- [ ] **Step 4: Run, pass**

- [ ] **Step 5: Commit (propose + wait)**

### Task 13: Zustand store

**Files:**
- Create: `app/src/store/index.ts`
- Create: `app/src/store/index.test.ts`

- [ ] **Step 1: Failing tests for store actions**

  `app/src/store/index.test.ts`:
  ```ts
  import { describe, it, expect, beforeEach } from 'vitest';
  import { useStore } from './index';

  beforeEach(() => {
    localStorage.clear();
    useStore.persist.clearStorage();
    useStore.setState(useStore.getInitialState());
  });

  describe('store: teams', () => {
    it('starts with no teams', () => {
      expect(useStore.getState().teams).toEqual([]);
      expect(useStore.getState().activeTeamId).toBeNull();
    });

    it('createTeam adds a team and makes it active', () => {
      const id = useStore.getState().createTeam({ name: 'Test', format: 'singles' });
      const s = useStore.getState();
      expect(s.teams).toHaveLength(1);
      expect(s.activeTeamId).toBe(id);
      expect(s.teams[0].name).toBe('Test');
    });

    it('deleteTeam removes a team and clears active if needed', () => {
      const id = useStore.getState().createTeam({ name: 'X', format: 'singles' });
      useStore.getState().deleteTeam(id);
      expect(useStore.getState().teams).toEqual([]);
      expect(useStore.getState().activeTeamId).toBeNull();
    });
  });

  describe('store: opponent + recents', () => {
    it('setOpponent records in recents', () => {
      useStore.getState().setOpponent({
        id: 'o', species: 'Skarmory', nature: 'Impish',
        sps: {}, moves: ['','','',''], isMega: false, boosts: {},
      });
      expect(useStore.getState().recentOpponents).toHaveLength(1);
    });
  });
  ```

- [ ] **Step 2: Implement the store**

  `app/src/store/index.ts`:
  ```ts
  import { create } from 'zustand';
  import { persist } from 'zustand/middleware';
  import type { AppState, Team, SavedMon, FieldState, Notation, Tab, Format } from '../types';
  import { addRecent } from './validators';
  import { migrate, CURRENT_VERSION } from './migrations';

  const uuid = () => crypto.randomUUID();

  const emptyField = (): FieldState => ({ yourSide: {}, oppSide: {} });

  interface Actions {
    // Teams
    createTeam: (init: { name: string; format: Format }) => string;
    renameTeam: (id: string, name: string) => void;
    deleteTeam: (id: string) => void;
    setActiveTeam: (id: string) => void;
    setActiveMonIndex: (i: number) => void;
    upsertMon: (teamId: string, mon: SavedMon) => void;
    removeMon: (teamId: string, monId: string) => void;
    // Opponent
    setOpponent: (mon: SavedMon | null) => void;
    clearRecent: (id: string) => void;
    clearAllRecents: () => void;
    // Field
    setField: (patch: Partial<FieldState>) => void;
    // UI
    setTab: (t: Tab) => void;
    setNotation: (n: Notation) => void;
    // Reset
    resetAll: () => void;
  }

  const initialAppState: AppState = {
    teams: [],
    activeTeamId: null,
    activeMonIndex: 0,
    opponent: null,
    recentOpponents: [],
    field: emptyField(),
    notation: 'percent',
    tab: 'battle',
  };

  export const useStore = create<AppState & Actions>()(
    persist(
      (set, get) => ({
        ...initialAppState,

        createTeam: ({ name, format }) => {
          const id = uuid();
          const t: Team = {
            id, name, format, mons: [],
            createdAt: Date.now(), updatedAt: Date.now(),
          };
          set(s => ({ teams: [...s.teams, t], activeTeamId: id, activeMonIndex: 0 }));
          return id;
        },
        renameTeam: (id, name) => set(s => ({
          teams: s.teams.map(t => t.id === id ? { ...t, name, updatedAt: Date.now() } : t),
        })),
        deleteTeam: (id) => set(s => ({
          teams: s.teams.filter(t => t.id !== id),
          activeTeamId: s.activeTeamId === id ? null : s.activeTeamId,
        })),
        setActiveTeam: (id) => set({ activeTeamId: id, activeMonIndex: 0 }),
        setActiveMonIndex: (i) => set({ activeMonIndex: i }),
        upsertMon: (teamId, mon) => set(s => ({
          teams: s.teams.map(t => {
            if (t.id !== teamId) return t;
            const idx = t.mons.findIndex(m => m.id === mon.id);
            const mons = idx >= 0
              ? t.mons.map(m => m.id === mon.id ? mon : m)
              : [...t.mons, mon];
            return { ...t, mons, updatedAt: Date.now() };
          }),
        })),
        removeMon: (teamId, monId) => set(s => ({
          teams: s.teams.map(t => t.id === teamId
            ? { ...t, mons: t.mons.filter(m => m.id !== monId), updatedAt: Date.now() }
            : t,
          ),
        })),

        setOpponent: (mon) => set(s => ({
          opponent: mon,
          recentOpponents: mon ? addRecent(s.recentOpponents, mon, Date.now()) : s.recentOpponents,
        })),
        clearRecent: (id) => set(s => ({
          recentOpponents: s.recentOpponents.filter(r => r.id !== id),
        })),
        clearAllRecents: () => set({ recentOpponents: [] }),

        setField: (patch) => set(s => ({ field: { ...s.field, ...patch } })),

        setTab: (tab) => set({ tab }),
        setNotation: (notation) => set({ notation }),

        resetAll: () => set(initialAppState),
      }),
      {
        name: 'champions-calc-v1',
        version: CURRENT_VERSION,
        migrate: (persistedState: unknown, version: number) => {
          const wrapped = { version, state: persistedState };
          const migrated = migrate(wrapped);
          return (migrated?.state ?? initialAppState) as AppState;
        },
      },
    ),
  );
  ```

- [ ] **Step 3: Run, verify pass**

  Run: `npm --workspace app run test`

- [ ] **Step 4: Commit (propose + wait)**

  Proposed message: `Add Zustand store with persist`
  **Stop. Ask owner.**

---

## Phase 3 — Visual primitives

### Task 14: Type palette + sprites

**Files:**
- Create: `app/src/data/types-palette.ts`
- Create: `app/src/data/sprites.ts`

- [ ] **Step 1: Type palette**

  `app/src/data/types-palette.ts`:
  ```ts
  export const TYPE_COLORS: Record<string, string> = {
    Normal:   '#a8a878',
    Fire:     '#fa5252',
    Water:    '#339af0',
    Electric: '#f7c948',
    Grass:    '#84cc16',
    Ice:      '#7ad3de',
    Fighting: '#c92a2a',
    Poison:   '#a560b8',
    Ground:   '#d4a373',
    Flying:   '#748ffc',
    Psychic:  '#f06595',
    Bug:      '#9bc53d',
    Rock:     '#a47551',
    Ghost:    '#7048a8',
    Dragon:   '#6b5bff',
    Dark:     '#444444',
    Steel:    '#6c7a89',
    Fairy:    '#f7a8d8',
    '???':    '#888888',
    Status:   '#888888',
  };

  export function colorForType(type: string | undefined): string {
    if (!type) return TYPE_COLORS['???'];
    return TYPE_COLORS[type] ?? TYPE_COLORS['???'];
  }
  ```

- [ ] **Step 2: Sprite resolver**

  Use the existing PokemonShowdown sprite CDN.

  `app/src/data/sprites.ts`:
  ```ts
  // Slug used by play.pokemonshowdown.com sprite paths. Lowercase, no spaces or punctuation
  // except a few preserved hyphens for forme suffixes.
  function spriteSlug(species: string): string {
    return species
      .toLowerCase()
      .replace(/[\s.'’]+/g, '')
      .replace(/-mega(-x|-y)?$/, m => m.toLowerCase());
  }

  export function spriteUrl(species: string): string {
    return `https://play.pokemonshowdown.com/sprites/dex/${spriteSlug(species)}.png`;
  }
  ```

- [ ] **Step 3: Commit (propose + wait)**

  Proposed message: `Add type palette and sprite URL helper`

### Task 15: TypeBadge component

**Files:**
- Create: `app/src/components/TypeBadge.tsx`

- [ ] **Step 1: Implement**

  ```tsx
  import { colorForType } from '../data/types-palette';

  interface Props {
    type: string;
    size?: 'sm' | 'md';
  }

  export function TypeBadge({ type, size = 'sm' }: Props) {
    const px = size === 'md' ? 'text-[11px] px-2 py-0.5' : 'text-[9px] px-1.5 py-0.5';
    return (
      <span
        className={`${px} font-bold uppercase tracking-wider rounded text-white`}
        style={{ background: colorForType(type) }}
      >
        {type}
      </span>
    );
  }
  ```

- [ ] **Step 2: Commit (propose + wait)**

### Task 16: HpBar component

**Files:**
- Create: `app/src/components/HpBar.tsx`

- [ ] **Step 1: Implement**

  ```tsx
  interface Props {
    current?: number;        // raw, undefined = full
    max: number;
    showRaw?: boolean;       // false = % only (opponent mode)
    onChange?: (newCurrent: number) => void;
  }

  export function HpBar({ current, max, showRaw = true, onChange }: Props) {
    const cur = current ?? max;
    const pct = Math.max(0, Math.min(100, Math.round((cur / max) * 100)));
    const fill =
      pct > 50 ? 'bg-ok'
      : pct > 20 ? 'bg-warn'
      : 'bg-danger';

    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-white/10 rounded overflow-hidden">
          <div className={`h-full ${fill}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="text-xs tabular-nums opacity-80 min-w-[60px] text-right">
          {showRaw ? `${cur}/${max}` : `${pct}%`}
        </div>
        {onChange && (
          <input
            type="range"
            min={0}
            max={max}
            value={cur}
            onChange={e => onChange(Number(e.target.value))}
            className="w-20"
            aria-label="HP"
          />
        )}
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit (propose + wait)**

### Task 17: StatChip + MoveRow components

**Files:**
- Create: `app/src/components/StatChip.tsx`
- Create: `app/src/components/MoveRow.tsx`

- [ ] **Step 1: StatChip**

  ```tsx
  interface Props {
    icon?: string;
    label: string;
    tone?: 'default' | 'warn' | 'boost';
    editable?: boolean;
    onClick?: () => void;
  }

  export function StatChip({ icon, label, tone = 'default', editable, onClick }: Props) {
    const toneClass =
      tone === 'warn'  ? 'bg-warn/10 border-warn/30 text-warn'
    : tone === 'boost' ? 'bg-ok/10 border-ok/30 text-ok'
    : 'bg-surface border-surface-hi text-text';
    return (
      <button
        type="button"
        onClick={onClick}
        className={`px-2 py-0.5 rounded-lg border text-[11px] flex gap-1 items-center ${toneClass} ${editable ? 'after:content-["✎"] after:opacity-40 after:ml-1' : ''}`}
      >
        {icon && <span>{icon}</span>}
        <span>{label}</span>
      </button>
    );
  }
  ```

- [ ] **Step 2: MoveRow**

  ```tsx
  import { TypeBadge } from './TypeBadge';
  import type { MoveResult } from '../calc/adapter';
  import { koTagFromText, priorityFlag } from '../calc/format';

  interface Props {
    result: MoveResult;
  }

  export function MoveRow({ result }: Props) {
    const ko = koTagFromText(result.koChanceText);
    const prio = priorityFlag(result.priority);
    const tone =
      ko?.kind === 'ohko' ? 'bg-danger/15 border-danger/40'
    : ko?.kind === 'thko' ? 'bg-warn/12 border-warn/30'
    : 'bg-surface border-surface-hi';

    if (!result.moveName) {
      return <div className="px-3 py-2 rounded-lg border border-dashed border-white/10 text-text-mute text-xs">— empty slot —</div>;
    }

    return (
      <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${tone} mb-1.5`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-semibold text-[12.5px]">
            <TypeBadge type={result.type} />
            <span className="truncate">{result.moveName}</span>
            {prio && <span className="text-priority text-[10px] font-bold">{prio}</span>}
            {ko && <span className={`text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded ${ko.kind === 'ohko' ? 'bg-danger text-white' : ko.kind === 'thko' ? 'bg-warn text-black' : 'bg-black/40 text-white'}`}>{ko.label}</span>}
          </div>
          {!result.isStatus && (
            <div className="text-[10px] opacity-50 mt-0.5">
              {result.damageRange[0]}–{result.damageRange[1]} dmg{result.koChanceText && ` · ${result.koChanceText}`}
            </div>
          )}
        </div>
        <div className="text-right">
          {result.isStatus
            ? <span className="opacity-40 text-sm">—</span>
            : <span className="font-bold tabular-nums text-[13px]">
                {result.percentRange[0]}–{result.percentRange[1]}%
              </span>}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 3: Commit (propose + wait)**

### Task 18: SpeedDivider component

**Files:**
- Create: `app/src/components/SpeedDivider.tsx`

- [ ] **Step 1: Implement**

  ```tsx
  import type { MatchupResult } from '../calc/adapter';

  interface Props {
    speed: MatchupResult['speed'];
    priorityWarning?: string;  // e.g. "Sucker Punch flips order"
  }

  export function SpeedDivider({ speed, priorityWarning }: Props) {
    const arrow = speed.attackerOutspeeds
      ? `⚡ You +${speed.delta}`
      : speed.delta === 0
        ? `⚡ Speed tie`
        : `⚠ They +${Math.abs(speed.delta)}`;
    const color = speed.attackerOutspeeds ? 'text-ok' : speed.delta === 0 ? 'text-warn' : 'text-danger';
    return (
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-card text-[11px] my-2"
           style={{ background: 'linear-gradient(90deg, transparent, rgba(124,92,255,0.15), transparent)' }}>
        <span className={`font-bold ${color}`}>{arrow}</span>
        {priorityWarning && (
          <>
            <span className="opacity-40">·</span>
            <span className="text-priority font-semibold">⚠ {priorityWarning}</span>
          </>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit (propose + wait)**

### Task 19: Nav (bottom on mobile, top on desktop)

**Files:**
- Create: `app/src/components/Nav.tsx`

- [ ] **Step 1: Implement**

  ```tsx
  import { useStore } from '../store';
  import type { Tab } from '../types';

  const ITEMS: Array<{ id: Tab; icon: string; label: string }> = [
    { id: 'battle', icon: '⚔', label: 'Battle' },
    { id: 'teams', icon: '👥', label: 'Teams' },
    { id: 'settings', icon: '⚙', label: 'Settings' },
  ];

  export function Nav() {
    const { tab, setTab } = useStore();
    return (
      <>
        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-3 left-3.5 right-3.5 bg-black/80 backdrop-blur border border-surface-hi rounded-2xl p-2 flex justify-around text-xxs z-20">
          {ITEMS.map(it => (
            <button key={it.id} onClick={() => setTab(it.id)}
                    className={`flex flex-col items-center gap-0.5 ${tab === it.id ? 'text-accent' : 'opacity-55'}`}>
              <span className="text-base">{it.icon}</span>
              <span>{it.label}</span>
            </button>
          ))}
        </nav>
        {/* Desktop top tabs */}
        <nav className="hidden md:flex gap-1 mb-4">
          {ITEMS.map(it => (
            <button key={it.id} onClick={() => setTab(it.id)}
                    className={`px-4 py-2 rounded-lg text-sm ${tab === it.id ? 'bg-accent-gradient text-white' : 'bg-surface border border-surface-hi opacity-70'}`}>
              <span className="mr-1.5">{it.icon}</span>{it.label}
            </button>
          ))}
        </nav>
      </>
    );
  }
  ```

- [ ] **Step 2: Wire into App.tsx**

  Replace `app/src/App.tsx`:
  ```tsx
  import { useStore } from './store';
  import { Nav } from './components/Nav';

  export function App() {
    const tab = useStore(s => s.tab);
    return (
      <div className="min-h-screen bg-bg-base bg-panel-gradient text-text">
        <main className="max-w-[1200px] mx-auto px-3.5 pt-3.5 pb-24 md:pb-6">
          <Nav />
          {tab === 'battle' && <div>Battle (TBD next phase)</div>}
          {tab === 'teams' && <div>Teams (TBD)</div>}
          {tab === 'settings' && <div>Settings (TBD)</div>}
        </main>
      </div>
    );
  }
  ```

- [ ] **Step 3: Verify nav switches via Chrome MCP**

  Run dev server, click each tab, confirm content swaps.

- [ ] **Step 4: Commit (propose + wait)**

---

## Phase 4 — Pickers

### Task 20: SpeciesPicker

**Files:**
- Create: `app/src/components/pickers/SpeciesPicker.tsx`

The picker is a modal/sheet with a search input and a list. Recents are pinned at the top when no query is active.

- [ ] **Step 1: Implement**

  ```tsx
  import { useMemo, useState } from 'react';
  import { Generations } from '@smogon/calc';
  import { useStore } from '../../store';
  import { spriteUrl } from '../../data/sprites';

  interface Props {
    open: boolean;
    onClose: () => void;
    onPick: (species: string) => void;
    showRecents?: boolean;
  }

  const GEN = Generations.get(0);

  function allSpeciesNames(): string[] {
    const names: string[] = [];
    for (const sp of GEN.species) names.push(sp.name);
    return names.sort();
  }

  export function SpeciesPicker({ open, onClose, onPick, showRecents = true }: Props) {
    const [query, setQuery] = useState('');
    const recents = useStore(s => s.recentOpponents);
    const all = useMemo(() => allSpeciesNames(), []);
    const filtered = useMemo(() => {
      if (!query) return all;
      const q = query.toLowerCase();
      return all.filter(n => n.toLowerCase().includes(q));
    }, [all, query]);

    if (!open) return null;

    const showRecentsHeader = showRecents && !query && recents.length > 0;

    return (
      <div className="fixed inset-0 z-30 bg-black/60 flex items-end md:items-center justify-center p-3.5"
           onClick={onClose}>
        <div className="w-full max-w-md bg-bg-base bg-panel-gradient border border-surface-hi rounded-card p-3.5 max-h-[80vh] flex flex-col"
             onClick={e => e.stopPropagation()}>
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search Pokémon"
            className="w-full bg-surface border border-surface-hi rounded-lg px-3 py-2 mb-3 text-sm"
          />
          <div className="overflow-y-auto flex-1 -mx-1 px-1">
            {showRecentsHeader && (
              <>
                <div className="text-xxs uppercase tracking-wider opacity-50 px-2 mb-1.5">Recent</div>
                {recents.map(r => (
                  <Row key={r.id} species={r.mon.species}
                       onPick={() => { onPick(r.mon.species); onClose(); }} />
                ))}
                <div className="text-xxs uppercase tracking-wider opacity-50 px-2 mt-3 mb-1.5">All</div>
              </>
            )}
            {filtered.map(name => (
              <Row key={name} species={name}
                   onPick={() => { onPick(name); onClose(); }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  function Row({ species, onPick }: { species: string; onPick: () => void }) {
    return (
      <button type="button" onClick={onPick}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-surface text-left">
        <img src={spriteUrl(species)} alt="" className="w-8 h-8 rounded" />
        <span className="font-medium">{species}</span>
      </button>
    );
  }
  ```

- [ ] **Step 2: Commit (propose + wait)**

### Task 21: Move/Item/Ability/Nature pickers

**Files:**
- Create: `app/src/components/pickers/MovePicker.tsx`
- Create: `app/src/components/pickers/ItemPicker.tsx`
- Create: `app/src/components/pickers/AbilityPicker.tsx`
- Create: `app/src/components/pickers/NaturePicker.tsx`

Each is a thin variant of SpeciesPicker — same shell, different data source.

- [ ] **Step 1: Generic picker shell**

  Extract a shared `app/src/components/pickers/PickerShell.tsx`:
  ```tsx
  import { ReactNode } from 'react';

  interface Props {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
  }

  export function PickerShell({ open, onClose, title, children }: Props) {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-30 bg-black/60 flex items-end md:items-center justify-center p-3.5"
           onClick={onClose}>
        <div className="w-full max-w-md bg-bg-base bg-panel-gradient border border-surface-hi rounded-card p-3.5 max-h-[80vh] flex flex-col"
             onClick={e => e.stopPropagation()}>
          {title && <h3 className="text-base font-bold mb-2">{title}</h3>}
          {children}
        </div>
      </div>
    );
  }
  ```

  Refactor SpeciesPicker to use it.

- [ ] **Step 2: MovePicker**

  Use `Generations.get(0).moves` to enumerate. Include type badges in the row.

  ```tsx
  import { useMemo, useState } from 'react';
  import { Generations } from '@smogon/calc';
  import { PickerShell } from './PickerShell';
  import { TypeBadge } from '../TypeBadge';

  interface Props {
    open: boolean;
    onClose: () => void;
    onPick: (moveName: string) => void;
  }

  const GEN = Generations.get(0);

  export function MovePicker({ open, onClose, onPick }: Props) {
    const [query, setQuery] = useState('');
    const all = useMemo(() => {
      const out: { name: string; type: string }[] = [];
      for (const m of GEN.moves) out.push({ name: m.name, type: m.type });
      out.sort((a, b) => a.name.localeCompare(b.name));
      return out;
    }, []);
    const filtered = useMemo(() => {
      if (!query) return all;
      const q = query.toLowerCase();
      return all.filter(m => m.name.toLowerCase().includes(q));
    }, [all, query]);

    return (
      <PickerShell open={open} onClose={onClose} title="Pick a move">
        <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
               placeholder="Search moves"
               className="w-full bg-surface border border-surface-hi rounded-lg px-3 py-2 mb-3 text-sm" />
        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {filtered.map(m => (
            <button key={m.name} onClick={() => { onPick(m.name); onClose(); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface">
              <TypeBadge type={m.type} />
              <span className="font-medium">{m.name}</span>
            </button>
          ))}
        </div>
      </PickerShell>
    );
  }
  ```

- [ ] **Step 3: ItemPicker**

  ```tsx
  import { useMemo, useState } from 'react';
  import { Generations } from '@smogon/calc';
  import { PickerShell } from './PickerShell';

  interface Props {
    open: boolean;
    onClose: () => void;
    onPick: (itemName: string) => void;
  }

  const GEN = Generations.get(0);

  export function ItemPicker({ open, onClose, onPick }: Props) {
    const [query, setQuery] = useState('');
    const all = useMemo(() => {
      const out: string[] = ['(none)'];
      for (const it of GEN.items) out.push(it.name);
      return [out[0], ...out.slice(1).sort()];
    }, []);
    const filtered = useMemo(() => {
      if (!query) return all;
      const q = query.toLowerCase();
      return all.filter(n => n.toLowerCase().includes(q));
    }, [all, query]);
    return (
      <PickerShell open={open} onClose={onClose} title="Pick an item">
        <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
               placeholder="Search items"
               className="w-full bg-surface border border-surface-hi rounded-lg px-3 py-2 mb-3 text-sm" />
        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {filtered.map(name => (
            <button key={name} onClick={() => { onPick(name === '(none)' ? '' : name); onClose(); }}
                    className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-surface text-sm">
              {name}
            </button>
          ))}
        </div>
      </PickerShell>
    );
  }
  ```

- [ ] **Step 4: AbilityPicker**

  ```tsx
  import { useMemo, useState } from 'react';
  import { Generations } from '@smogon/calc';
  import { PickerShell } from './PickerShell';

  interface Props {
    open: boolean;
    onClose: () => void;
    onPick: (ability: string) => void;
    species?: string;
  }

  const GEN = Generations.get(0);

  export function AbilityPicker({ open, onClose, onPick, species }: Props) {
    const [query, setQuery] = useState('');
    const all = useMemo(() => {
      // Prefer species-scoped abilities; fall back to all.
      if (species) {
        const sp = GEN.species.get(species as any);
        const arr = sp?.abilities ? Object.values(sp.abilities).filter(Boolean) as string[] : [];
        if (arr.length) return arr;
      }
      const all: string[] = [];
      for (const a of GEN.abilities) all.push(a.name);
      return all.sort();
    }, [species]);
    const filtered = useMemo(() => {
      if (!query) return all;
      const q = query.toLowerCase();
      return all.filter(n => n.toLowerCase().includes(q));
    }, [all, query]);
    return (
      <PickerShell open={open} onClose={onClose} title="Pick an ability">
        <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
               placeholder="Search abilities"
               className="w-full bg-surface border border-surface-hi rounded-lg px-3 py-2 mb-3 text-sm" />
        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {filtered.map(name => (
            <button key={name} onClick={() => { onPick(name); onClose(); }}
                    className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-surface text-sm">
              {name}
            </button>
          ))}
        </div>
      </PickerShell>
    );
  }
  ```

- [ ] **Step 5: NaturePicker**

  ```tsx
  import { useState } from 'react';
  import { Generations } from '@smogon/calc';
  import { PickerShell } from './PickerShell';

  interface Props {
    open: boolean;
    onClose: () => void;
    onPick: (nature: string) => void;
  }

  const GEN = Generations.get(0);
  const NATURES: { name: string; plus?: string; minus?: string }[] = (() => {
    const out: { name: string; plus?: string; minus?: string }[] = [];
    for (const n of GEN.natures) {
      out.push({ name: n.name, plus: n.plus as string | undefined, minus: n.minus as string | undefined });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  })();

  export function NaturePicker({ open, onClose, onPick }: Props) {
    const [query, setQuery] = useState('');
    const filtered = !query ? NATURES : NATURES.filter(n => n.name.toLowerCase().includes(query.toLowerCase()));
    return (
      <PickerShell open={open} onClose={onClose} title="Pick a nature">
        <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
               placeholder="Search natures"
               className="w-full bg-surface border border-surface-hi rounded-lg px-3 py-2 mb-3 text-sm" />
        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {filtered.map(n => (
            <button key={n.name} onClick={() => { onPick(n.name); onClose(); }}
                    className="w-full flex justify-between items-center px-2 py-1.5 rounded-lg hover:bg-surface text-sm">
              <span className="font-medium">{n.name}</span>
              <span className="text-[10px] opacity-60">
                {n.plus && n.minus ? `+${n.plus} / −${n.minus}` : 'neutral'}
              </span>
            </button>
          ))}
        </div>
      </PickerShell>
    );
  }
  ```

- [ ] **Step 6: Commit (propose + wait)**

  Proposed message: `Add Move/Item/Ability/Nature pickers`

---

## Phase 5 — Mon Editor

### Task 22: SpGrid component — TDD

**Files:**
- Create: `app/src/components/editor/SpGrid.tsx`
- Create: `app/src/components/editor/SpGrid.test.tsx`

- [ ] **Step 1: Failing tests**

  ```tsx
  import { describe, it, expect } from 'vitest';
  import { render, screen, fireEvent } from '@testing-library/react';
  import { SpGrid } from './SpGrid';

  describe('SpGrid', () => {
    it('shows current allocation total', () => {
      render(<SpGrid sps={{ atk: 32, spe: 32 }} onChange={() => {}} />);
      expect(screen.getByText(/64 \/ 66/)).toBeInTheDocument();
    });

    it('blocks save when over total', () => {
      render(<SpGrid sps={{ atk: 32, spe: 32, hp: 10 }} onChange={() => {}} />);
      expect(screen.getByText(/exceeds 66/i)).toBeInTheDocument();
    });

    it('calls onChange when a cell is incremented', () => {
      const onChange = vi.fn();
      render(<SpGrid sps={{}} onChange={onChange} />);
      fireEvent.click(screen.getByLabelText(/atk \+/i));
      expect(onChange).toHaveBeenCalledWith({ atk: 1 });
    });
  });
  ```

- [ ] **Step 2: Implement**

  ```tsx
  import type { StatID } from '../../types';
  import { validateSps } from '../../store/validators';
  import { SP_PER_STAT_MAX, SP_TOTAL_MAX } from '../../types';

  const STATS: { id: StatID; label: string }[] = [
    { id: 'hp',  label: 'HP'  },
    { id: 'atk', label: 'Atk' },
    { id: 'def', label: 'Def' },
    { id: 'spa', label: 'SpA' },
    { id: 'spd', label: 'SpD' },
    { id: 'spe', label: 'Spe' },
  ];

  interface Props {
    sps: Partial<Record<StatID, number>>;
    onChange: (sps: Partial<Record<StatID, number>>) => void;
  }

  export function SpGrid({ sps, onChange }: Props) {
    const v = validateSps(sps);

    function bump(stat: StatID, delta: number) {
      const cur = sps[stat] ?? 0;
      const next = Math.max(0, Math.min(SP_PER_STAT_MAX, cur + delta));
      const out = { ...sps, [stat]: next };
      if (next === 0) delete out[stat];
      onChange(out);
    }

    return (
      <div>
        <div className="flex justify-between items-baseline mb-2">
          <div className="text-xxs uppercase tracking-wider opacity-55">Stat Points</div>
          <div className={`text-xxs ${v.ok ? 'opacity-50' : 'text-danger'}`}>
            {v.total} / {SP_TOTAL_MAX}{v.error ? ` · ${v.error}` : ''}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {STATS.map(s => {
            const value = sps[s.id] ?? 0;
            const pct = (value / SP_PER_STAT_MAX) * 100;
            return (
              <div key={s.id} className={`bg-surface border border-surface-hi rounded-lg p-2 text-center ${value > 0 ? 'border-ok/30 bg-ok/5' : ''}`}>
                <div className="text-[9px] uppercase opacity-55 tracking-wider">{s.label}</div>
                <div className="font-extrabold text-lg leading-none mt-1">{value}</div>
                <div className="h-0.5 bg-white/10 rounded mt-1.5 overflow-hidden">
                  <div className="h-full bg-accent-gradient" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex gap-1 mt-1.5 justify-center">
                  <button aria-label={`${s.id} -`} onClick={() => bump(s.id, -1)}
                          className="w-6 h-6 rounded bg-white/5 text-sm">−</button>
                  <button aria-label={`${s.id} +`} onClick={() => bump(s.id, 1)}
                          className="w-6 h-6 rounded bg-white/5 text-sm">+</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 3: Run, verify pass**

- [ ] **Step 4: Commit (propose + wait)**

### Task 23: BuildDropdown + MoveSlots + MegaToggle + MonEditor shell

**Files:**
- Create: `app/src/components/editor/BuildDropdown.tsx`
- Create: `app/src/components/editor/MoveSlots.tsx`
- Create: `app/src/components/MegaToggle.tsx`
- Create: `app/src/components/editor/MonEditor.tsx`

- [ ] **Step 1: BuildDropdown**

  ```tsx
  import { useState } from 'react';
  import { getBuildsForSpecies, getBuild } from '../../data/setdex-champions';
  import type { SavedMon } from '../../types';

  interface Props {
    species: string;
    selectedName?: string;
    onApply: (patch: Partial<SavedMon>, buildName: string) => void;
  }

  export function BuildDropdown({ species, selectedName, onApply }: Props) {
    const builds = getBuildsForSpecies(species);
    const [open, setOpen] = useState(false);

    function pick(name: string) {
      const b = getBuild(species, name);
      if (!b) return;
      onApply({
        buildName: name,
        item: b.item,
        ability: b.ability,
        nature: b.nature,
        sps: b.sps,
        moves: [b.moves[0] ?? '', b.moves[1] ?? '', b.moves[2] ?? '', b.moves[3] ?? ''] as any,
      }, name);
      setOpen(false);
    }

    return (
      <div className="relative">
        <button onClick={() => setOpen(o => !o)}
                className="w-full bg-accent/10 border border-accent/30 rounded-lg px-3 py-2.5 text-sm flex justify-between items-center text-accent">
          <span>{selectedName ?? 'Custom'}</span>
          <span className="opacity-60">{builds.length} builds ▾</span>
        </button>
        {open && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-bg-base bg-panel-gradient border border-surface-hi rounded-lg max-h-64 overflow-y-auto p-1.5">
            {builds.length === 0
              ? <div className="px-2 py-2 text-xs opacity-60">No curated builds for {species}</div>
              : builds.map(name => (
                <button key={name} onClick={() => pick(name)}
                        className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-surface">
                  {name}
                </button>
              ))}
          </div>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 2: MoveSlots**

  ```tsx
  import { useState } from 'react';
  import { Generations } from '@smogon/calc';
  import { TypeBadge } from '../TypeBadge';
  import { MovePicker } from '../pickers/MovePicker';

  const GEN = Generations.get(0);

  function moveTypeOf(name: string): string {
    if (!name) return '???';
    const m = GEN.moves.get(name);
    return (m?.type as string) ?? '???';
  }

  interface Props {
    moves: [string, string, string, string];
    onChange: (moves: [string, string, string, string]) => void;
  }

  export function MoveSlots({ moves, onChange }: Props) {
    const [editing, setEditing] = useState<number | null>(null);
    return (
      <div>
        {moves.map((m, i) => (
          <div key={i} onClick={() => setEditing(i)}
               className="flex justify-between items-center bg-surface border border-surface-hi rounded-lg px-3 py-2 mb-1.5 cursor-pointer">
            <div className="flex items-center gap-2">
              {m ? <><TypeBadge type={moveTypeOf(m)} /><b>{m}</b></> : <span className="text-text-mute">— empty —</span>}
            </div>
            <span className="opacity-40">▾</span>
          </div>
        ))}
        <MovePicker
          open={editing !== null}
          onClose={() => setEditing(null)}
          onPick={(name) => {
            if (editing === null) return;
            const next = [...moves] as [string, string, string, string];
            next[editing] = name;
            onChange(next);
          }}
        />
      </div>
    );
  }
  ```

- [ ] **Step 3: MegaToggle**

  ```tsx
  import { Generations } from '@smogon/calc';

  const GEN = Generations.get(0);

  export function hasMegaForme(species: string): boolean {
    const baseName = species.replace(/-Mega(-X|-Y)?$/, '');
    const megaCandidates = [`${baseName}-Mega`, `${baseName}-Mega-X`, `${baseName}-Mega-Y`];
    return megaCandidates.some(c => !!GEN.species.get(c as any));
  }

  interface Props {
    isMega: boolean;
    onChange: (next: boolean) => void;
    species: string;
  }

  export function MegaToggle({ isMega, onChange, species }: Props) {
    if (!hasMegaForme(species)) return null;
    return (
      <button onClick={() => onChange(!isMega)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${isMega ? 'bg-accent-gradient text-white border-accent' : 'bg-surface border-surface-hi opacity-70'}`}>
        {isMega ? '✦ Mega Active' : 'Mega Evolve'}
      </button>
    );
  }
  ```

- [ ] **Step 4: MonEditor shell**

  ```tsx
  import { useState, useEffect } from 'react';
  import type { SavedMon } from '../../types';
  import { spriteUrl } from '../../data/sprites';
  import { SpeciesPicker } from '../pickers/SpeciesPicker';
  import { ItemPicker } from '../pickers/ItemPicker';
  import { AbilityPicker } from '../pickers/AbilityPicker';
  import { NaturePicker } from '../pickers/NaturePicker';
  import { BuildDropdown } from './BuildDropdown';
  import { SpGrid } from './SpGrid';
  import { MoveSlots } from './MoveSlots';
  import { MegaToggle } from '../MegaToggle';
  import { TypeBadge } from '../TypeBadge';
  import { Generations } from '@smogon/calc';
  import { validateSps } from '../../store/validators';

  const GEN = Generations.get(0);

  interface Props {
    open: boolean;
    initial: SavedMon;
    onClose: () => void;
    onSave: (mon: SavedMon) => void;
  }

  export function MonEditor({ open, initial, onClose, onSave }: Props) {
    const [draft, setDraft] = useState<SavedMon>(initial);
    useEffect(() => setDraft(initial), [initial]);

    const [picker, setPicker] = useState<'species' | 'item' | 'ability' | 'nature' | null>(null);

    if (!open) return null;

    const speciesData = GEN.species.get(draft.species as any);
    const types = speciesData?.types ?? [];
    const valid = validateSps(draft.sps).ok;

    function patch(p: Partial<SavedMon>) {
      setDraft(prev => {
        const next = { ...prev, ...p };
        // Any change to fields backed by a curated build clears buildName.
        if ('item' in p || 'ability' in p || 'nature' in p || 'sps' in p || 'moves' in p) {
          if (p.buildName === undefined) next.buildName = undefined;
        }
        return next;
      });
    }

    return (
      <div className="fixed inset-0 z-30 bg-black/60 flex items-end md:items-center md:justify-end" onClick={onClose}>
        <div className="w-full md:w-[420px] md:h-screen bg-bg-base bg-panel-gradient border border-surface-hi rounded-t-card md:rounded-none p-4 max-h-[90vh] md:max-h-screen overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-4">
            <button onClick={onClose} className="opacity-60">←</button>
            <span className="font-bold">Edit Pokémon</span>
            <span className="w-4" />
          </div>

          {/* Hero */}
          <div className="flex gap-3 items-center mb-4 p-3 bg-danger/10 border border-danger/20 rounded-card">
            <button onClick={() => setPicker('species')}>
              <img src={spriteUrl(draft.species)} className="w-16 h-16 rounded" />
            </button>
            <div className="flex-1">
              <div className="font-extrabold text-lg cursor-pointer" onClick={() => setPicker('species')}>{draft.species}</div>
              <div className="flex gap-1 mt-1">{types.map(t => <TypeBadge key={t} type={t as string} />)}</div>
              <div className="mt-2"><MegaToggle isMega={draft.isMega} species={draft.species}
                                                onChange={isMega => patch({ isMega })} /></div>
            </div>
          </div>

          {/* Build dropdown */}
          <div className="mb-3">
            <div className="text-xxs uppercase tracking-wider opacity-55 mb-1">Build</div>
            <BuildDropdown species={draft.species} selectedName={draft.buildName}
                           onApply={(p, name) => setDraft(d => ({ ...d, ...p, buildName: name }))} />
          </div>

          {/* Item / Ability / Nature */}
          <Field label="Item" value={draft.item ?? '— none —'} onClick={() => setPicker('item')} />
          <Field label="Ability" value={draft.ability ?? '— none —'} onClick={() => setPicker('ability')} />
          <Field label="Nature" value={draft.nature} onClick={() => setPicker('nature')} />

          {/* SP grid */}
          <div className="my-4">
            <SpGrid sps={draft.sps} onChange={sps => patch({ sps })} />
          </div>

          {/* Moves */}
          <div className="mb-4">
            <div className="text-xxs uppercase tracking-wider opacity-55 mb-1">Moves</div>
            <MoveSlots moves={draft.moves} onChange={moves => patch({ moves })} />
          </div>

          {/* Save */}
          <button disabled={!valid} onClick={() => onSave(draft)}
                  className={`w-full py-3 rounded-card font-bold text-base ${valid ? 'bg-accent-gradient text-white' : 'bg-white/10 text-white/40 cursor-not-allowed'}`}>
            Save
          </button>

          <SpeciesPicker open={picker === 'species'} onClose={() => setPicker(null)}
                         showRecents={false} onPick={s => patch({ species: s })} />
          <ItemPicker open={picker === 'item'} onClose={() => setPicker(null)}
                      onPick={item => patch({ item })} />
          <AbilityPicker open={picker === 'ability'} species={draft.species} onClose={() => setPicker(null)}
                         onPick={ability => patch({ ability })} />
          <NaturePicker open={picker === 'nature'} onClose={() => setPicker(null)}
                        onPick={nature => patch({ nature })} />
        </div>
      </div>
    );
  }

  function Field({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
    return (
      <div className="mb-2">
        <div className="text-xxs uppercase tracking-wider opacity-55 mb-1">{label}</div>
        <button onClick={onClick} className="w-full bg-surface border border-surface-hi rounded-lg px-3 py-2 text-sm flex justify-between items-center">
          <span>{value}</span><span className="opacity-40">▾</span>
        </button>
      </div>
    );
  }
  ```

- [ ] **Step 5: Smoke test by adding the editor to a temporary debug button in App.tsx**

  Add a button to App.tsx that opens MonEditor with a default Garchomp draft. Verify via Chrome MCP that all pickers, build dropdown, SP grid, and save flow work end-to-end. Remove the debug button before commit.

- [ ] **Step 6: Commit (propose + wait)**

  Proposed message: `Add Mon Editor with build dropdown, SP grid, mega toggle, move slots`

---

## Phase 6 — Battle screen

### Task 24: TeamCarousel

**Files:**
- Create: `app/src/components/TeamCarousel.tsx`

- [ ] **Step 1: Implement**

  ```tsx
  import { useStore } from '../store';
  import { spriteUrl } from '../data/sprites';

  export function TeamCarousel() {
    const team = useStore(s => s.teams.find(t => t.id === s.activeTeamId));
    const activeIndex = useStore(s => s.activeMonIndex);
    const setActiveMonIndex = useStore(s => s.setActiveMonIndex);

    if (!team) return null;
    const slots = [...team.mons, ...Array(6 - team.mons.length).fill(null)];

    return (
      <div className="flex gap-1.5 mb-3.5">
        {slots.map((mon, i) => {
          const active = mon && i === activeIndex;
          if (!mon) {
            return <div key={i} className="flex-1 aspect-square bg-surface border border-surface-hi rounded-xl flex items-center justify-center opacity-30 text-xs">＋</div>;
          }
          const cur = mon.currentHp ?? 100; // approximation; refine when calc max known
          const fainted = cur === 0;
          return (
            <button key={i} onClick={() => setActiveMonIndex(i)}
                    className={`flex-1 aspect-square rounded-xl flex items-center justify-center relative ${active ? 'bg-accent/20 border-1.5 border-accent shadow-[0_0_20px_rgba(124,92,255,0.3)]' : 'bg-surface border border-surface-hi'} ${fainted ? 'opacity-30' : ''}`}>
              <img src={spriteUrl(mon.species)} alt={mon.species} className="w-3/4 h-3/4 object-contain" />
            </button>
          );
        })}
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit (propose + wait)**

### Task 25: MonCard component (you + opponent variants)

**Files:**
- Create: `app/src/components/MonCard.tsx`

- [ ] **Step 1: Implement**

  ```tsx
  import { Generations } from '@smogon/calc';
  import type { SavedMon } from '../types';
  import { spriteUrl } from '../data/sprites';
  import { TypeBadge } from './TypeBadge';
  import { StatChip } from './StatChip';
  import { HpBar } from './HpBar';
  import { MegaToggle } from './MegaToggle';

  const GEN = Generations.get(0);

  interface Props {
    mon: SavedMon;
    maxHp: number;
    side: 'you' | 'opp';
    onEdit: () => void;
    onChangeHp: (hp: number) => void;
    onChangeMega: (isMega: boolean) => void;
  }

  export function MonCard({ mon, maxHp, side, onEdit, onChangeHp, onChangeMega }: Props) {
    const sp = GEN.species.get(mon.species as any);
    const types = sp?.types ?? [];
    const dashed = side === 'opp' ? 'border-dashed border-danger/25' : 'border-surface-hi';

    return (
      <div className={`bg-surface border ${dashed} rounded-card p-3 mb-2.5`}>
        <div className="flex gap-2.5 items-center mb-2">
          <button onClick={onEdit}><img src={spriteUrl(mon.species)} className="w-13 h-13 rounded-xl" /></button>
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <button onClick={onEdit} className="font-bold text-base">{mon.species}</button>
              <span className="text-[10px] opacity-50">L50</span>
            </div>
            <div className="flex gap-1 mt-1">{types.map(t => <TypeBadge key={t} type={t as string} />)}</div>
          </div>
        </div>

        <HpBar
          current={mon.currentHp}
          max={maxHp}
          showRaw={side === 'you'}
          onChange={onChangeHp}
        />

        <div className="flex gap-1.5 mt-2 flex-wrap">
          {mon.ability && <StatChip icon="🩸" label={mon.ability} editable={side === 'opp'} onClick={onEdit} />}
          {mon.item && <StatChip icon="🎒" label={mon.item} editable={side === 'opp'} onClick={onEdit} />}
          <StatChip icon="🌿" label={mon.nature} editable={side === 'opp'} onClick={onEdit} />
          {mon.status && mon.status !== 'Healthy' && <StatChip label={mon.status} tone="warn" />}
          {Object.entries(mon.boosts).map(([k, v]) => v !== 0 ? (
            <StatChip key={k} label={`${v > 0 ? '+' : ''}${v} ${k}`} tone="boost" />
          ) : null)}
          <MegaToggle isMega={mon.isMega} species={mon.species} onChange={onChangeMega} />
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit (propose + wait)**

### Task 26: FieldBar + FieldDrawer

**Files:**
- Create: `app/src/components/FieldBar.tsx`
- Create: `app/src/components/FieldDrawer.tsx`

- [ ] **Step 1: FieldBar (condensed pills, click to open drawer)**

  ```tsx
  import { useState } from 'react';
  import { useStore } from '../store';
  import { FieldDrawer } from './FieldDrawer';

  export function FieldBar() {
    const field = useStore(s => s.field);
    const [open, setOpen] = useState(false);

    return (
      <>
        <div className="flex gap-1.5 mb-3.5 flex-wrap">
          {field.weather && <Pill active>{weatherIcon(field.weather)} {field.weather}</Pill>}
          {field.terrain && <Pill active>⚡ {field.terrain}</Pill>}
          <Pill onClick={() => setOpen(true)}>＋ Field</Pill>
        </div>
        <FieldDrawer open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  function weatherIcon(w: string) {
    return ({ Sun: '☀', Rain: '🌧', Sand: '🟫', Snow: '❄' } as Record<string, string>)[w] ?? '';
  }

  function Pill({ children, active, onClick }: { children: any; active?: boolean; onClick?: () => void }) {
    const cls = active
      ? 'bg-warn/15 border-warn/40 text-warn'
      : 'bg-surface border-surface-hi opacity-70';
    return <button onClick={onClick} className={`text-[10px] px-2.5 py-1 rounded-full border ${cls}`}>{children}</button>;
  }
  ```

- [ ] **Step 2: FieldDrawer**

  ```tsx
  import { useStore } from '../store';
  import type { FieldState, SideState } from '../types';
  import { PickerShell } from './pickers/PickerShell';

  interface Props { open: boolean; onClose: () => void; }

  const WEATHERS = ['', 'Sun', 'Rain', 'Sand', 'Snow'] as const;
  const TERRAINS = ['', 'Electric', 'Grassy', 'Misty', 'Psychic'] as const;

  const SIDE_FLAGS: { key: keyof SideState; label: string }[] = [
    { key: 'stealthRock',  label: 'Stealth Rock' },
    { key: 'reflect',      label: 'Reflect' },
    { key: 'lightScreen',  label: 'Light Screen' },
    { key: 'auroraVeil',   label: 'Aurora Veil' },
    { key: 'tailwind',     label: 'Tailwind' },
    { key: 'protect',      label: 'Protect' },
    { key: 'leechSeed',    label: 'Leech Seed' },
    { key: 'saltCure',     label: 'Salt Cure' },
    { key: 'helpingHand',  label: 'Helping Hand' },
    { key: 'isPowerTrick', label: 'Power Trick' },
    { key: 'friendGuard',  label: 'Friend Guard' },
    { key: 'isStatBoost',  label: '+1 All Stats' },
    { key: 'isSwitching',  label: 'Switching Out' },
  ];

  export function FieldDrawer({ open, onClose }: Props) {
    const field = useStore(s => s.field);
    const setField = useStore(s => s.setField);

    function setSide(side: 'yourSide' | 'oppSide', key: keyof SideState, value: any) {
      setField({ [side]: { ...field[side], [key]: value } } as Partial<FieldState>);
    }

    return (
      <PickerShell open={open} onClose={onClose} title="Field state">
        <div className="overflow-y-auto flex-1 px-1">

          <Group label="Weather">
            {WEATHERS.map(w => (
              <Toggle key={w || 'none'} active={field.weather === (w || undefined)}
                      onClick={() => setField({ weather: (w || undefined) as any })}>
                {w || 'None'}
              </Toggle>
            ))}
          </Group>

          <Group label="Terrain">
            {TERRAINS.map(t => (
              <Toggle key={t || 'none'} active={field.terrain === (t || undefined)}
                      onClick={() => setField({ terrain: (t || undefined) as any })}>
                {t || 'None'}
              </Toggle>
            ))}
          </Group>

          <Group label="Room / Gravity">
            <Toggle active={!!field.isMagicRoom}  onClick={() => setField({ isMagicRoom:  !field.isMagicRoom  })}>Magic Room</Toggle>
            <Toggle active={!!field.isWonderRoom} onClick={() => setField({ isWonderRoom: !field.isWonderRoom })}>Wonder Room</Toggle>
            <Toggle active={!!field.isGravity}    onClick={() => setField({ isGravity:    !field.isGravity    })}>Gravity</Toggle>
          </Group>

          <SideBlock label="Your side"     side="yourSide" state={field.yourSide} onSet={setSide} />
          <SideBlock label="Opponent side" side="oppSide"  state={field.oppSide}  onSet={setSide} />

        </div>
      </PickerShell>
    );
  }

  function Group({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div className="mb-4">
        <div className="text-xxs uppercase tracking-wider opacity-55 mb-1.5">{label}</div>
        <div className="flex flex-wrap gap-1.5">{children}</div>
      </div>
    );
  }

  function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
      <button onClick={onClick}
              className={`px-2.5 py-1 rounded-lg text-xs border ${active ? 'bg-accent-gradient text-white border-accent' : 'bg-surface border-surface-hi opacity-70'}`}>
        {children}
      </button>
    );
  }

  function SideBlock({ label, side, state, onSet }: {
    label: string; side: 'yourSide' | 'oppSide'; state: SideState;
    onSet: (side: 'yourSide' | 'oppSide', key: keyof SideState, value: any) => void;
  }) {
    return (
      <div className="mb-4">
        <div className="text-xxs uppercase tracking-wider opacity-55 mb-1.5">{label}</div>
        <div className="flex flex-wrap gap-1.5">
          {SIDE_FLAGS.map(f => (
            <Toggle key={f.key} active={!!state[f.key]} onClick={() => onSet(side, f.key, !state[f.key])}>
              {f.label}
            </Toggle>
          ))}
          {/* Spikes 0-3 */}
          <div className="flex gap-1 items-center text-xs">
            <span className="opacity-55 mr-1">Spikes</span>
            {[0, 1, 2, 3].map(n => (
              <Toggle key={n} active={(state.spikes ?? 0) === n} onClick={() => onSet(side, 'spikes', n)}>
                {n}
              </Toggle>
            ))}
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 3: Commit (propose + wait)**

### Task 27: BattleScreen wiring

**Files:**
- Create: `app/src/screens/BattleScreen.tsx`
- Modify: `app/src/App.tsx`

- [ ] **Step 1: Compose**

  ```tsx
  import { useStore } from '../store';
  import { calculateMatchup } from '../calc/adapter';
  import { MonCard } from '../components/MonCard';
  import { TeamCarousel } from '../components/TeamCarousel';
  import { FieldBar } from '../components/FieldBar';
  import { MoveRow } from '../components/MoveRow';
  import { SpeedDivider } from '../components/SpeedDivider';
  import { useState } from 'react';
  import { MonEditor } from '../components/editor/MonEditor';
  import { SpeciesPicker } from '../components/pickers/SpeciesPicker';
  import type { SavedMon } from '../types';

  function emptyMon(species: string): SavedMon {
    return {
      id: crypto.randomUUID(), species, nature: 'Hardy',
      sps: {}, moves: ['','','',''], isMega: false, boosts: {},
    };
  }

  export function BattleScreen() {
    const team = useStore(s => s.teams.find(t => t.id === s.activeTeamId));
    const activeIndex = useStore(s => s.activeMonIndex);
    const opponent = useStore(s => s.opponent);
    const setOpponent = useStore(s => s.setOpponent);
    const upsertMon = useStore(s => s.upsertMon);
    const field = useStore(s => s.field);

    const [editor, setEditor] = useState<{ side: 'you' | 'opp'; mon: SavedMon } | null>(null);
    const [oppPicker, setOppPicker] = useState(false);

    if (!team || team.mons.length === 0) {
      return (
        <div className="text-center mt-10 opacity-70">
          <p>No active team. Go to <b>Teams</b> and create one.</p>
        </div>
      );
    }
    const you = team.mons[activeIndex];
    if (!you) return null;

    if (!opponent) {
      return (
        <>
          <FieldBar />
          <TeamCarousel />
          <div className="text-center mt-6">
            <button onClick={() => setOppPicker(true)}
                    className="px-4 py-2 rounded-lg bg-accent-gradient text-white font-semibold">
              Pick opponent
            </button>
          </div>
          <SpeciesPicker open={oppPicker} onClose={() => setOppPicker(false)}
                         onPick={s => setOpponent(emptyMon(s))} />
        </>
      );
    }

    const matchup = calculateMatchup(you, opponent, field);

    return (
      <>
        <FieldBar />
        <TeamCarousel />

        <MonCard
          mon={you} maxHp={matchup.attackerMaxHp} side="you"
          onEdit={() => setEditor({ side: 'you', mon: you })}
          onChangeHp={(hp) => upsertMon(team.id, { ...you, currentHp: hp })}
          onChangeMega={(isMega) => upsertMon(team.id, { ...you, isMega })}
        />

        <div>
          <div className="text-xxs uppercase tracking-wider opacity-55 mb-1.5">Your moves → opponent</div>
          {matchup.attackerMoves.map((r, i) => <MoveRow key={i} result={r} />)}
        </div>

        <SpeedDivider speed={matchup.speed} />

        <MonCard
          mon={opponent} maxHp={matchup.defenderMaxHp} side="opp"
          onEdit={() => setEditor({ side: 'opp', mon: opponent })}
          onChangeHp={(hp) => setOpponent({ ...opponent, currentHp: hp })}
          onChangeMega={(isMega) => setOpponent({ ...opponent, isMega })}
        />

        <div>
          <div className="text-xxs uppercase tracking-wider opacity-55 mb-1.5">Their moves → you</div>
          {matchup.defenderMoves.map((r, i) => <MoveRow key={i} result={r} />)}
        </div>

        {editor && <MonEditor
          open initial={editor.mon}
          onClose={() => setEditor(null)}
          onSave={mon => {
            if (editor.side === 'you') upsertMon(team.id, mon);
            else setOpponent(mon);
            setEditor(null);
          }}
        />}

        <SpeciesPicker open={oppPicker} onClose={() => setOppPicker(false)}
                       onPick={s => setOpponent(emptyMon(s))} />
      </>
    );
  }
  ```

- [ ] **Step 2: Wire into App.tsx**

  ```tsx
  import { useStore } from './store';
  import { Nav } from './components/Nav';
  import { BattleScreen } from './screens/BattleScreen';
  import { TeamsScreen } from './screens/TeamsScreen';
  import { SettingsScreen } from './screens/SettingsScreen';

  export function App() {
    const tab = useStore(s => s.tab);
    return (
      <div className="min-h-screen bg-bg-base bg-panel-gradient text-text">
        <main className="max-w-[1200px] mx-auto px-3.5 pt-3.5 pb-24 md:pb-6">
          <Nav />
          {tab === 'battle' && <BattleScreen />}
          {tab === 'teams' && <TeamsScreen />}
          {tab === 'settings' && <SettingsScreen />}
        </main>
      </div>
    );
  }
  ```

- [ ] **Step 3: Verify end-to-end via Chrome MCP**

  Boot dev server, create a team via the (TBD) Teams screen — for this test, manually inject one via devtools:
  ```js
  useStore.getState().createTeam({ name: 'Test', format: 'singles' });
  // then upsertMon with a test mon
  ```
  Pick an opponent, see damage values render.

- [ ] **Step 4: Commit (propose + wait)**

  Proposed message: `Wire BattleScreen with calc adapter`

---

## Phase 7 — Teams + Settings

### Task 28: TeamsScreen

**Files:**
- Create: `app/src/screens/TeamsScreen.tsx`

- [ ] **Step 1: Implement**

  ```tsx
  import { useState } from 'react';
  import { useStore } from '../store';
  import { spriteUrl } from '../data/sprites';
  import { MonEditor } from '../components/editor/MonEditor';
  import { SpeciesPicker } from '../components/pickers/SpeciesPicker';
  import type { SavedMon, Team } from '../types';

  function emptyMon(species: string): SavedMon {
    return {
      id: crypto.randomUUID(), species, nature: 'Hardy',
      sps: {}, moves: ['','','',''], isMega: false, boosts: {},
    };
  }

  export function TeamsScreen() {
    const teams = useStore(s => s.teams);
    const activeId = useStore(s => s.activeTeamId);
    const createTeam = useStore(s => s.createTeam);
    const setActiveTeam = useStore(s => s.setActiveTeam);
    const upsertMon = useStore(s => s.upsertMon);
    const recents = useStore(s => s.recentOpponents);
    const clearRecent = useStore(s => s.clearRecent);

    const [picker, setPicker] = useState<{ teamId: string; slotIndex: number } | null>(null);
    const [editor, setEditor] = useState<{ teamId: string; mon: SavedMon } | null>(null);

    return (
      <>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Teams</h2>
          <button onClick={() => createTeam({ name: 'New team', format: 'singles' })}
                  className="w-8 h-8 rounded-full bg-surface border border-surface-hi">⊕</button>
        </div>

        {teams.map(t => (
          <TeamCard key={t.id} team={t} active={t.id === activeId}
                    onActivate={() => { setActiveTeam(t.id); useStore.getState().setTab('battle'); }}
                    onSlot={(i) => {
                      const mon = t.mons[i];
                      if (mon) setEditor({ teamId: t.id, mon });
                      else setPicker({ teamId: t.id, slotIndex: i });
                    }} />
        ))}

        {teams.length === 0 && (
          <div className="text-center mt-10 opacity-70">No teams yet — tap ⊕ to create one.</div>
        )}

        {recents.length > 0 && (
          <div className="mt-6">
            <div className="text-xxs uppercase tracking-wider opacity-50 px-1 mb-2">Recent opponents</div>
            {recents.map(r => (
              <div key={r.id} className="flex items-center gap-2.5 px-2.5 py-2 bg-surface/60 border border-surface-hi rounded-lg mb-1.5">
                <img src={spriteUrl(r.mon.species)} className="w-8 h-8 rounded" />
                <div className="flex-1">
                  <div className="font-semibold">{r.mon.species}</div>
                  <div className="text-[10px] opacity-50">{r.mon.buildName ?? 'Custom'} · {r.useCount} battles</div>
                </div>
                <button onClick={() => clearRecent(r.id)} className="opacity-50">×</button>
              </div>
            ))}
          </div>
        )}

        {picker && <SpeciesPicker
          open onClose={() => setPicker(null)} showRecents={false}
          onPick={species => {
            const mon = emptyMon(species);
            upsertMon(picker.teamId, mon);
            setPicker(null);
            setEditor({ teamId: picker.teamId, mon });
          }} />}

        {editor && <MonEditor
          open initial={editor.mon}
          onClose={() => setEditor(null)}
          onSave={mon => { upsertMon(editor.teamId, mon); setEditor(null); }}
        />}
      </>
    );
  }

  function TeamCard({ team, active, onActivate, onSlot }: {
    team: Team; active: boolean; onActivate: () => void; onSlot: (i: number) => void;
  }) {
    const slots = [...team.mons, ...Array(6 - team.mons.length).fill(null)];
    return (
      <div className={`bg-surface border rounded-card p-3 mb-2.5 ${active ? 'border-accent shadow-[0_0_24px_rgba(124,92,255,0.25)]' : 'border-surface-hi'}`}>
        <div className="flex justify-between items-center">
          <button onClick={onActivate} className="text-left">
            <div className="font-bold text-[15px]">{team.name}</div>
            <div className="text-[11px] opacity-55">
              {team.format === 'singles' ? 'Singles' : 'Doubles'} · last edited {new Date(team.updatedAt).toLocaleDateString()}
            </div>
          </button>
        </div>
        <div className="flex gap-1.5 mt-2.5">
          {slots.map((mon, i) => (
            <button key={i} onClick={() => onSlot(i)}
                    className="flex-1 aspect-square bg-surface border border-surface-hi rounded-lg flex items-center justify-center">
              {mon ? <img src={spriteUrl((mon as SavedMon).species)} className="w-3/4 h-3/4 object-contain" />
                   : <span className="opacity-30 text-xs">＋</span>}
            </button>
          ))}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit (propose + wait)**

### Task 29: SettingsScreen

**Files:**
- Create: `app/src/screens/SettingsScreen.tsx`

- [ ] **Step 1: Implement**

  ```tsx
  import { useStore } from '../store';

  export function SettingsScreen() {
    const notation = useStore(s => s.notation);
    const setNotation = useStore(s => s.setNotation);
    const clearAllRecents = useStore(s => s.clearAllRecents);
    const resetAll = useStore(s => s.resetAll);

    function exportJson() {
      const blob = new Blob([JSON.stringify(useStore.getState(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `champions-calc-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }

    async function importJson() {
      const file = await pickFile();
      if (!file) return;
      const text = await file.text();
      try {
        const parsed = JSON.parse(text);
        useStore.setState(parsed);
      } catch (e) {
        alert('Invalid file');
      }
    }

    return (
      <div>
        <h2 className="text-xl font-bold mb-4">Settings</h2>

        <Section title="Notation">
          <Toggle value={notation === 'percent'} onClick={() => setNotation('percent')} label="100%" />
          <Toggle value={notation === 'pixels'} onClick={() => setNotation('pixels')} label="48ths" />
        </Section>

        <Section title="Data">
          <Action label="Export all data" onClick={exportJson} />
          <Action label="Import data" onClick={importJson} />
          <Action label="Clear recent opponents" onClick={clearAllRecents} />
          <Action label="Reset everything" tone="danger" onClick={() => {
            if (confirm('Wipe all teams, recents, and settings?')) resetAll();
          }} />
        </Section>
      </div>
    );
  }

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div className="mb-5">
        <div className="text-xxs uppercase tracking-wider opacity-55 mb-2">{title}</div>
        <div className="flex flex-wrap gap-2">{children}</div>
      </div>
    );
  }

  function Toggle({ value, onClick, label }: { value: boolean; onClick: () => void; label: string }) {
    return (
      <button onClick={onClick}
              className={`px-3 py-1.5 rounded-lg text-sm ${value ? 'bg-accent-gradient text-white' : 'bg-surface border border-surface-hi opacity-70'}`}>
        {label}
      </button>
    );
  }

  function Action({ label, onClick, tone }: { label: string; onClick: () => void; tone?: 'danger' }) {
    const c = tone === 'danger' ? 'bg-danger/10 border-danger/30 text-danger' : 'bg-surface border-surface-hi';
    return <button onClick={onClick} className={`w-full text-left px-3 py-2 rounded-lg border ${c} text-sm`}>{label}</button>;
  }

  function pickFile(): Promise<File | null> {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';
      input.onchange = () => resolve(input.files?.[0] ?? null);
      input.click();
    });
  }
  ```

- [ ] **Step 2: Commit (propose + wait)**

---

## Phase 8 — Responsive desktop + E2E

### Task 30: Desktop column layout

**Files:**
- Modify: `app/src/screens/BattleScreen.tsx`

- [ ] **Step 1: Wrap battle content in a responsive grid**

  At ≥`md` (900px), put the team carousel as a left rail (vertical), the active mon + your moves in the center, and the opponent + their moves on the right.

  Replace the JSX structure in `BattleScreen.tsx` to use a grid:
  ```tsx
  <div className="md:grid md:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)] md:gap-4">
    <div className="md:col-span-3"><FieldBar /></div>

    {/* Team rail */}
    <div className="md:flex md:flex-col">
      <div className="md:hidden"><TeamCarousel /></div>
      <div className="hidden md:block">
        <VerticalTeamCarousel />
      </div>
    </div>

    {/* Center: you + your moves */}
    <div>
      <MonCard ... side="you" />
      <div>{matchup.attackerMoves.map(...)}</div>
      <SpeedDivider ... />
    </div>

    {/* Right: opponent + their moves */}
    <div>
      <MonCard ... side="opp" />
      <div>{matchup.defenderMoves.map(...)}</div>
    </div>
  </div>
  ```

  Add a `VerticalTeamCarousel` component (mirror of `TeamCarousel` but with `flex-col`).

- [ ] **Step 2: Verify in browser at 1280px width via Chrome MCP**

- [ ] **Step 3: Commit (propose + wait)**

### Task 31: Playwright E2E — golden path

**Files:**
- Create: `app/playwright.config.ts`
- Create: `app/e2e/golden-path.spec.ts`

- [ ] **Step 1: Playwright config**

  ```ts
  import { defineConfig, devices } from '@playwright/test';

  export default defineConfig({
    testDir: './e2e',
    timeout: 30000,
    use: {
      baseURL: 'http://localhost:5173',
      trace: 'on-first-retry',
    },
    webServer: {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
    projects: [
      { name: 'mobile-iphone-13', use: { ...devices['iPhone 13'] } },
      { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    ],
  });
  ```

- [ ] **Step 2: Install Playwright browsers**

  Run: `npx playwright install chromium`

- [ ] **Step 3: Golden-path test**

  `app/e2e/golden-path.spec.ts`:
  ```ts
  import { test, expect } from '@playwright/test';

  test('create team, add Garchomp, set up Skarmory opponent, see damage', async ({ page }) => {
    await page.goto('/');

    // Go to Teams, create a team
    await page.getByRole('button', { name: /Teams/ }).click();
    await page.getByRole('button', { name: '⊕' }).click();
    await expect(page.getByText('New team')).toBeVisible();

    // Add a mon to slot 1
    await page.locator('button:has(span:has-text("＋"))').first().click();
    await page.getByPlaceholder('Search Pokémon').fill('Garchomp');
    await page.getByRole('button', { name: /^Garchomp$/ }).click();

    // Editor opens — pick a build
    await page.getByText('Custom').click();
    await page.getByText(/Swords Dance/).first().click();
    await page.getByRole('button', { name: 'Save' }).click();

    // Activate the team
    await page.getByText('New team').click();

    // Pick an opponent
    await page.getByRole('button', { name: 'Pick opponent' }).click();
    await page.getByPlaceholder('Search Pokémon').fill('Skarmory');
    await page.getByRole('button', { name: /^Skarmory$/ }).click();

    // Assert damage values appear
    const yourMoves = page.locator('text=Your moves → opponent');
    await expect(yourMoves).toBeVisible();
    await expect(page.getByText(/%$/).first()).toBeVisible();

    // Reload, verify persistence
    await page.reload();
    await expect(page.getByText('Skarmory')).toBeVisible();
  });
  ```

- [ ] **Step 4: Run E2E**

  Run: `npm --workspace app run test:e2e`
  Expected: passes on chromium and iPhone 13 viewports.

- [ ] **Step 5: Commit (propose + wait)**

  Proposed message: `Add Playwright E2E golden path`

---

## Final Checklist

- [ ] All tasks committed (with explicit owner approval per commit)
- [ ] `npm test` (root) passes — workspace tests for both `calc` and `app`
- [ ] `npm run build` (root) produces a working `app/dist/`
- [ ] Manual UI walkthrough via Chrome MCP at mobile + desktop widths
- [ ] Open Questions in spec resolved (Tasks 7, 8, 23, 30)
- [ ] **Stop and ask owner** before merging the feature branch back to master

---

## Open Items Deferred to Phase 2

- Team builder with opponent recommendations
- Light theme
- PWA install / offline support
- Sharing teams via URL
- Cloud sync / accounts
