import { test, expect } from '@playwright/test';
import {
  freshStart, nav, createTeam, addMonToFirstSlot, activateTeam, pickOpponent,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test('toggle notation between percent and pixels', async ({ page }) => {
  await nav(page, 'Settings');

  // Default is percent — the "100%" pill is active.
  const percent = page.getByRole('button', { name: '100%' });
  const pixels = page.getByRole('button', { name: '48ths' });

  await expect(percent).toHaveClass(/accent-gradient/);

  await pixels.click();
  await expect(pixels).toHaveClass(/accent-gradient/);
  await expect(percent).not.toHaveClass(/accent-gradient/);
});

test('clear recent opponents removes them from the list', async ({ page }) => {
  // Seed a recent by picking an opponent.
  await nav(page, 'Teams');
  await createTeam(page);
  await addMonToFirstSlot(page, 'Garchomp', /Swords Dance/);
  await activateTeam(page, 'New team');
  await pickOpponent(page, 'Skarmory');

  // Now the recent should show on the Teams screen.
  await nav(page, 'Teams');
  await expect(page.getByTestId('recent-Skarmory')).toBeVisible();

  // Clear via Settings.
  await nav(page, 'Settings');
  await page.getByRole('button', { name: 'Clear recent opponents' }).click();

  await nav(page, 'Teams');
  await expect(page.getByTestId('recent-Skarmory')).toHaveCount(0);
});

test('export data triggers a JSON download', async ({ page }) => {
  await nav(page, 'Settings');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all data' }).click();
  const download = await downloadPromise;

  // Filename pattern: champions-calc-export-{timestamp}.json
  expect(download.suggestedFilename()).toMatch(/champions-calc-export-\d+\.json/);
});

test('reset everything wipes teams (with confirm)', async ({ page }) => {
  await nav(page, 'Teams');
  await createTeam(page);

  await nav(page, 'Settings');
  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: 'Reset everything' }).click();

  await nav(page, 'Teams');
  await expect(page.getByText('No teams yet — tap ⊕ to create one.')).toBeVisible();
});
