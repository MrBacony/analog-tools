import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth-helpers';

const TIMEOUT_MS = 30000;

test.describe('Auth Edge Cases', () => {
  test('page refresh on protected route maintains session', async ({
    page,
  }) => {
    await loginAsTestUser(page);
    await expect(page.getByTestId('welcome-message')).toBeVisible({
      timeout: TIMEOUT_MS,
    });

    // Refresh the page
    await page.reload();

    // Should still be on dashboard, not redirected to login
    await expect(page.locator('h1')).toContainText('Dashboard', {
      timeout: TIMEOUT_MS,
    });
    await expect(page.getByTestId('welcome-message')).toBeVisible({
      timeout: TIMEOUT_MS,
    });
  });

  test('authenticated API call returns user data', async ({ page }) => {
    await loginAsTestUser(page);

    // Make an API call using the browser's session cookie
    const body = await page.evaluate(async () => {
      const response = await fetch('/api/v1/me');

      if (!response.ok) {
        throw new Error(
          `Expected /api/v1/me to return 200, got ${response.status}`
        );
      }

      return response.json();
    });

    expect(body.isAuthenticated).toBe(true);
    expect(body.user).toBeTruthy();
  });

  test('navigating from protected to public route works', async ({ page }) => {
    await loginAsTestUser(page);
    await expect(page.getByTestId('welcome-message')).toBeVisible({
      timeout: TIMEOUT_MS,
    });

    // Navigate to public route
    await page.goto('/info');
    await expect(page.locator('h1')).toHaveText('Info');

    // Navigate back to protected route — should not re-auth
    await page.goto('/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard', {
      timeout: TIMEOUT_MS,
    });
    await expect(page.getByTestId('welcome-message')).toBeVisible({
      timeout: TIMEOUT_MS,
    });
  });
});
