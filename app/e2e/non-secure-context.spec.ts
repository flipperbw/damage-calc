import { expect, test } from '@playwright/test';

import { addMonToFirstSlot, createTeam, freshStart, nav } from './helpers';

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

  // A fresh Teams screen shows the empty-state CTA (create-team-empty); the
  // header "create-team" button only appears once a team exists.
  await page.getByTestId('create-team-empty').click();
  await expect(page.getByText('New team').first()).toBeVisible();
});

/**
 * Same family of bug: `navigator.clipboard.writeText` is undefined in a
 * non-secure context. The Copy button used to call it directly and the
 * TypeError swallowed inside the handler left the user with a Copy button
 * that did nothing. This test simulates the LAN-IP environment by stubbing
 * out `navigator.clipboard` AND lying about `isSecureContext`. The
 * copyToClipboard util's execCommand fallback should still produce a
 * "Copied to clipboard" toast.
 */
test('Copy button works when navigator.clipboard is unavailable (LAN/non-secure)', async ({ page }) => {
  await page.addInitScript(() => {
    // Pretend we're on a non-secure origin (LAN IP).
    Object.defineProperty(window, 'isSecureContext', {
      value: false,
      configurable: true,
    });
    // Strip the async clipboard so the Copy handler is forced through
    // the execCommand fallback.
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    });
  });

  await freshStart(page);
  await nav(page, 'Teams');
  await createTeam(page);
  await addMonToFirstSlot(page, 'Garchomp', /Swords Dance/);

  // Re-open the editor on the saved Garchomp.
  await page.locator('div.flex.gap-1\\.5.mt-2\\.5 button:has(img)').first().click();
  await page.getByTestId('copy-mon').click();

  // The toast confirms the fallback path produced a "real" copy.
  await expect(page.getByText('Copied to clipboard')).toBeVisible();
  await expect(page.getByTestId('copy-confirmation')).toBeVisible();
});
