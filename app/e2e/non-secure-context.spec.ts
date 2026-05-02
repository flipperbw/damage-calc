import { test, expect } from '@playwright/test';
import { freshStart, nav } from './helpers';

/**
 * Regression: when the dev server is reached over LAN from a phone (e.g.
 * http://192.168.x.y:5173 from iOS Brave), the page is NOT a secure context,
 * so `crypto.randomUUID` is undefined. Code that called it directly would
 * throw inside the click handler, leaving the user with a button that
 * "doesn't do anything." This test stubs out randomUUID and verifies the
 * Create Team button still works.
 */
test('Create Team works when crypto.randomUUID is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    // Strip randomUUID before any app code runs.
    if (window.crypto && 'randomUUID' in window.crypto) {
      // @ts-expect-error: dev-only mutation
      window.crypto.randomUUID = undefined;
    }
  });
  await freshStart(page);
  await nav(page, 'Teams');

  await page.getByTestId('create-team').click();
  await expect(page.getByText('New team').first()).toBeVisible();
});
