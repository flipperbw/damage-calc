import { expect, test, type Page } from '@playwright/test';

import { activateTeam, addMonToFirstSlot, createTeam, freshStart, nav, pickOpponent } from './helpers';

/** Add a second mon (by species + build) to the next empty slot on the team. */
async function addSecondMon(page: Page, species: string, build: RegExp) {
  await page.getByTestId('team-slot-empty-1').first().click();
  const shell = page.getByTestId('picker-shell');
  await shell.getByPlaceholder('Search Pokémon').fill(species);
  await shell
    .getByRole('button', { name: new RegExp(`^${species}$`) })
    .first()
    .click();
  await page.getByTestId('build-trigger').click();
  await page.getByRole('button', { name: build }).first().click();
  await page.getByRole('button', { name: 'Save' }).click();
}

test('reorder team mons with the up/down arrows', async ({ page }) => {
  await freshStart(page);
  await nav(page, 'Teams');
  await createTeam(page);
  await addMonToFirstSlot(page, 'Garchomp', /Swords Dance/);
  await addSecondMon(page, 'Skarmory', /Defensive/);

  // The active team card is expanded, showing both TeamMonCards with reorder
  // arrows. Garchomp is first (its up arrow is disabled), Skarmory last (its
  // down arrow disabled).
  await expect(page.getByRole('button', { name: 'Move Garchomp up', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Move Skarmory down', exact: true })).toBeDisabled();

  // Move Garchomp down one slot -> order becomes Skarmory, Garchomp.
  await page.getByRole('button', { name: 'Move Garchomp down', exact: true }).click();

  // Now Skarmory is at the top (up disabled) and Garchomp at the bottom
  // (down disabled) - the inverse of the starting state.
  await expect(page.getByRole('button', { name: 'Move Skarmory up', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Move Garchomp down', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Move Garchomp up', exact: true })).toBeEnabled();
});

test('reset battle clears both sides and the field', async ({ page }) => {
  await freshStart(page);
  await nav(page, 'Teams');
  await createTeam(page);
  await addMonToFirstSlot(page, 'Garchomp', /Swords Dance/);
  await activateTeam(page, 'New team');
  // Swampert holds a mega stone (its default set is Mega), so the opponent
  // card exposes a mega toggle we can assert on.
  await pickOpponent(page, 'Swampert');

  // Tweak both sides + the field: raise your Atk boost, drop the opponent to
  // 1 HP, set weather to Rain (a top-level field key, not a side effect), and
  // make sure the opponent is mega.
  await page.getByRole('button', { name: 'Raise Atk boost' }).first().click();
  await expect(page.getByTestId('boost-stage-you-atk')).toHaveText('+1');

  const oppHpSlider = page.locator('[data-testid="swap-opp"] input[aria-label="HP"]');
  await oppHpSlider.evaluate((el: HTMLInputElement) => {
    el.value = '1';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.locator('[data-testid="swap-opp"]')).toContainText(/[01]%/);

  await page.getByTestId('field-toggle').click();
  await page.getByRole('button', { name: 'Rain', exact: true }).click();
  await page.locator('div.fixed.inset-0').first().click({ position: { x: 5, y: 5 } });
  await expect(page.getByTestId('field-toggle')).toContainText(/Rain/);

  const oppMega = page.locator('[data-testid="swap-opp"] [data-testid="mega-toggle"]');
  await expect(oppMega).toBeVisible();
  if ((await oppMega.getAttribute('aria-pressed')) !== 'true') await oppMega.click();
  await expect(oppMega).toHaveAttribute('aria-pressed', 'true');

  // Reset the whole battle.
  await page.getByTestId('reset-battle').click();

  // Your boost is back to neutral, the opponent is at full HP, weather is
  // cleared (Rain gone from the field bar), and the opponent is no longer mega.
  await expect(page.getByTestId('boost-stage-you-atk')).not.toHaveText('+1');
  await expect(oppHpSlider).toHaveJSProperty('value', await oppHpSlider.getAttribute('max'));
  await expect(page.getByTestId('field-toggle')).not.toContainText(/Rain/);
  await expect(oppMega).toHaveAttribute('aria-pressed', 'false');
});

test('reset battle also clears benched (non-active) team mons', async ({ page }) => {
  await freshStart(page);
  await nav(page, 'Teams');
  await createTeam(page);
  await addMonToFirstSlot(page, 'Garchomp', /Swords Dance/);
  await addSecondMon(page, 'Skarmory', /Defensive/);
  await activateTeam(page, 'New team');
  await pickOpponent(page, 'Swampert');

  // Boost the active mon (Garchomp, slot 0).
  await page.getByRole('button', { name: 'Raise Atk boost' }).first().click();
  await expect(page.getByTestId('boost-stage-you-atk')).toHaveText('+1');

  // Switch to the benched mon (Skarmory, slot 1) and boost it too. This state
  // lives on the benched mon, which the old reset left untouched.
  await page.getByTestId('carousel-slot-1').click();
  await page.getByRole('button', { name: 'Raise Atk boost' }).first().click();
  await expect(page.getByTestId('boost-stage-you-atk')).toHaveText('+1');

  // Reset from the benched mon's view: it clears immediately.
  await page.getByTestId('reset-battle').click();
  await expect(page.getByTestId('boost-stage-you-atk')).not.toHaveText('+1');

  // The originally-active mon (slot 0) must be clear too - the bug was that
  // only the currently-selected mon got reset.
  await page.getByTestId('carousel-slot-0').click();
  await expect(page.getByTestId('boost-stage-you-atk')).not.toHaveText('+1');
});

test('battle-state move stepper raises the damage readout', async ({ page }) => {
  await freshStart(page);
  await nav(page, 'Teams');
  await createTeam(page);
  await addMonToFirstSlot(page, 'Garchomp', /Swords Dance/);
  await activateTeam(page, 'New team');
  // Annihilape's default set carries Rage Fist, whose base power scales with
  // the times-hit counter. It sits in the opponent (defender) move list.
  await pickOpponent(page, 'Annihilape');

  const rageRow = page.getByTestId('move-row-Rage Fist');
  await expect(rageRow).toBeVisible();

  // The counter starts at 0 (flat 50 BP). Capture the damage %, then step it up.
  const before = (await rageRow.textContent()) ?? '';
  await expect(page.getByTestId('move-state-value-Rage Fist')).toHaveText('0');

  const inc = page.getByTestId('move-state-inc-Rage Fist');
  for (let i = 0; i < 6; i++) await inc.click();
  await expect(page.getByTestId('move-state-value-Rage Fist')).toHaveText('6');

  // At 6 hits BP is 350 (vs 50), so the damage % must have gone up.
  await expect(rageRow).not.toHaveText(before);
  const pct = (s: string) => Number((s.match(/(\d+)–\d+%/) ?? [])[1] ?? 0);
  const after = (await rageRow.textContent()) ?? '';
  expect(pct(after)).toBeGreaterThan(pct(before));
});
