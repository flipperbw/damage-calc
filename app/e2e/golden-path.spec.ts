import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Start each run from a clean slate so persisted state from prior runs
  // doesn't leak in.
  await page.goto('/');
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
  });
});

test('create team, add Garchomp, set up Skarmory opponent, see damage', async ({ page }) => {
  await page.goto('/');

  // Go to Teams. There are two nav stacks (mobile bottom + desktop top); only
  // the one that matches the viewport is visible, so filter by visibility.
  await page.getByRole('button', { name: /Teams/ }).filter({ visible: true }).first().click();

  // Create a new team via the ⊕ button.
  await page.getByRole('button', { name: '⊕' }).click();
  await expect(page.getByText('New team')).toBeVisible();

  // Add a mon to slot 1 — slot buttons render a fullwidth "＋" placeholder.
  await page.locator('button:has(span:has-text("＋"))').first().click();

  // SpeciesPicker opens — search and pick Garchomp.
  await page.getByPlaceholder('Search Pokémon').fill('Garchomp');
  await page.getByRole('button', { name: /^Garchomp$/ }).click();

  // Editor opens. The Build dropdown displays "Custom" until a build is
  // applied. Click it, then pick a Swords Dance build.
  await page.getByRole('button', { name: /^Custom/ }).click();
  await page.getByRole('button', { name: /Swords Dance/ }).first().click();
  await page.getByRole('button', { name: 'Save' }).click();

  // Activate the team by clicking its name in the team list.
  await page.getByText('New team').click();

  // We're on the Battle screen — pick an opponent.
  await page.getByRole('button', { name: 'Pick opponent' }).click();
  await page.getByPlaceholder('Search Pokémon').fill('Skarmory');
  await page.getByRole('button', { name: /^Skarmory$/ }).click();

  // Damage values appear.
  await expect(page.getByText('Your moves → opponent')).toBeVisible();
  await expect(page.getByText(/%$/).first()).toBeVisible();

  // Reload — opponent persists.
  await page.reload();
  await expect(page.getByText('Skarmory').first()).toBeVisible();
});
