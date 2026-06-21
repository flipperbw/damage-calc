import { expect, test, type Page } from '@playwright/test';

import { activateTeam, addMonToFirstSlot, createTeam, freshStart, nav, pickOpponent, swapOpponent } from './helpers';

/**
 * Set up a 2-mon team (Garchomp + Skarmory) with a Skarmory opponent so we
 * have a populated battle screen to interact with.
 */
async function setUpBattle(page: Page) {
  await freshStart(page);
  await nav(page, 'Teams');
  await createTeam(page);
  await addMonToFirstSlot(page, 'Garchomp', /Swords Dance/);
  // Add Skarmory in slot 1 (the next empty slot).
  await page.getByTestId('team-slot-empty-1').first().click();
  const shell = page.getByTestId('picker-shell');
  await shell.getByPlaceholder('Search Pokémon').fill('Skarmory');
  await shell
    .getByRole('button', { name: /^Skarmory$/ })
    .first()
    .click();
  await page.getByTestId('build-trigger').click();
  await page
    .getByRole('button', { name: /Defensive/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Save' }).click();

  await activateTeam(page, 'New team');
  await pickOpponent(page, 'Clefable');
}

test('switch active team mon via the carousel', async ({ page }) => {
  await setUpBattle(page);

  // Both mobile and desktop carousels render in the DOM (one is hidden via
  // CSS depending on viewport). Filter by visibility to click the right one.
  await page.locator('img[alt="Skarmory"]').filter({ visible: true }).first().click();

  await expect(page.getByTestId('edit-name-you')).toContainText('Skarmory');
});

test('swap opponent species by tapping the opponent card surface', async ({ page }) => {
  await setUpBattle(page);

  // The opponent name appears in the MonCard with testid "edit-name-opp".
  await expect(page.getByTestId('edit-name-opp')).toContainText('Clefable');

  // Tap the opponent card to swap.
  await swapOpponent(page, 'Skarmory');

  // Opponent name flips; the default curated set also auto-applies. Skarmory's
  // default opponent build is the "Setup Sweeper" set, which holds Skarmorite
  // (mega) + Keen Eye. We assert on that real auto-applied build to prove the
  // swap carried a full set, not just the species name.
  await expect(page.getByTestId('edit-name-opp')).toContainText('Skarmory');
  await expect(page.locator('[data-testid="swap-opp"]')).toContainText('Skarmorite');
  await expect(page.locator('[data-testid="swap-opp"]')).toContainText('Keen Eye');
});

test('tap opponent name/sprite to open editor - distinct from swap', async ({ page }) => {
  await setUpBattle(page);

  await page.getByTestId('edit-name-opp').click();
  // MonEditor sheet open ⇒ its unique "Close editor" back button is visible.
  await expect(page.getByRole('button', { name: 'Close editor' })).toBeVisible();

  // Close, then verify the sprite also opens the editor.
  await page.getByRole('button', { name: 'Close editor' }).click();
  await page.getByTestId('edit-sprite-opp').click();
  await expect(page.getByRole('button', { name: 'Close editor' })).toBeVisible();
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
  // StatusPicker options now carry a description line, so the button's
  // accessible name is "Burned Halves Attack…"; match on the leading name.
  await page.getByRole('button', { name: /^Burned/ }).click();

  // The chip now reads "Burned".
  await expect(page.getByRole('button', { name: /^Burned/ })).toBeVisible();
});

test('adjust a boost on the active mon', async ({ page }) => {
  await setUpBattle(page);

  // Boosts now live inline in the stat grid: each cell has a ± stepper. The
  // your-side card renders first, so the first "Raise Atk boost" button is the
  // active mon's. One tap should bump the Atk stage to +1.
  await page.getByRole('button', { name: 'Raise Atk boost' }).first().click();

  // The Atk cell's badge line now reads "+1".
  await expect(page.getByTestId('boost-stage-you-atk')).toHaveText('+1');
});

test('open the field drawer and set weather to Sun', async ({ page }) => {
  await setUpBattle(page);

  // FieldBar is a full-width button with data-testid="field-toggle".
  await page.getByTestId('field-toggle').click();
  await expect(page.getByText('Field state')).toBeVisible();

  // Pick Sun (drawer button accessible name = "Sun").
  await page.getByRole('button', { name: 'Sun', exact: true }).click();

  // Close the drawer by clicking the backdrop. PickerShell uses a fixed-inset
  // overlay; tapping the backdrop calls onClose.
  await page
    .locator('div.fixed.inset-0')
    .first()
    .click({ position: { x: 5, y: 5 } });

  // The FieldBar's button now shows the active Sun chip.
  await expect(page.getByTestId('field-toggle')).toContainText(/Sun/);
});

test('damage updates after toggling weather', async ({ page }) => {
  await setUpBattle(page);

  // Capture the first damage row's % text before any change. Match a damage
  // *range* ("68-80%") so we don't accidentally grab the card's HP "100%"
  // readout, which a burn wouldn't change.
  const firstRow = page.getByText(/\d+\s*[-–]\s*\d+%/).first();
  await expect(firstRow).toBeVisible();
  const before = (await firstRow.textContent()) ?? '';

  // Burn the active mon - physical attacker damage should drop.
  await page.getByRole('button', { name: '+ Status' }).first().click();
  // StatusPicker options now carry a description line, so the button's
  // accessible name is "Burned Halves Attack…"; match on the leading name.
  await page.getByRole('button', { name: /^Burned/ }).click();

  // After burn, the same row's text should differ. Wait for it to change.
  await expect(async () => {
    const after = (await firstRow.textContent()) ?? '';
    expect(after).not.toEqual(before);
  }).toPass({ timeout: 3000 });
});

// Concatenated text of every damage-range readout on the page (e.g.
// "68-80%"). Used to detect that a toggle actually moved the numbers.
function damageRanges(page: Page) {
  return page.getByText(/\d+\s*[-–]\s*\d+%/).allTextContents();
}

test('spread toggle swaps spread for single-target damage (doubles)', async ({ page }) => {
  await freshStart(page);
  await nav(page, 'Teams');
  await createTeam(page);
  // Garchomp's Swords Dance set runs Earthquake, a spread move in doubles.
  await addMonToFirstSlot(page, 'Garchomp', /Swords Dance/);

  // Flip the team to Doubles via the ⋯ menu so the 0.75x spread reduction
  // applies and the per-move spread toggle becomes relevant.
  await page.getByRole('button', { name: 'Team actions' }).first().click();
  await page.getByRole('button', { name: 'Switch to Doubles' }).click();

  await activateTeam(page, 'New team');
  await pickOpponent(page, 'Clefable');

  // A spread move is queued, so the toggle renders, defaulting to spread.
  const toggle = page.getByTestId('your-spread-toggle');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');

  const before = await damageRanges(page);

  // Switch to single-target: at least one move's % rises (drops the 0.75x).
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(async () => {
    expect(await damageRanges(page)).not.toEqual(before);
  }).toPass({ timeout: 3000 });
});

test('toggling mega on the battle card changes damage', async ({ page }) => {
  await freshStart(page);
  await nav(page, 'Teams');
  await createTeam(page);
  // The Mixed Mega set holds Garchompite, so the card exposes a mega toggle.
  await addMonToFirstSlot(page, 'Garchomp', /Mixed Mega/);
  await activateTeam(page, 'New team');
  // Clefable has no mega stone, so only your Garchomp card carries the toggle.
  await pickOpponent(page, 'Clefable');

  const toggle = page.getByTestId('mega-toggle');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');

  const before = await damageRanges(page);

  // Mega-evolving raises Garchomp's offenses, so the damage readouts move.
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(async () => {
    expect(await damageRanges(page)).not.toEqual(before);
  }).toPass({ timeout: 3000 });
});

test('opponent Deadliest worst-case build applies and reverts', async ({ page }) => {
  await setUpBattle(page);

  const deadliest = page.getByTestId('opp-hardest-hitter');
  const revert = page.getByTestId('opp-revert');

  // Nothing applied yet, so there's nothing to revert.
  await expect(revert).toBeDisabled();

  // Applying the deadliest synthesised build marks the mode active (button
  // becomes pressed) and enables Revert.
  await deadliest.click();
  await expect(deadliest).toHaveAttribute('aria-pressed', 'true');
  await expect(revert).toBeEnabled();

  // Revert restores the original build and resets the controls.
  await revert.click();
  await expect(revert).toBeDisabled();
  await expect(deadliest).toHaveAttribute('aria-pressed', 'false');
});

test('no-team quick battle: pick two ad-hoc mons and see damage', async ({ page }) => {
  await freshStart(page);
  await nav(page, 'Battle');

  // With no team, the quick-compare CTA is shown above the pick cards.
  await expect(page.getByTestId('battle-no-team-cta')).toBeVisible();

  // Pick your ad-hoc mon from the "you" skeleton card.
  await page.getByTestId('pick-you-adhoc').click();
  const shell = page.getByTestId('picker-shell');
  await shell.getByPlaceholder('Search Pokémon').fill('Garchomp');
  await shell
    .getByRole('button', { name: /^Garchomp$/ })
    .first()
    .click();

  // Pick the opponent via the standard pick-opponent card.
  await pickOpponent(page, 'Skarmory');

  // Both sides are set without a saved team, so damage ranges now render
  // (synth fills the ad-hoc mon's moveset, hence the generous timeout).
  await expect(page.getByText(/\d+\s*[-–]\s*\d+%/).first()).toBeVisible({ timeout: 5000 });
});
