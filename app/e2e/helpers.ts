import { expect, type Page } from '@playwright/test';

/**
 * Shared E2E helpers. Mobile is the priority target — selectors here aim to
 * work on both mobile-iphone-13 and desktop-chromium where possible (mobile
 * uses bottom nav, desktop uses top tabs; we filter by visibility).
 */

/** Wipe persisted state so each spec starts from a known-empty store. */
export async function freshStart(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
  });
  await page.reload();
}

/** Click a top-level nav item by name; works on both layouts. */
export async function nav(page: Page, label: 'Battle' | 'Teams' | 'Settings') {
  await page
    .getByRole('button', { name: new RegExp(label) })
    .filter({ visible: true })
    .first()
    .click();
}

/**
 * Create a team by tapping the ⊕ button on the Teams screen. Assumes we're
 * already on the Teams screen.
 */
export async function createTeam(page: Page) {
  await page.getByTestId('create-team').click();
  await expect(page.getByText('New team').first()).toBeVisible();
}

/**
 * Pick a species from the species picker and apply a curated build (or just
 * Save when buildName is undefined). Assumes the editor is open after the
 * species pick.
 */
export async function addMonToFirstSlot(
  page: Page,
  species: string,
  buildName?: RegExp,
) {
  // Click the first empty slot on the active team card.
  await page.getByTestId('team-slot-empty-0').first().click();
  const shell = page.getByTestId('picker-shell');
  await shell.getByPlaceholder('Search Pokémon').fill(species);
  await shell.getByRole('button', { name: new RegExp(`^${species}$`) }).first().click();
  if (buildName) {
    // Build dropdown shows "Custom" until a build is applied. Open and pick.
    await page.getByRole('button', { name: /^Custom/ }).click();
    await page.getByRole('button', { name: buildName }).first().click();
  }
  await page.getByRole('button', { name: 'Save' }).click();
}

/** Activate a team by tapping its name on the Teams screen. */
export async function activateTeam(page: Page, name: string) {
  await page.getByText(name).first().click();
}

/**
 * Pick a species inside an open SpeciesPicker. Scopes the click to the
 * picker-shell overlay so it doesn't match team-carousel buttons that also
 * carry the species name as their accessible label.
 */
async function pickSpeciesInOpenPicker(page: Page, species: string) {
  const shell = page.getByTestId('picker-shell');
  await shell.getByPlaceholder('Search Pokémon').fill(species);
  await shell.getByRole('button', { name: new RegExp(`^${species}$`) }).first().click();
}

/**
 * Pick an opponent species via the empty-state placeholder card. Assumes
 * we're on the Battle screen with no opponent set.
 */
export async function pickOpponent(page: Page, species: string) {
  await page.getByTestId('pick-opponent').click();
  await pickSpeciesInOpenPicker(page, species);
}

/**
 * Swap to a different opponent by tapping the opponent card surface.
 * Assumes an opponent is already set.
 */
export async function swapOpponent(page: Page, species: string) {
  await page.getByTestId('swap-opp').click();
  await pickSpeciesInOpenPicker(page, species);
}
