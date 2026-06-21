import { expect, test } from '@playwright/test';

import { freshStart, nav } from './helpers';

/**
 * E2E for the Showdown / pokepaste import flow (ShowdownImportDialog).
 *
 * Covers the team-import path end to end: open the dialog from the Teams
 * empty state, paste a multi-mon Showdown block, see it parsed, commit, and
 * land on Battle with the imported team active. Also the unknown-species
 * guard. The pokepaste URL path hits the network (pokepast.es) so it's left
 * to manual/unit testing rather than wired into the e2e run.
 */

// A two-mon Showdown export. Garchomp + Skarmory are both in the Champions
// roster and used elsewhere in the suite, so they resolve regardless of any
// item-legality adjustments the importer applies.
const TWO_MON_PASTE = `Garchomp @ Choice Scarf
Ability: Rough Skin
EVs: 32 Atk / 32 Spe
Adamant Nature
- Earthquake
- Outrage
- Stone Edge
- Fire Fang

Skarmory @ Leftovers
Ability: Sturdy
EVs: 32 HP / 32 Def
Impish Nature
- Spikes
- Roost
- Brave Bird
- Whirlwind`;

test('import a Showdown team and land on Battle with it active', async ({ page }) => {
  await freshStart(page);
  await nav(page, 'Teams');

  // Fresh Teams screen shows the empty-state import CTA.
  await page.getByTestId('import-team-empty').click();

  const textarea = page.getByTestId('showdown-import-textarea');
  await expect(textarea).toBeVisible();
  await textarea.fill(TWO_MON_PASTE);

  // Parser (debounced) detects both mons.
  await expect(page.getByText(/2 mons detected/)).toBeVisible();

  // Commit creates the team, activates it, and switches to Battle.
  const commit = page.getByTestId('showdown-import-commit-team');
  await expect(commit).toBeEnabled();
  await commit.click();

  // Landed on Battle (the pick-opponent card is Battle-only) with the imported
  // two-mon team active - the carousel shows both Garchomp and Skarmory.
  await expect(page.getByTestId('pick-opponent')).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('button', { name: 'Garchomp' }).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skarmory' }).filter({ visible: true }).first()).toBeVisible();
});

test('import flags an unknown species and disables the commit', async ({ page }) => {
  await freshStart(page);
  await nav(page, 'Teams');
  await page.getByTestId('import-team-empty').click();

  await page.getByTestId('showdown-import-textarea').fill('Notarealmon @ Leftovers\n- Tackle');

  // The row is flagged and there's nothing importable, so commit is disabled.
  await expect(page.getByText(/Unknown species/)).toBeVisible();
  await expect(page.getByTestId('showdown-import-commit-team')).toBeDisabled();
});
