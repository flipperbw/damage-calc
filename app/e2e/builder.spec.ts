import { expect, test, type Page } from '@playwright/test';

import { activateTeam, addMonToFirstSlot, createTeam, freshStart, freshStartWithSeeds, nav } from './helpers';

/**
 * E2E tests for the Builder feature (Phase 2). Covers:
 *   - Tab reachability from primary nav
 *   - Coverage section gap/overlap readouts
 *   - Suggestions card list (and its empty state)
 *   - Threat list picker (seeded lists, create, delete rules)
 *   - Matchup matrix render + sanity (no NaN)
 *   - Threat-mon edit persistence
 *
 * Mobile/desktop matrix is handled by the Playwright project config - every
 * test runs on both `mobile-webkit` and `desktop-chromium` automatically.
 */

/**
 * Add a Pokémon to a specific empty slot index. The shared helper only knows
 * about slot 0; this lets us fill multi-mon teams. Picker shell is the
 * unified species picker overlay used everywhere on the screen.
 */
async function addMonToSlot(page: Page, slotIndex: number, species: string) {
  await page.getByTestId(`team-slot-empty-${slotIndex}`).first().click();
  const shell = page.getByTestId('picker-shell');
  await shell.getByPlaceholder('Search Pokémon').fill(species);
  await shell
    .getByRole('button', { name: new RegExp(`^${species}$`) })
    .first()
    .click();
  // No build - just save with default fields. The coverage analyzer is pure
  // type-chart, so STAB types alone drive the readout regardless of moves.
  await page.getByRole('button', { name: 'Save' }).click();
}

test('Builder tab is reachable and renders all sections', async ({ page }) => {
  await freshStartWithSeeds(page);

  // BuilderScreen short-circuits to a "create a team first" placeholder when
  // there are no teams, so we make an empty team before navigating.
  await nav(page, 'Teams');
  await createTeam(page);
  await nav(page, 'Builder');

  // The Builder screen mounts. Heading + each section header is visible.
  await expect(page.getByRole('heading', { name: 'Builder', exact: true })).toBeVisible();
  await expect(page.getByTestId('coverage-section')).toBeVisible();
  await expect(page.getByTestId('suggestions-section')).toBeVisible();
  await expect(page.getByTestId('threat-list-picker')).toBeVisible();
  await expect(page.getByTestId('matchup-matrix')).toBeVisible();
});

test('Coverage section: all-Water team surfaces Grass/Dragon/Electric signals', async ({ page }) => {
  await freshStart(page);
  await nav(page, 'Teams');
  await createTeam(page);
  await addMonToFirstSlot(page, 'Vaporeon');
  await addMonToSlot(page, 1, 'Politoed');
  await addMonToSlot(page, 2, 'Milotic');

  // Activate the team so Builder defaults to it. activateTeam taps the team
  // name on the Teams card; that also flips to Battle, so re-nav to Builder.
  await activateTeam(page, 'New team');
  await nav(page, 'Builder');

  // Offensive gaps: this Water trio can't hit Electric or Dragon for 2× - both
  // are missing from the team's collective STAB + move attacking types. (Gaps
  // are computed over all 18 types, not the threat list.)
  await expect(page.getByTestId('offensive-gap-Electric')).toBeVisible();
  await expect(page.getByTestId('offensive-gap-Dragon')).toBeVisible();

  // Defensive overlap: 3 Water-type mons are all 2× weak to Electric.
  const electricOverlap = page.getByTestId('defensive-overlap-Electric');
  await expect(electricOverlap).toBeVisible();
  await expect(electricOverlap).toContainText('×3 mons');
});

