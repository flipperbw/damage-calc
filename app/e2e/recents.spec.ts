import { test, expect } from '@playwright/test';
import {
  freshStart, nav, createTeam, addMonToFirstSlot, activateTeam, pickOpponent,
  swapOpponent,
} from './helpers';

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

  // Re-open the picker by tapping the opponent card.
  await page.getByTestId('swap-opp').click();

  // SpeciesPicker keeps its query state across opens (it's always mounted),
  // so the search box may still hold "Clefable" from the swap. Recent header
  // only renders when the query is empty — clear it first.
  const shell = page.getByTestId('picker-shell');
  await shell.getByPlaceholder('Search Pokémon').fill('');

  // The "Recent" header is rendered before "All".
  await expect(shell.getByText('Recent', { exact: true })).toBeVisible();
  // Both recent species are rows in the picker.
  await expect(shell.getByRole('button', { name: /^Skarmory$/ }).first()).toBeVisible();
  await expect(shell.getByRole('button', { name: /^Clefable$/ }).first()).toBeVisible();
});

test('useCount increments on species change, not on HP edit', async ({ page }) => {
  await pickOpponent(page, 'Skarmory');

  // Tweak HP — should NOT increment useCount.
  const oppHpSlider = page.locator('[data-testid="swap-opp"] input[aria-label="HP"]');
  await oppHpSlider.evaluate((el: HTMLInputElement) => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )!.set!;
    setter.call(el, '1');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });

  await nav(page, 'Teams');
  await expect(
    page.getByTestId('recent-Skarmory'),
  ).toHaveAttribute('data-use-count', '1');

  // Swap to Clefable, then back to Skarmory — useCount should bump to 2.
  await nav(page, 'Battle');
  await swapOpponent(page, 'Clefable');
  await swapOpponent(page, 'Skarmory');

  await nav(page, 'Teams');
  await expect(
    page.getByTestId('recent-Skarmory'),
  ).toHaveAttribute('data-use-count', '2');
});
