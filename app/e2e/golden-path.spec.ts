import { test, expect } from '@playwright/test';
import {
  freshStart, nav, createTeam, addMonToFirstSlot, activateTeam, pickOpponent,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test('create team, add Garchomp, set up Skarmory opponent, see damage', async ({ page }) => {
  await nav(page, 'Teams');
  await createTeam(page);
  await addMonToFirstSlot(page, 'Garchomp', /Swords Dance/);

  // Activate the team.
  await activateTeam(page, 'New team');

  // We're on the Battle screen - pick an opponent via the empty-state card.
  await pickOpponent(page, 'Skarmory');

  // Damage values appear.
  await expect(page.getByText('Your moves → opponent')).toBeVisible();
  await expect(page.getByText(/%$/).first()).toBeVisible();

  // Reload - opponent persists.
  await page.reload();
  await expect(page.getByText('Skarmory').first()).toBeVisible();
});
