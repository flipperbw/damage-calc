import { expect, test } from '@playwright/test';

import { activateTeam, addMonToFirstSlot, createTeam, freshStart, nav, pickOpponent, swapOpponent } from './helpers';

test.beforeEach(async ({ page }) => {
  await freshStart(page);
  await nav(page, 'Teams');
  await createTeam(page);
  await addMonToFirstSlot(page, 'Garchomp', /Swords Dance/);
  await activateTeam(page, 'New team');
});

test('recent species appears as a Recent row in the species picker', async ({ page }) => {
  await pickOpponent(page, 'Skarmory');
  await swapOpponent(page, 'Clefable');

  // Re-open the picker via the dedicated swap button. (Tapping the card's
  // dead-center surface hits the stat grid, which stops propagation, so it
  // doesn't open the picker on touch viewports.)
  await page.getByTestId('swap-btn-opp').click();

  // SpeciesPicker keeps its query state across opens (it's always mounted),
  // so the search box may still hold "Clefable" from the swap. Recent header
  // only renders when the query is empty - clear it first.
  const shell = page.getByTestId('picker-shell');
  await shell.getByPlaceholder('Search Pokémon').fill('');

  // The "Recent" header is rendered before "All".
  await expect(shell.getByText('Recent', { exact: true })).toBeVisible();
  // Both recent species are rows in the picker.
  await expect(shell.getByRole('button', { name: /^Skarmory$/ }).first()).toBeVisible();
  await expect(shell.getByRole('button', { name: /^Clefable$/ }).first()).toBeVisible();
});

// The previous "useCount increments" e2e test surfaced from the Teams-page
// Recent Opponents block. That block was removed in favour of the
// Browse-meta-teams section; useCount increment semantics still have
// store-level coverage in store/index.test.ts.