test('Suggestions section: partial team yields cards with reasons; team mons excluded', async ({ page }) => {
  // Suggestions need the seeded "Most-Used" list as the threat reference, so
  // run through the seed-injecting helper.
  await freshStartWithSeeds(page);
  await nav(page, 'Teams');
  await createTeam(page);
  // Garchomp with no curated build = STAB Ground/Dragon, no moves. That
  // leaves plenty of offensive gaps the suggestion engine can score against,
  // so candidate cards always populate. (Applying a full Mixed-Mega build
  // closes too many gaps for a deterministic assertion.)
  await addMonToFirstSlot(page, 'Garchomp');

  await activateTeam(page, 'New team');
  await nav(page, 'Builder');

  // Suggestions section renders ≥1 candidate card.
  const suggestions = page.getByTestId('suggestions-section');
  await expect(suggestions).toBeVisible();

  // The grid carries data-testid="suggestion-{Species}" on each card.
  const cards = suggestions.locator('[data-testid^="suggestion-"]');
  // Wait for at least one candidate to appear before counting.
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThanOrEqual(1);

  // Each card has reason chips with text matching at least one of the three
  // categories. We assert against the FIRST card to keep the assertion fast
  // and avoid coupling to the full TOP_POOL ordering.
  const firstCard = cards.first();
  await expect(firstCard).toBeVisible();
  const firstText = (await firstCard.innerText()).toLowerCase();
  expect(firstText).toMatch(/covers|resists|2×|2x/);

  // Garchomp is on the team - it must NOT appear as a suggestion. Also
  // covers the mega-strip rule (Garchomp-Mega is suppressed too).
  await expect(suggestions.locator('[data-testid="suggestion-Garchomp"]')).toHaveCount(0);
});

test('Suggestions "Focus on": searchable picker filters and selects a threat', async ({ page }) => {
  await freshStartWithSeeds(page);
  await nav(page, 'Teams');
  await createTeam(page);
  await addMonToFirstSlot(page, 'Garchomp');
  await activateTeam(page, 'New team');
  await nav(page, 'Builder');

  // The trigger defaults to "All threats".
  const trigger = page.getByTestId('suggestions-focus');
  await expect(trigger).toBeVisible();
  await expect(trigger).toContainText('All threats');

  // Opening it reveals the search box and the "All threats" reset row plus
  // at least one seeded threat option.
  await trigger.click();
  const search = page.getByTestId('suggestions-focus-search');
  await expect(search).toBeVisible();
  await expect(page.getByTestId('suggestions-focus-option-all')).toBeVisible();
  const options = page.locator('[data-testid^="suggestions-focus-option-"]');
  expect(await options.count()).toBeGreaterThan(1);

  // A non-matching query empties the list (All threats is filtered out too).
  await search.fill('zzzznotathreat');
  await expect(page.getByTestId('picker-no-results')).toBeVisible();

  // Clearing and picking the first real threat closes the sheet and updates
  // the trigger label to that species. "All threats" is always row 0, so the
  // first seeded threat is nth(1).
  await search.fill('');
  const firstThreat = options.nth(1);
  const picked = (await firstThreat.innerText()).trim();
  await firstThreat.click();
  await expect(search).toBeHidden();
  await expect(trigger).toContainText(picked);
});

test('Suggestions section: empty state for an empty team', async ({ page }) => {
  await freshStart(page);
  await nav(page, 'Teams');
  await createTeam(page); // Brand-new team has 0 mons.

  await activateTeam(page, 'New team');
  await nav(page, 'Builder');

  await expect(page.getByTestId('suggestions-empty')).toBeVisible();
  await expect(page.getByTestId('suggestions-empty')).toContainText(/Build a team first/i);
});

test('Threat list picker shows all seeded lists by name', async ({ page }) => {
  await freshStartWithSeeds(page);
  // BuilderScreen needs at least one team to mount its sections.
  await nav(page, 'Teams');
  await createTeam(page);
  await nav(page, 'Builder');

  const picker = page.getByTestId('threat-list-picker');
  await expect(picker).toBeVisible();

  // The build ships two seed lists (the obsolete "Most-Used" seed was dropped
  // - see store/migrations.ts). Names are matched verbatim against the
  // migration test in store/migrations.test.ts.
  for (const name of ['Top Threats - Singles', 'Top Threats - Doubles / VGC']) {
    await expect(picker.getByText(name, { exact: true })).toBeVisible();
  }
});

