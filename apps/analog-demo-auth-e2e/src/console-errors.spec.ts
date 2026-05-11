import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth-helpers';
import { createConsoleFilter } from './helpers/console-filter';

test.describe('Console Errors', () => {
  test('no unexpected console errors during login flow', async ({ page }) => {
    const { errors } = createConsoleFilter(page);

    await loginAsTestUser(page);

    // Wait a moment for any async errors
    await page.waitForTimeout(1000);

    expect(
      errors.map((e) => e.text()),
      'Unexpected console errors detected'
    ).toEqual([]);
  });

  test('no unexpected console errors on public pages', async ({ page }) => {
    const { errors } = createConsoleFilter(page);

    await page.goto('/');
    await page.waitForTimeout(500);
    await page.goto('/info');
    await page.waitForTimeout(500);

    expect(
      errors.map((e) => e.text()),
      'Unexpected console errors detected'
    ).toEqual([]);
  });
});
