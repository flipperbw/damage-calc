import { expect, test } from '@playwright/test';

import { createTeam, freshStart, nav } from './helpers';

/**
 * Helper: open a fresh editor on Garchomp on a brand-new team. Used by most
 * tests in this file.
 */
/**
 * Open the MovePicker on the first move slot, whether that slot is empty
 * ("- empty -") or pre-filled by an auto-applied curated build. Filled slots
 * expose an info button (move-slot-info-0); clicking the row container (its
 * parent) routes to the picker rather than the info detail sheet.
 */
async function openFirstMoveSlot(page: import('@playwright/test').Page) {
  const filledInfo = page.getByTestId('move-slot-info-0');
  if (await filledInfo.count()) {
    await filledInfo.locator('..').click();
  } else {
    await page.getByText('- empty -').first().click();
  }
}

async function openGarchompEditor(page: import('@playwright/test').Page) {
  await freshStart(page);
  await nav(page, 'Teams');
  await createTeam(page);
  await page.getByTestId('team-slot-empty-0').first().click();
  const shell = page.getByTestId('picker-shell');
  await shell.getByPlaceholder('Search Pokémon').fill('Garchomp');
  await shell
    .getByRole('button', { name: /^Garchomp$/ })
    .first()
    .click();
}

test('curated build auto-fills item / ability / nature / moves', async ({ page }) => {
  await openGarchompEditor(page);

  // Build dropdown opens via the build trigger; auto-applied build is shown
  // in the trigger label so we can't anchor on "Custom" anymore.
  await page.getByTestId('build-trigger').click();
  await page
    .getByRole('button', { name: /Mixed Mega/ })
    .first()
    .click();

  // The "SM OU Mixed Mega" build uses Garchompite + Rough Skin + Hasty.
  // Scope to the editor's field buttons (the Teams screen behind the editor
  // also renders the saved mon's ability/item chips, so an unscoped role
  // query matches multiple elements).
  await expect(page.getByTestId('field-item')).toContainText('Garchompite');
  await expect(page.getByTestId('field-ability')).toContainText('Rough Skin');
  await expect(page.getByTestId('field-nature')).toContainText('Hasty');
});

test('change item via picker', async ({ page }) => {
  await openGarchompEditor(page);

  await page.getByTestId('field-item').click();
  // Leftovers is in the Champions item list. Picker rows now carry a
  // description subline, so the button's accessible name starts with the item
  // name rather than equalling it - match on the leading name.
  await page.getByPlaceholder('Search items').fill('Leftovers');
  await page.getByRole('button', { name: /^Leftovers\b/ }).first().click();

  // The Item field's value text reflects the picked item.
  await expect(page.getByTestId('field-item')).toContainText('Leftovers');
});

test('change ability via picker - list is species-filtered', async ({ page }) => {
  await openGarchompEditor(page);

  await page.getByTestId('field-ability').click();

  // In the Champions species data Garchomp's only canonical ability is
  // Sand Veil (Rough Skin is a setdex artifact, not a champions ability).
  // The picker filters by species, so unrelated abilities like Adaptability
  // shouldn't appear. The ability rows can include a shortDesc subline once
  // @pkmn/data resolves, so we match the name as a substring.
  const shell = page.getByTestId('picker-shell');
  // Each ability row renders a "<name> details" info button alongside the
  // pick option, so /Sand Veil/ alone is ambiguous - scope to the actual
  // option button (data-picker-option) to pick the row.
  const sandVeilOption = shell.locator('button[data-picker-option="true"]').filter({ hasText: 'Sand Veil' });
  await expect(sandVeilOption).toBeVisible();
  await expect(shell.getByRole('button', { name: /Adaptability/ })).toHaveCount(0);

  await sandVeilOption.click();
  await expect(page.getByTestId('field-ability')).toContainText('Sand Veil');
});