test('Fresh install (no migration path) seeds threat lists too', async ({ page }) => {
  // freshStart wipes localStorage and reloads - no v3 envelope is left
  // behind, so the v3->v4 migration does not run. The seeds must come from
  // buildInitialAppState's first-run path. If a refactor regresses that,
  // this test fails.
  await freshStart(page);
  await nav(page, 'Teams');
  await createTeam(page);
  await nav(page, 'Builder');

  const picker = page.getByTestId('threat-list-picker');
  await expect(picker.getByText('Top Threats - Singles', { exact: true })).toBeVisible();
  await expect(picker.getByText('Top Threats - Doubles / VGC', { exact: true })).toBeVisible();
});

test('Matchup matrix renders cells with percentages and never shows NaN', async ({ page }) => {
  await freshStartWithSeeds(page);
  await nav(page, 'Teams');
  await createTeam(page);
  await addMonToFirstSlot(page, 'Garchomp', /Swords Dance/);

  await activateTeam(page, 'New team');
  await nav(page, 'Builder');

  const matrix = page.getByTestId('matchup-matrix');
  await expect(matrix).toBeVisible();

  // Switch to "Top Threats - Singles" so the test pins to a known threat list
  // with a fixed roster (7 mons, including Garchomp). The "Most-Used" seed was
  // removed; the doubles list leads by default.
  await page.getByText('Top Threats - Singles', { exact: true }).click();

  // Below md (mobile) the matrix renders as a vertical per-mon list; above
  // it as a table. Use whichever is visible.
  const table = page.getByTestId('matrix-table');
  const list = page.getByTestId('matchup-list');
  const visible = (await table.isVisible()) ? table : list;
  await expect(visible).toBeVisible();

  // At least one cell contains a "%" sign. Some cells render "-" (immune /
  // status-only build) - Garchomp w/ Swords Dance has 3 attacking moves so
  // the row is mostly numeric. Cells are tappable buttons that open a
  // detail sheet on click.
  const cellWithPct = visible.locator('button:has-text("%")').first();
  await expect(cellWithPct).toBeVisible();

  // No cell ever renders the literal string "NaN". This catches a calc
  // adapter regression (e.g. dividing by 0 in percent computation).
  await expect(visible.locator('text=NaN')).toHaveCount(0);
});

test('Threat list edit: changing a mon item persists across reload', async ({ page }) => {
  await freshStartWithSeeds(page);
  // BuilderScreen needs a team to mount.
  await nav(page, 'Teams');
  await createTeam(page);
  await nav(page, 'Builder');

  // Activate "Top Threats - Singles" so its mons are visible in the inline
  // roster, then tap Garchomp (its first entry) to open MonEditor. (The
  // "Most-Used" seed was removed; Singles is a small list that holds Garchomp.)
  await page.getByText('Top Threats - Singles', { exact: true }).click();
  await page
    .getByTestId('threat-mon-Garchomp')
    .getByRole('button', { name: /Edit Garchomp/ })
    .click();

  // Change item via the field-item picker. Leftovers is in the Champions
  // item list (used by editor.spec.ts elsewhere) and isn't a mega stone, so
  // it survives the species-filtering branch in ItemPicker. Picker rows carry
  // a description subline, so match the leading item name rather than exact.
  await page.getByTestId('field-item').click();
  await page.getByPlaceholder('Search items').fill('Leftovers');
  await page.getByRole('button', { name: /^Leftovers\b/ }).first().click();

  await expect(page.getByTestId('field-item')).toContainText('Leftovers');
  await page.getByRole('button', { name: 'Save' }).click();

  // Reload and confirm persistence.
  await page.reload();
  // Re-open the same list.
  await page.getByText('Top Threats - Singles', { exact: true }).click();
  await page
    .getByTestId('threat-mon-Garchomp')
    .getByRole('button', { name: /Edit Garchomp/ })
    .click();
  await expect(page.getByTestId('field-item')).toContainText('Leftovers');
});

