import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth-helpers';
import { createConsoleFilter } from './helpers/console-filter';

test.describe('Console Errors', () => {
  test('no unexpected console errors during login flow', async ({ page }) => {
    const { errors } = createConsoleFilter(page);

    await loginAsTestUser(page);
    await expect(page.getByTestId('user-info')).toContainText('testuser');

    expect(
      errors.map((e) => e.text()),
      'Unexpected console errors detected during login'
    ).toEqual([]);
  });

  test('no unexpected console errors on public pages', async ({ page }) => {
    const { errors } = createConsoleFilter(page);

    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('Analog Auth Demo');

    await page.goto('/info');
    await expect(page.locator('h1')).toHaveText('Info');

    expect(
      errors.map((e) => e.text()),
      'Unexpected console errors detected'
    ).toEqual([]);
  });
});
