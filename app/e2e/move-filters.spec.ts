import { test, expect, type Page } from '@playwright/test';
import { freshStart, nav, createTeam } from './helpers';

/**
 * Open the move picker on the first slot of a brand-new Garchomp. Garchomp
 * has plenty of curated/learnable moves, so all filter scenarios reduce to
 * checking the visible row count — no risk of an empty list being a false
 * negative.
 */
async function openMovePicker(page: Page) {
  await freshStart(page);
  await nav(page, 'Teams');
  await createTeam(page);
  await page.getByTestId('team-slot-empty-0').first().click();
  const speciesShell = page.getByTestId('picker-shell');
  await speciesShell.getByPlaceholder('Search Pokémon').fill('Garchomp');
  await speciesShell.getByRole('button', { name: /^Garchomp$/ }).first().click();
  // Tap the first move slot — it shows "— empty —" until a move is set.
  await page.getByText('— empty —').first().click();
  // The picker has its own search input; wait for it before interacting.
  await expect(page.getByPlaceholder('Search moves')).toBeVisible();
}

async function openFilters(page: Page) {
  await page.getByTestId('move-filters-toggle').click();
  await expect(page.getByTestId('move-filters-panel')).toBeVisible();
}

test('type filter narrows the list to the selected type', async ({ page }) => {
  await openMovePicker(page);
  await openFilters(page);

  // Activate Ground only.
  await page.getByTestId('move-filter-type-Ground').click();
  // The filter count badge surfaces.
  await expect(page.getByTestId('move-filters-count')).toContainText('1');

  // Earthquake (Ground) should be visible; Dragon Claw (Dragon) should not
  // be in the list at all once the Ground-only filter is active.
  const shell = page.getByTestId('picker-shell');
  await expect(shell.getByTestId('move-row-pick-Earthquake').first()).toBeVisible();
  await expect(shell.getByTestId('move-row-pick-Dragon Claw')).toHaveCount(0);
});

test('Priority+ filter limits to moves with priority > 0', async ({ page }) => {
  await openMovePicker(page);
  await openFilters(page);

  await page.getByTestId('move-filter-prio-pos').click();
  await expect(page.getByTestId('move-filters-count')).toContainText('1');

  // Show all moves so the comparison is over the full move pool, not just
  // Garchomp's learnset (Garchomp's learnable priority moves are limited).
  await page.getByRole('button', { name: 'Show all moves' }).click();

  const shell = page.getByTestId('picker-shell');
  // Quick Attack (+1) and Sucker Punch (+1) are positive-priority moves.
  await expect(shell.getByTestId('move-row-pick-Quick Attack').first()).toBeVisible();
  await expect(shell.getByTestId('move-row-pick-Sucker Punch').first()).toBeVisible();

  // Earthquake (priority 0) should be filtered out.
  await expect(shell.getByTestId('move-row-pick-Earthquake')).toHaveCount(0);
  // Trick Room (-7 via the @pkmn/data fallback) should also be filtered out.
  await expect(shell.getByTestId('move-row-pick-Trick Room')).toHaveCount(0);
});

test('BP descending sort puts highest base power first', async ({ page }) => {
  await openMovePicker(page);
  await openFilters(page);

  await page.getByTestId('move-sort-bp-desc').click();
  // Show all moves so the gen's heavy hitters are in the list. The Common
  // section is sorted independently and only contains Garchomp's curated
  // moves, so we scope the assertion to the unfiltered "All" list below it.
  await page.getByRole('button', { name: 'Show all moves' }).click();

  const shell = page.getByTestId('picker-shell');
  // The "All" / "Learnable" header divides curated Common picks from the
  // full move pool. Read all rows that follow it in DOM order — that's the
  // bulk of the picker.
  const allHeader = shell.getByText(/^(All|Learnable)$/, { exact: true });
  await expect(allHeader).toBeVisible();

  // Capture the testids of the first three rows AFTER the All/Learnable
  // header. We walk the next siblings and stop after collecting three
  // move-row-pick rows.
  const firstThreeAfterAll = await allHeader.evaluate(el => {
    const out: string[] = [];
    let cur: Element | null = el.nextElementSibling;
    while (cur && out.length < 3) {
      const tid = cur.getAttribute('data-testid') ?? '';
      if (tid.startsWith('move-row-pick-')) {
        out.push(tid.replace('move-row-pick-', ''));
      }
      cur = cur.nextElementSibling;
    }
    return out;
  });

  // Top of the gen-0 (Champions) BP table is Explosion (250), Self-Destruct
  // (200), Gigaton Hammer (160). Those three are stable across the calc's
  // data shape and should be in the first three rows of the All/Learnable
  // section under BP-descending. Allow flexibility for ties / future data
  // updates by asserting at least one is present.
  const hyperTier = ['Explosion', 'Self-Destruct', 'Gigaton Hammer'];
  const overlap = firstThreeAfterAll.filter(n => hyperTier.includes(n));
  expect(overlap.length).toBeGreaterThan(0);

  // And basic-tier moves should NOT be at the top.
  expect(firstThreeAfterAll).not.toContain('Tackle');
  expect(firstThreeAfterAll).not.toContain('Quick Attack');
});

test('clear filters resets all active selections', async ({ page }) => {
  await openMovePicker(page);
  await openFilters(page);

  await page.getByTestId('move-filter-type-Ground').click();
  await page.getByTestId('move-filter-prio-pos').click();
  await expect(page.getByTestId('move-filters-count')).toContainText('2');

  await page.getByTestId('move-filters-clear').click();
  // Count badge disappears with no active filters.
  await expect(page.getByTestId('move-filters-count')).toHaveCount(0);
  // Earthquake reappears (it was filtered out by Priority+).
  await expect(
    page.getByTestId('picker-shell').getByTestId('move-row-pick-Earthquake').first(),
  ).toBeVisible();
});
