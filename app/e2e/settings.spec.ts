import { expect, test } from '@playwright/test';

import { activateTeam, addMonToFirstSlot, createTeam, freshStart, nav, pickOpponent } from './helpers';

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test('toggle notation between percent and pixels', async ({ page }) => {
  await nav(page, 'Settings');

  // Default is percent - the "100%" pill is active.
  const percent = page.getByRole('button', { name: '100%' });
  const pixels = page.getByRole('button', { name: '48ths' });

  await expect(percent).toHaveClass(/accent-gradient/);

  await pixels.click();
  await expect(pixels).toHaveClass(/accent-gradient/);
  await expect(percent).not.toHaveClass(/accent-gradient/);
});

test('clear recent opponents removes them from the list', async ({ page }) => {
  // Seed a recent by picking an opponent. The Teams-screen "Recent Opponents"
  // block was removed in favour of the meta-teams browser, so recents are now
  // surfaced only as the "Recent" row inside the species picker.
  await nav(page, 'Teams');
  await createTeam(page);
  await addMonToFirstSlot(page, 'Garchomp', /Swords Dance/);
  await activateTeam(page, 'New team');
  await pickOpponent(page, 'Skarmory');

  // Re-open the opponent picker and confirm Skarmory is listed under Recent.
  await page.getByTestId('swap-btn-opp').click();
  const shell = page.getByTestId('picker-shell');
  // The picker keeps query state across opens; clear it so the Recent header
  // (only shown when the query is empty) renders.
  await shell.getByPlaceholder('Search Pokémon').fill('');
  await expect(shell.getByText('Recent', { exact: true })).toBeVisible();
  await expect(shell.getByRole('button', { name: /^Skarmory$/ }).first()).toBeVisible();
  // Close the picker (tap the backdrop) before navigating away.
  await page.locator('div.fixed.inset-0').first().click({ position: { x: 5, y: 5 } });

  // Clear via Settings.
  await nav(page, 'Settings');
  await page.getByRole('button', { name: 'Clear recent opponents' }).click();

  // Back on Battle, re-open the picker: the Recent header (and Skarmory's
  // recent row) is gone.
  await nav(page, 'Battle');
  await page.getByTestId('swap-btn-opp').click();
  const shell2 = page.getByTestId('picker-shell');
  await shell2.getByPlaceholder('Search Pokémon').fill('');
  await expect(shell2.getByText('Recent', { exact: true })).toHaveCount(0);
});

test('export data triggers a JSON download', async ({ page }) => {
  await nav(page, 'Settings');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all data' }).click();
  const download = await downloadPromise;

  // Filename pattern: futuresight-export-{timestamp}.json
  expect(download.suggestedFilename()).toMatch(/futuresight-export-\d+\.json/);
});

test('reset everything wipes teams (with confirm)', async ({ page }) => {
  await nav(page, 'Teams');
  await createTeam(page);

  await nav(page, 'Settings');
  await page.getByRole('button', { name: 'Reset everything' }).click();

  // ConfirmDialog replaces window.confirm here too.
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await page.getByTestId('confirm-ok').click();

  await nav(page, 'Teams');
  await expect(page.getByTestId('create-team-empty')).toBeVisible();
});
