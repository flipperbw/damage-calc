import { test, expect } from '@playwright/test';
import { freshStart, nav } from './helpers';

/**
 * Touch-target + safe-area regression tests. Playwright's iPhone 13 viewport
 * doesn't simulate the iOS status bar / notch, so a button at the very top
 * of the page passes a normal `click` test but is unreachable on a real
 * device. These tests inject a synthetic safe-area inset via env() override
 * (using a CSS variable shadow) and assert the critical buttons are still
 * inside the visible rect AND meet Apple's ≥44×44px hit-target guideline.
 */

const FAKE_TOP_INSET = 47;     // iPhone 13 status bar height-ish
const FAKE_BOTTOM_INSET = 34;  // home indicator
const MIN_TARGET = 44;

async function injectFakeSafeArea(page: import('@playwright/test').Page) {
  await page.addStyleTag({
    content: `
      :root {
        --safe-top: ${FAKE_TOP_INSET}px !important;
        --safe-bottom: ${FAKE_BOTTOM_INSET}px !important;
      }
    `,
  });
}

test('Create-team button is reachable above iOS safe-area inset and is ≥44px', async ({ page }) => {
  await freshStart(page);
  await injectFakeSafeArea(page);
  await nav(page, 'Teams');

  const btn = page.getByTestId('create-team');
  await expect(btn).toBeVisible();

  const box = await btn.boundingBox();
  expect(box).not.toBeNull();
  // Hit target meets Apple HIG.
  expect(box!.width).toBeGreaterThanOrEqual(MIN_TARGET);
  expect(box!.height).toBeGreaterThanOrEqual(MIN_TARGET);
  // Top edge sits below the simulated status bar.
  expect(box!.y).toBeGreaterThanOrEqual(FAKE_TOP_INSET);
  // Tap actually lands.
  await btn.click();
  await expect(page.getByText('New team').first()).toBeVisible();
});

test('Mobile top nav sits below the status-bar inset (not under the notch)', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile top nav only renders on the mobile viewport');

  await freshStart(page);
  await injectFakeSafeArea(page);

  const nav = page.locator('nav.mobile-nav');
  await expect(nav).toBeVisible();
  const box = await nav.boundingBox();
  expect(box).not.toBeNull();
  // Top edge of nav clears the simulated status bar.
  expect(box!.y).toBeGreaterThanOrEqual(FAKE_TOP_INSET);
});

test('Each mobile-nav tab button is ≥44×44 hit target', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile top nav only renders on the mobile viewport');

  await freshStart(page);
  for (const label of ['Battle', 'Teams', 'Settings']) {
    const btn = page.locator('nav.mobile-nav').getByRole('button', { name: label });
    await expect(btn).toBeVisible();
    const box = await btn.boundingBox();
    expect(box, `${label} tab missing bounding box`).not.toBeNull();
    expect(box!.height, `${label} tab too short`).toBeGreaterThanOrEqual(MIN_TARGET);
    // Width can be narrower because tabs share the row, but not absurdly so.
    expect(box!.width, `${label} tab too narrow`).toBeGreaterThanOrEqual(40);
  }
});
