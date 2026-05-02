import { test, expect } from '@playwright/test';
import { freshStart, nav, createTeam } from './helpers';

/**
 * Helper: open a fresh editor on Garchomp on a brand-new team. Used by most
 * tests in this file.
 */
async function openGarchompEditor(page: import('@playwright/test').Page) {
  await freshStart(page);
  await nav(page, 'Teams');
  await createTeam(page);
  await page.getByTestId('team-slot-empty-0').first().click();
  const shell = page.getByTestId('picker-shell');
  await shell.getByPlaceholder('Search Pokémon').fill('Garchomp');
  await shell.getByRole('button', { name: /^Garchomp$/ }).first().click();
}

test('curated build auto-fills item / ability / nature / moves', async ({ page }) => {
  await openGarchompEditor(page);

  // Build dropdown shows "Custom" until applied.
  await page.getByRole('button', { name: /^Custom/ }).click();
  await page.getByRole('button', { name: /Mixed Mega/ }).first().click();

  // The first build "SM OU Mixed Mega" uses Garchompite + Rough Skin + Hasty.
  // Fields render the chosen values.
  await expect(page.getByRole('button', { name: /Garchompite/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Rough Skin/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Hasty/ })).toBeVisible();
});

test('change item via picker', async ({ page }) => {
  await openGarchompEditor(page);

  await page.getByTestId('field-item').click();
  // Leftovers is in the Champions item list; Life Orb wasn't carried over.
  await page.getByPlaceholder('Search items').fill('Leftovers');
  await page.getByRole('button', { name: /^Leftovers$/ }).click();

  // The Item field's value text reflects the picked item.
  await expect(page.getByTestId('field-item')).toContainText('Leftovers');
});

test('change ability via picker — list is species-filtered', async ({ page }) => {
  await openGarchompEditor(page);

  await page.getByTestId('field-ability').click();

  // In the Champions species data Garchomp's only canonical ability is
  // Sand Veil (Rough Skin is a setdex artifact, not a champions ability).
  // The picker filters by species, so unrelated abilities like Adaptability
  // shouldn't appear.
  await expect(page.getByRole('button', { name: /^Sand Veil$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Adaptability$/ })).toHaveCount(0);

  await page.getByRole('button', { name: /^Sand Veil$/ }).click();
  await expect(page.getByTestId('field-ability')).toContainText('Sand Veil');
});

test('change nature via picker — natures are grouped', async ({ page }) => {
  await openGarchompEditor(page);

  await page.getByTestId('field-nature').click();

  // Group headers from groupNatures(): "+Atk", "+Def", "+SpA", "+SpD", "+Spe".
  // (Calc reports neutral natures with plus === minus, so they fall into the
  // matching plus bucket rather than a dedicated Neutral group — that's the
  // current shipping behavior and we test what we ship.)
  await expect(page.getByText('+Atk', { exact: true })).toBeVisible();
  await expect(page.getByText('+SpA', { exact: true })).toBeVisible();
  await expect(page.getByText('+Spe', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /^Adamant/ }).click();
  await expect(page.getByTestId('field-nature')).toContainText('Adamant');
});

test('change a move via picker — Common section appears for known species', async ({ page }) => {
  await openGarchompEditor(page);

  // Tap the first move slot ("— empty —").
  await page.getByText('— empty —').first().click();

  // Common section header is rendered when the species has known moves.
  await expect(page.getByText('Common', { exact: true })).toBeVisible();
  await expect(page.getByText('All', { exact: true })).toBeVisible();

  await page.getByPlaceholder('Search moves').fill('Earthquake');
  await page.getByRole('button', { name: /Earthquake/ }).first().click();

  // The chosen move now renders in the slot row as bold text.
  await expect(page.locator('b', { hasText: 'Earthquake' })).toBeVisible();
});

test('SP grid: per-stat cap is 32 and total cap is 66', async ({ page }) => {
  await openGarchompEditor(page);

  // The aria-label is "atk +" / "hp +" etc. — see SpGrid.tsx. Per-stat clamp
  // is enforced inside bump(); 35 clicks on atk leaves the cell at 32.
  for (let i = 0; i < 35; i++) {
    await page.getByRole('button', { name: 'atk +' }).click();
  }
  // Header reads "{total} / 66"; atk alone gives 32 / 66.
  await expect(page.getByText('32 / 66')).toBeVisible();

  // Bump spe to 32 — total goes to 64.
  for (let i = 0; i < 35; i++) {
    await page.getByRole('button', { name: 'spe +' }).click();
  }
  await expect(page.getByText('64 / 66')).toBeVisible();

  // Total cap is enforced by the validator (not the bump fn). Adding 3 more
  // to spd takes the total to 67, which surfaces a "total exceeds 66" error
  // and disables Save.
  await page.getByRole('button', { name: 'spd +' }).click();
  await page.getByRole('button', { name: 'spd +' }).click();
  await page.getByRole('button', { name: 'spd +' }).click();
  await expect(page.getByText(/total exceeds 66/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
});

test('Mega toggle is gated on held mega stone — Garchomp + Garchompite shows it', async ({ page }) => {
  await openGarchompEditor(page);

  // Without an item, no Mega toggle yet.
  await expect(page.getByRole('button', { name: /Mega Evolve/ })).toHaveCount(0);

  // Apply Garchompite via the curated build.
  await page.getByRole('button', { name: /^Custom/ }).click();
  await page.getByRole('button', { name: /Mixed Mega/ }).first().click();

  // Now the toggle appears.
  await expect(page.getByRole('button', { name: /Mega Evolve/ })).toBeVisible();

  // Toggle on — label flips to "Mega Active".
  await page.getByRole('button', { name: /Mega Evolve/ }).click();
  await expect(page.getByRole('button', { name: /Mega Active/ })).toBeVisible();
});