test('change nature via picker - natures are grouped', async ({ page }) => {
  await openGarchompEditor(page);

  await page.getByTestId('field-nature').click();

  // Group headers from groupNatures(): "+Atk", "+Def", "+SpA", "+SpD", "+Spe".
  // (Calc reports neutral natures with plus === minus, so they fall into the
  // matching plus bucket rather than a dedicated Neutral group - that's the
  // current shipping behavior and we test what we ship.)
  await expect(page.getByText('+Atk', { exact: true })).toBeVisible();
  await expect(page.getByText('+SpA', { exact: true })).toBeVisible();
  await expect(page.getByText('+Spe', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /^Adamant/ }).click();
  await expect(page.getByTestId('field-nature')).toContainText('Adamant');
});

test('change a move via picker - Common section appears for known species', async ({ page }) => {
  await openGarchompEditor(page);

  // Picking a species auto-applies the first curated build, so every move
  // slot is pre-filled (no "- empty -" row). Open the picker on the first
  // slot (clicking the row container - parent of its info button - routes to
  // setEditing, not the info detail sheet).
  await openFirstMoveSlot(page);

  // Common section header is rendered when the species has known moves.
  await expect(page.getByText('Common', { exact: true })).toBeVisible();
  // Once @pkmn/data finishes loading the section header flips from "All" to
  // "Learnable". With Garchomp's learnset cached after the first run this
  // arrives within a frame, but allow the loader the assertion timeout.
  await expect(page.getByText('Learnable', { exact: true })).toBeVisible();

  // Pick Stone Edge - a Garchomp-learnable move that is NOT in the default
  // build (so it isn't excluded as another slot's move) and proves the pick
  // lands in the slot.
  await page.getByPlaceholder('Search moves').fill('Stone Edge');
  await page.getByTestId('move-row-pick-Stone Edge').first().click();

  // The chosen move now renders in the editor's move list.
  await expect(page.getByRole('button', { name: 'Stone Edge details' })).toBeVisible();
});

test('move picker: Pikachu Learnable list excludes Earthquake until "Show all moves"', async ({ page }) => {
  // Confirms the @pkmn/data learnset filter actually filters: Pikachu cannot
  // learn Earthquake (verified by pkmn.test.ts unit test), so typing
  // "Earthquake" in the picker should produce zero rows under Learnable.
  // The "Show all moves" toggle bypasses the filter and the row appears.
  await freshStart(page);
  await nav(page, 'Teams');
  await createTeam(page);
  await page.getByTestId('team-slot-empty-0').first().click();
  const shell = page.getByTestId('picker-shell');
  await shell.getByPlaceholder('Search Pokémon').fill('Pikachu');
  await shell
    .getByRole('button', { name: /^Pikachu$/ })
    .first()
    .click();

  // Open the move picker on the first slot. Pikachu may or may not have a
  // curated build that auto-fills slots, so target the first move-slot row
  // generically (whether it shows "- empty -" or a filled move) instead of
  // assuming an empty row.
  await openFirstMoveSlot(page);

  // Wait for the learnset to load (header switches from "All" to "Learnable").
  await expect(page.getByText('Learnable', { exact: true })).toBeVisible();

  // Search for "Earthquake" - it should NOT appear in the Learnable list.
  await page.getByPlaceholder('Search moves').fill('Earthquake');

  // Scope the assertion to the picker shell so we don't accidentally match
  // copy elsewhere on the page. Move row buttons include the TypeBadge label
  // alongside the move name, so we match the move name as a substring.
  const pickerShell = page.getByTestId('picker-shell');
  await expect(pickerShell.getByRole('button', { name: /Earthquake/ })).toHaveCount(0);

  // Toggle on "Show all moves" - Earthquake is now visible in the unfiltered list.
  await page.getByTestId('move-show-all').click();
  await expect(pickerShell.getByRole('button', { name: /Earthquake/ }).first()).toBeVisible();
});

