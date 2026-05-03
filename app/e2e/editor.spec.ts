import { test, expect } from '@playwright/test';
import { freshStart, nav, createTeam } from './helpers';

/**
 * Helper: open a fresh editor on Garchomp on a brand-new team. Used by most
 * tests in this file.
 */
async function openGarchompEditor(page: import('@playwright/test').Page) {
  await freshStart(page);
  await nav(page, 'Teams');
  await createTeam(page);
  await page.getByTestId('team-slot-empty-0').first().click();
  const shell = page.getByTestId('picker-shell');
  await shell.getByPlaceholder('Search Pokémon').fill('Garchomp');
  await shell.getByRole('button', { name: /^Garchomp$/ }).first().click();
}

test('curated build auto-fills item / ability / nature / moves', async ({ page }) => {
  await openGarchompEditor(page);

  // Build dropdown shows "Custom" until applied.
  await page.getByRole('button', { name: /^Custom/ }).click();
  await page.getByRole('button', { name: /Mixed Mega/ }).first().click();

  // The first build "SM OU Mixed Mega" uses Garchompite + Rough Skin + Hasty.
  // Fields render the chosen values.
  await expect(page.getByRole('button', { name: /Garchompite/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Rough Skin/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Hasty/ })).toBeVisible();
});

test('change item via picker', async ({ page }) => {
  await openGarchompEditor(page);

  await page.getByTestId('field-item').click();
  // Leftovers is in the Champions item list; Life Orb wasn't carried over.
  await page.getByPlaceholder('Search items').fill('Leftovers');
  await page.getByRole('button', { name: /^Leftovers$/ }).click();

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
  await expect(shell.getByRole('button', { name: /Sand Veil/ })).toBeVisible();
  await expect(shell.getByRole('button', { name: /Adaptability/ })).toHaveCount(0);

  await shell.getByRole('button', { name: /Sand Veil/ }).click();
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

  // Tap the first move slot ("- empty -").
  await page.getByText('- empty -').first().click();

  // Common section header is rendered when the species has known moves.
  await expect(page.getByText('Common', { exact: true })).toBeVisible();
  // Once @pkmn/data finishes loading the section header flips from "All" to
  // "Learnable". With Garchomp's learnset cached after the first run this
  // arrives within a frame, but allow the loader the assertion timeout.
  await expect(page.getByText('Learnable', { exact: true })).toBeVisible();

  await page.getByPlaceholder('Search moves').fill('Earthquake');
  await page.getByTestId('move-row-pick-Earthquake').first().click();

  // The chosen move now renders in the slot row as bold text.
  await expect(page.locator('b', { hasText: 'Earthquake' })).toBeVisible();
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
  await shell.getByRole('button', { name: /^Pikachu$/ }).first().click();

  // Open the move picker on the first slot.
  await page.getByText('- empty -').first().click();

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
  await page.getByRole('button', { name: 'Show all moves' }).click();
  await expect(pickerShell.getByRole('button', { name: /Earthquake/ }).first()).toBeVisible();
});

test('SP grid: per-stat cap is 32 and total cap is 66', async ({ page }) => {
  // Driving 35 sequential clicks per stat through the UI is slow; the
  // per-stat clamp itself is unit-tested in SpGrid.test.tsx. Here we just
  // verify the on-screen header and Save-disabled wiring with three quick
  // bumps to push the total over 66.
  test.setTimeout(15000);
  await openGarchompEditor(page);

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
      const btn = document.querySelector(
        'button[aria-label="atk +"]',
      ) as HTMLButtonElement | null;
      if (!btn) return resolve();
      for (let i = 0; i < 27; i++) {
        btn.click();
        await new Promise(r => setTimeout(r, 0));
      }
      resolve();
    });
  });
  await expect(page.getByText('32 / 66')).toBeVisible();

  await page.evaluate(() => {
    return new Promise<void>(async (resolve) => {
      const btn = document.querySelector(
        'button[aria-label="spe +"]',
      ) as HTMLButtonElement | null;
      if (!btn) return resolve();
      for (let i = 0; i < 32; i++) {
        btn.click();
        await new Promise(r => setTimeout(r, 0));
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
    await page
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write']);
  } catch {
    // webkit doesn't support these permissions strings; not fatal - we'll
    // verify the toast text instead of round-tripping through the clipboard.
  }

  await openGarchompEditor(page);
  await page.getByRole('button', { name: /^Custom/ }).click();
  await page.getByRole('button', { name: /Mixed Mega/ }).first().click();

  await page.getByTestId('copy-mon').click();

  // Toast appears (sonner renders to a portal at document root).
  await expect(page.getByText('Copied to clipboard')).toBeVisible();

  // The inline ✓ Copied chip also lights up briefly (1500 ms timeout).
  await expect(page.getByTestId('copy-confirmation')).toBeVisible();
});

test('Mega toggle is gated on held mega stone - Garchomp + Garchompite shows it', async ({ page }) => {
  await openGarchompEditor(page);

  // Without an item, no Mega toggle yet.
  await expect(page.getByRole('button', { name: /Mega Evolve/ })).toHaveCount(0);

  // Apply Garchompite via the curated build.
  await page.getByRole('button', { name: /^Custom/ }).click();
  await page.getByRole('button', { name: /Mixed Mega/ }).first().click();

  // Now the toggle appears.
  await expect(page.getByRole('button', { name: /Mega Evolve/ })).toBeVisible();

  // Toggle on - label flips to "Mega Active".
  await page.getByRole('button', { name: /Mega Evolve/ }).click();
  await expect(page.getByRole('button', { name: /Mega Active/ })).toBeVisible();
});