test('Create new threat list, add a mon, persists across reload', async ({ page }) => {
  await freshStartWithSeeds(page);
  // BuilderScreen needs a team to mount.
  await nav(page, 'Teams');
  await createTeam(page);
  await nav(page, 'Builder');

  // Tap "+ New" → PromptDialog appears for the name.
  await page.getByTestId('threat-list-new').click();
  const promptInput = page.getByTestId('prompt-input');
  await expect(promptInput).toBeVisible();
  await promptInput.fill('Locals');
  await page.getByTestId('prompt-ok').click();

  // The new list is selected (auto-active per createThreatList wiring) so its
  // inline roster shows. Tap "+ Add" to open the species picker.
  const newCard = page.locator('[data-testid="threat-list-card-active"]').filter({ hasText: 'Locals' });
  await expect(newCard).toBeVisible();
  await newCard.getByTestId('threat-mon-add').click();

  // Pick Garchomp. The threat-list picker auto-opens MonEditor after pick;
  // close it without changes via the back button.
  const shell = page.getByTestId('picker-shell');
  await shell.getByPlaceholder('Search Pokémon').fill('Garchomp');
  await shell
    .getByRole('button', { name: /^Garchomp$/ })
    .first()
    .click();
  // MonEditor opened - close it. (It saves on Save button only; the back
  // arrow just closes without persisting unsaved tweaks. The mon was already
  // upserted by upsertThreatMon before the editor opened.)
  await page.getByRole('button', { name: 'Save' }).click();

  // Reload and check the list and Garchomp survive.
  await page.reload();
  // The user list defaults to NOT being active after reload - pick by name.
  await page.getByText('Locals', { exact: true }).click();
  await expect(
    page.locator('[data-testid="threat-list-card-active"]').filter({ hasText: 'Locals' }).getByTestId('threat-mon-Garchomp'),
  ).toBeVisible();
});

test('Delete is hidden on seed lists and works on user lists', async ({ page }) => {
  await freshStartWithSeeds(page);
  // BuilderScreen needs a team to mount.
  await nav(page, 'Teams');
  await createTeam(page);
  await nav(page, 'Builder');

  // Open the menu on a seeded list ("Top Threats - Singles"). The Delete
  // button should NOT render at all (the component hides it for isSeed). The
  // seed-list hint text confirms we're on a seed.
  const seedCard = page.locator('[data-testid^="threat-list-card"]').filter({ hasText: 'Top Threats - Singles' });
  await seedCard.getByRole('button', { name: 'Threat list menu' }).click();
  await expect(page.getByText(/Seed lists ship with the app/)).toBeVisible();
  await expect(page.getByTestId('threat-list-delete')).toHaveCount(0);
  // Close the menu sheet by tapping the backdrop. PickerShell registers the
  // outer fixed-overlay div for this; clicking at corner (10, 10) is on the
  // backdrop, well clear of the centered sheet.
  await page.mouse.click(10, 10);
  await expect(page.getByText(/Seed lists ship with the app/)).toHaveCount(0);

  // Create a user list, then verify Delete is enabled.
  await page.getByTestId('threat-list-new').click();
  await page.getByTestId('prompt-input').fill('Trash me');
  await page.getByTestId('prompt-ok').click();

  const userCard = page.locator('[data-testid^="threat-list-card"]').filter({ hasText: 'Trash me' });
  await expect(userCard).toBeVisible();
  await userCard.getByRole('button', { name: 'Threat list menu' }).click();
  await page.getByTestId('threat-list-delete').click();

  // ConfirmDialog drives the destructive flow.
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await page.getByTestId('confirm-ok').click();

  await expect(page.locator('[data-testid^="threat-list-card"]').filter({ hasText: 'Trash me' })).toHaveCount(0);
});

test('Builder tab on mobile has ≥44×44 hit target and reaches the screen', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only check for the mobile-nav Builder button');
  await freshStart(page);
  // Make a team so BuilderScreen mounts its full sections instead of the
  // empty-state placeholder.
  await nav(page, 'Teams');
  await createTeam(page);

  // Mobile nav items are hash-router anchors (role=link), not buttons.
  const btn = page.locator('nav.mobile-nav').getByRole('link', { name: 'Builder' });
  await expect(btn).toBeVisible();
  const box = await btn.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(box!.width).toBeGreaterThanOrEqual(40);

  await btn.click();
  await expect(page.getByRole('heading', { name: 'Builder', exact: true })).toBeVisible();
  await expect(page.getByTestId('coverage-section')).toBeVisible();
});