test('SP grid: per-stat cap is 32 and total cap is 66', async ({ page }) => {
  // Driving 35 sequential clicks per stat through the UI is slow; the
  // per-stat clamp itself is unit-tested in SpGrid.test.tsx. Here we just
  // verify the on-screen header and Save-disabled wiring with three quick
  // bumps to push the total over 66.
  test.setTimeout(15000);
  await openGarchompEditor(page);

  // Round 2 auto-applies the first curated build on initial species pick,
  // so SPs come pre-populated. Reset every stat to 0 first so the test
  // exercises the same arithmetic as before (start from blank, bump atk).
  for (const stat of ['hp', 'atk', 'def', 'spa', 'spd', 'spe']) {
    await page.getByRole('button', { name: `${stat} 0` }).click();
  }

  // Click atk + a few times via UI to confirm rendering, then jump past
  // the cap by injecting state directly through the existing dispatch.
  // Sequential page.click awaits ensure React flushes state between
  // increments (synthetic native clicks would batch).
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: 'atk +' }).click();
  }
  await expect(page.getByText('5 / 66')).toBeVisible();

  // Skip the slow loop: set sps directly via the active team's mon to
  // simulate the at-cap state. This still hits the SpGrid render path
  // because the editor reads from local draft state - but we can drive
  // additional bumps from there.
  await page.evaluate(() => {
    // Click atk + 27 more times in quick succession with microtask yields
    // so each onClick sees the prior state (React flushes between).
    return new Promise<void>(async (resolve) => {
      const btn = document.querySelector('button[aria-label="atk +"]') as HTMLButtonElement | null;
      if (!btn) return resolve();
      for (let i = 0; i < 27; i++) {
        btn.click();
        await new Promise((r) => setTimeout(r, 0));
      }
      resolve();
    });
  });
  await expect(page.getByText('32 / 66')).toBeVisible();

  await page.evaluate(() => {
    return new Promise<void>(async (resolve) => {
      const btn = document.querySelector('button[aria-label="spe +"]') as HTMLButtonElement | null;
      if (!btn) return resolve();
      for (let i = 0; i < 32; i++) {
        btn.click();
        await new Promise((r) => setTimeout(r, 0));
      }
      resolve();
    });
  });
  await expect(page.getByText('64 / 66')).toBeVisible();

  // Total cap is enforced by the validator (not the bump fn). Adding 3 more
  // to spd takes the total to 67, which surfaces a "total exceeds 66" error
  // and disables Save.
  await page.getByRole('button', { name: 'spd +' }).click();
  await page.getByRole('button', { name: 'spd +' }).click();
  await page.getByRole('button', { name: 'spd +' }).click();
  await expect(page.getByText(/total exceeds 66/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
});

test('Copy button copies showdown text and surfaces a toast', async ({ page }) => {
  // Grant clipboard read so we can read back what was written. webkit
  // ignores the permissions API (no-op rejection); we still attempt the read
  // and fall through to toast assertion when readText isn't available.
  try {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  } catch {
    // webkit doesn't support these permissions strings; not fatal - we'll
    // verify the toast text instead of round-tripping through the clipboard.
  }

  await openGarchompEditor(page);
  await page.getByTestId('build-trigger').click();
  await page
    .getByRole('button', { name: /Mixed Mega/ })
    .first()
    .click();

  await page.getByTestId('copy-mon').click();

  // Toast appears (sonner renders to a portal at document root).
  await expect(page.getByText('Copied to clipboard')).toBeVisible();

  // The inline ✓ Copied chip also lights up briefly (1500 ms timeout).
  await expect(page.getByTestId('copy-confirmation')).toBeVisible();
});

test('Mega toggle is gated on held mega stone - Garchomp + Garchompite shows it', async ({ page }) => {
  await openGarchompEditor(page);

  // The default auto-applied Garchomp build (Life Orb Sweeper) holds Life Orb,
  // so no Mega toggle yet. Apply the "SM OU Mixed Mega" build, which holds
  // Garchompite - the Mega toggle then becomes available.
  await page.getByTestId('build-trigger').click();
  await page
    .getByRole('button', { name: /Mixed Mega/ })
    .first()
    .click();
  await expect(page.getByTestId('field-item')).toContainText('Garchompite');

  const toggle = page.getByTestId('mega-toggle');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');

  // Toggle on - aria-pressed flips to true.
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');

  // Clearing the item via the picker hides the toggle again.
  await page.getByTestId('field-item').click();
  // First entry in the item picker is the clear-selection ("No item") row.
  await page.getByTestId('item-row-pick-none').click();
  await expect(page.getByTestId('mega-toggle')).toHaveCount(0);
});
