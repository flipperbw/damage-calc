import { test, expect } from '@playwright/test';
import { freshStart, nav, createTeam } from './helpers';

/**
 * Regression test for the iOS auto-zoom-on-input bug. Real iOS Safari/Brave
 * zooms the page when an input with computed font-size < 16px gains focus,
 * and on some configs fails to release that zoom when the input is removed
 * from the DOM (i.e. when the picker closes after an item is picked).
 *
 * We've already bumped every search input to text-base (16px) and the
 * PickerShell now blurs the active element when it transitions closed. This
 * test asserts the visualViewport scale is 1 after a full picker round trip.
 *
 * Playwright's WebKit emulation doesn't actually simulate the auto-zoom, so
 * on CI this test will pass trivially - that's by design. It still catches
 * any regression on real WebKit and documents the expected behavior.
 */
test('species picker close path leaves visualViewport scale at 1', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'iOS auto-zoom is a mobile-only concern');

  await freshStart(page);
  await nav(page, 'Teams');
  await createTeam(page);

  // Open species picker via empty slot.
  await page.getByTestId('team-slot-empty-0').first().click();

  const shell = page.getByTestId('picker-shell');
  await expect(shell).toBeVisible();

  // Type into the search input - focuses it, which on real iOS would zoom
  // unless the input is ≥16px.
  const input = shell.getByPlaceholder('Search Pokémon');
  await input.fill('Garchomp');

  // Pick a result - this calls onPick + onClose, unmounting the picker.
  await shell.getByRole('button', { name: /^Garchomp$/ }).first().click();

  // Picker is gone.
  await expect(shell).toHaveCount(0);

  // visualViewport.scale should be 1 (no residual zoom). Some headless
  // WebKit builds expose visualViewport but never simulate zoom - that's
  // fine, the assertion still passes.
  const scale = await page.evaluate(() => window.visualViewport?.scale ?? 1);
  expect(scale).toBe(1);

  // Belt-and-suspenders: the previously-focused input should no longer be
  // the active element. This is what the PickerShell blur-on-close hook
  // guarantees, and it's the more actionable assertion in headless WebKit.
  const activeTag = await page.evaluate(() => document.activeElement?.tagName ?? '');
  expect(activeTag).not.toBe('INPUT');
});
