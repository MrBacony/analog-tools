import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth-helpers';

test.describe('Session Lifecycle', () => {
  test('re-login after logout works', async ({ page }) => {
    // First login
    await loginAsTestUser(page);
    await expect(page.locator('h1')).toHaveText('Dashboard');

    // Wait for auth state to load and Logout button to appear
    const logoutButton = page.locator('button:has-text("Logout")');
    await expect(logoutButton).toBeVisible({ timeout: 10000 });
    await logoutButton.click();

    // Wait for navigation away from dashboard
    await page.waitForURL((url) => !url.pathname.includes('/dashboard'), {
      timeout: 15000,
    });

    // Wait for any redirects to settle
    await page.waitForLoadState('networkidle');

    // Second login
    await loginAsTestUser(page);
    await expect(page.locator('h1')).toHaveText('Dashboard', {
      timeout: 10000,
    });
  });
});
