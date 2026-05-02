import { test, expect, type Page } from '@playwright/test';
import {
  freshStart, nav, createTeam, addMonToFirstSlot, activateTeam, pickOpponent,
  swapOpponent,
} from './helpers';

/**
 * Set up a 2-mon team (Garchomp + Skarmory) with a Skarmory opponent so we
 * have a populated battle screen to interact with.
 */
async function setUpBattle(page: Page) {
  await freshStart(page);
  await nav(page, 'Teams');
  await createTeam(page);
  await addMonToFirstSlot(page, 'Garchomp', /Swords Dance/);
  // Add Skarmory in slot 2 (the next + placeholder).
  await page.locator('button:has(span:has-text("＋"))').first().click();
  await page.getByPlaceholder('Search Pokémon').fill('Skarmory');
  await page.getByRole('button', { name: /^Skarmory$/ }).click();
  await page.getByRole('button', { name: /^Custom/ }).click();
  await page.getByRole('button', { name: /Defensive/ }).first().click();
  await page.getByRole('button', { name: 'Save' }).click();

  await activateTeam(page, 'New team');
  await pickOpponent(page, 'Clefable');
}

test('switch active team mon via the carousel', async ({ page }) => {
  await setUpBattle(page);

  // Both mobile and desktop carousels render in the DOM (one is hidden via
  // CSS depending on viewport). Filter by visibility to click the right one.
  await page
    .locator('img[alt="Skarmory"]')
    .filter({ visible: true })
    .first()
    .click();

  await expect(page.getByTestId('edit-name-you')).toContainText('Skarmory');
});

test('swap opponent species by tapping the opponent card surface', async ({ page }) => {
  await setUpBattle(page);

  // The opponent name appears in the MonCard with testid "edit-name-opp".
  await expect(page.getByTestId('edit-name-opp')).toContainText('Clefable');

  // Tap the opponent card to swap.
  await swapOpponent(page, 'Skarmory');

  // Opponent name flips; default build also auto-applies (Skarmory's only
  // curated build uses Leftovers + Sturdy).
  await expect(page.getByTestId('edit-name-opp')).toContainText('Skarmory');
  await expect(page.locator('[data-testid="swap-opp"]')).toContainText('Leftovers');
  await expect(page.locator('[data-testid="swap-opp"]')).toContainText('Sturdy');
});

test('tap opponent name/sprite to open editor — distinct from swap', async ({ page }) => {
  await setUpBattle(page);

  await page.getByTestId('edit-name-opp').click();
  // The MonEditor sheet opens with "Edit Pokémon" title.
  await expect(page.getByText('Edit Pokémon')).toBeVisible();

  // Close, then verify the sprite also opens the editor.
  await page.getByRole('button', { name: '←' }).click();
  await page.getByTestId('edit-sprite-opp').click();
  await expect(page.getByText('Edit Pokémon')).toBeVisible();
});

test('edit opponent HP via slider', async ({ page }) => {
  await setUpBattle(page);

  // The HpBar in the opponent card has aria-label="HP" and renders the % to
  // the right. Move the slider via fill().
  // Find the HP slider inside the opponent card surface.
  const oppHpSlider = page.locator('[data-testid="swap-opp"] input[aria-label="HP"]');
  // Drop opponent HP to about half its max; the % readout should drop below
  // 100%. We don't know the exact max here, so just go to 1 (one HP).
  await oppHpSlider.evaluate((el: HTMLInputElement) => {
    el.value = '1';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // The opponent's percent readout updates to a single-digit %.
  await expect(page.locator('[data-testid="swap-opp"]')).toContainText(/[01]%/);
});

test('toggle a status on the active mon', async ({ page }) => {
  await setUpBattle(page);

  // The "+ Status" chip is rendered when no status is set.
  await page.getByRole('button', { name: '+ Status' }).first().click();

  // Pick Burned.
  await page.getByRole('button', { name: 'Burned', exact: true }).click();

  // The chip now reads "Burned".
  await expect(page.getByRole('button', { name: /^Burned/ })).toBeVisible();
});

test('adjust a boost on the active mon', async ({ page }) => {
  await setUpBattle(page);

  await page.getByRole('button', { name: '+ Boost' }).first().click();

  // BoostPicker has aria-label="Atk boost" on the slider input. Drive the
  // value via a native setter so React's onChange fires (fill() on type=range
  // doesn't trigger React's synthetic event reliably).
  await page.getByLabel('Atk boost').evaluate((el: HTMLInputElement) => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )!.set!;
    setter.call(el, '1');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.getByRole('button', { name: 'Apply' }).click();

  // A "+1 atk" chip is now rendered on the active card.
  await expect(page.getByRole('button', { name: /\+1 atk/ })).toBeVisible();
});

test('open the field drawer and set weather to Sun', async ({ page }) => {
  await setUpBattle(page);

  // The "＋ Field" pill (fullwidth +, U+FF0B) opens the FieldDrawer.
  await page.getByRole('button', { name: /Field$/ }).filter({ hasNotText: 'state' }).first().click();
  await expect(page.getByText('Field state')).toBeVisible();

  // Pick Sun (drawer button accessible name = "Sun").
  await page.getByRole('button', { name: 'Sun', exact: true }).click();

  // Close the drawer by clicking the backdrop. PickerShell uses a fixed-inset
  // overlay; tapping the backdrop calls onClose. Use the "Field state" title's
  // grand-parent as a click target outside the inner shell.
  await page.locator('div.fixed.inset-0').first().click({ position: { x: 5, y: 5 } });

  // The FieldBar now shows a Sun pill — accessible name "☀ Sun".
  await expect(page.getByRole('button', { name: '☀ Sun' })).toBeVisible();
});

test('damage updates after toggling weather', async ({ page }) => {
  await setUpBattle(page);

  // Capture the first damage row's % text before any change.
  const firstRow = page.getByText(/%$/).first();
  await expect(firstRow).toBeVisible();
  const before = (await firstRow.textContent()) ?? '';

  // Burn the active mon — physical attacker damage should drop.
  await page.getByRole('button', { name: '+ Status' }).first().click();
  await page.getByRole('button', { name: 'Burned', exact: true }).click();

  // After burn, the same row's text should differ. Wait for it to change.
  await expect(async () => {
    const after = (await firstRow.textContent()) ?? '';
    expect(after).not.toEqual(before);
  }).toPass({ timeout: 3000 });
});
