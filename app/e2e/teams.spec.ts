import { expect, test } from '@playwright/test';

import { addMonToFirstSlot, createTeam, freshStart, nav } from './helpers';

test.beforeEach(async ({ page }) => {
  await freshStart(page);
  await nav(page, 'Teams');
});

test('create a new team and see it in the list', async ({ page }) => {
  await createTeam(page);
  await expect(page.getByText('New team')).toBeVisible();
});

test('rename a team via the ⋯ menu', async ({ page }) => {
  await createTeam(page);

  await page.getByRole('button', { name: 'Team menu' }).click();
  await page.getByRole('button', { name: 'Rename' }).click();

  // The in-app PromptDialog (replaces window.prompt for iOS Brave compat).
  const input = page.getByTestId('prompt-input');
  await expect(input).toBeVisible();
  await input.fill('My Cool Team');
  await page.getByTestId('prompt-ok').click();

  await expect(page.getByText('My Cool Team')).toBeVisible();
});

test('duplicate a team', async ({ page }) => {
  await createTeam(page);

  // Add Garchomp so we can verify mons copy too.
  await addMonToFirstSlot(page, 'Garchomp', /Swords Dance/);

  await page.getByRole('button', { name: 'Team menu' }).first().click();
  await page.getByRole('button', { name: 'Duplicate' }).click();

  // Both teams are visible; the copy is named "New team (copy)".
  await expect(page.getByText('New team', { exact: true })).toBeVisible();
  await expect(page.getByText('New team (copy)')).toBeVisible();
});

test('delete a team after confirm', async ({ page }) => {
  await createTeam(page);
  await page.getByRole('button', { name: 'Team menu' }).click();
  await page.getByRole('button', { name: 'Delete' }).click();

  // ConfirmDialog now drives the destructive flow (replaces window.confirm).
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await page.getByTestId('confirm-ok').click();
  await expect(page.getByTestId('create-team-empty')).toBeVisible();
});

test('add a mon to a slot via species picker + build', async ({ page }) => {
  await createTeam(page);
  await addMonToFirstSlot(page, 'Skarmory', /Defensive/);

  // After saving, the editor closes and the slot now shows the sprite.
  // Confirm by counting slots that contain an <img> - should be 1, not the
  // initial 0.
  const filled = page.locator('div.flex.gap-1\\.5.mt-2\\.5 button:has(img)');
  await expect(filled).toHaveCount(1);
});

test('remove a mon from a team via the trash button in MonEditor', async ({ page }) => {
  await createTeam(page);
  await addMonToFirstSlot(page, 'Garchomp', /Swords Dance/);

  // Re-open the editor by clicking the slot sprite.
  await page.locator('div.flex.gap-1\\.5.mt-2\\.5 button:has(img)').first().click();

  await page.getByTestId('delete-mon').click();

  // The ConfirmDialog (replaces window.confirm so iOS Brave doesn't swallow it).
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await page.getByTestId('confirm-ok').click();

  // Toast confirms the removal.
  await expect(page.getByText('Garchomp removed')).toBeVisible();

  // Slot is empty again - no sprites in the slot row.
  await expect(page.locator('div.flex.gap-1\\.5.mt-2\\.5 button:has(img)')).toHaveCount(0);
});
