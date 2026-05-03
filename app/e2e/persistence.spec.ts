import { test, expect } from '@playwright/test';
import {
  freshStart, nav, createTeam, addMonToFirstSlot, activateTeam, pickOpponent,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test('team persists across reload', async ({ page }) => {
  await nav(page, 'Teams');
  await createTeam(page);
  await addMonToFirstSlot(page, 'Garchomp', /Swords Dance/);

  await page.reload();
  await nav(page, 'Teams');
  await expect(page.getByText('New team')).toBeVisible();
  // Slot still has a sprite - TeamsScreen slot imgs don't carry alt, so use
  // the sprite-bearing slot button as the marker.
  await expect(
    page.locator('div.flex.gap-1\\.5.mt-2\\.5 button:has(img)'),
  ).toHaveCount(1);
});

test('opponent persists across reload', async ({ page }) => {
  await nav(page, 'Teams');
  await createTeam(page);
  await addMonToFirstSlot(page, 'Garchomp', /Swords Dance/);
  await activateTeam(page, 'New team');
  await pickOpponent(page, 'Skarmory');

  await page.reload();
  // Active team is still the one we created; opponent re-renders as Skarmory.
  await expect(page.getByTestId('edit-name-opp')).toContainText('Skarmory');
});

test('notation setting persists across reload', async ({ page }) => {
  await nav(page, 'Settings');
  // Switch from default "percent" to "pixels".
  await page.getByRole('button', { name: '48ths' }).click();

  await page.reload();
  await nav(page, 'Settings');

  // The selected toggle is the "48ths" pill (active background = bg-accent-gradient).
  // Easier check: query the active button's class via DOM.
  const active = await page.getByRole('button', { name: '48ths' }).getAttribute('class');
  expect(active).toContain('accent-gradient');
});

test('open MonEditor reopens after reload (iOS unload-and-restore)', async ({ page }) => {
  // Mirrors the iOS Safari/Brave failure mode: tab gets unloaded under
  // memory pressure, page reloads on return, the user expects to land
  // back on the same edit they were doing.
  await nav(page, 'Teams');
  await createTeam(page);
  await addMonToFirstSlot(page, 'Garchomp', /Swords Dance/);

  // Tap the (now filled) slot to open the editor on Garchomp.
  await page.getByTestId('team-slot-filled-0').first().click();

  // Editor's hero shows the species name. Use a scoped match - "Garchomp"
  // also appears in the team carousel.
  await expect(page.getByText('Edit Pokémon')).toBeVisible();
  // The hero <div> with text-lg is the species title inside MonEditor.
  await expect(page.locator('div.font-extrabold.text-lg', { hasText: 'Garchomp' })).toBeVisible();

  await page.reload();

  // Editor should reopen automatically because the target was persisted.
  await expect(page.getByText('Edit Pokémon')).toBeVisible();
  await expect(page.locator('div.font-extrabold.text-lg', { hasText: 'Garchomp' })).toBeVisible();
});
