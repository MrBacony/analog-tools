import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth-helpers';

test.describe('Auth Edge Cases', () => {
  test('page refresh on protected route maintains session', async ({
    page,
  }) => {
    await loginAsTestUser(page);
    await expect(page.locator('text=Welcome')).toBeVisible({ timeout: 30000 });

    // Refresh the page
    await page.reload({ waitUntil: 'networkidle' });

    // Should still be on dashboard, not redirected to login
    await expect(page.locator('h1')).toHaveText('Dashboard', { timeout: 30000 });
    await expect(page.locator('text=Welcome')).toBeVisible({ timeout: 30000 });
  });

  test('authenticated API call returns user data', async ({ page }) => {
    await loginAsTestUser(page);

    // Make an API call using the browser's session cookie
    const response = await page.request.get('/api/v1/me');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.isAuthenticated).toBe(true);
    expect(body.user).toBeTruthy();
  });

  test('navigating from protected to public route works', async ({ page }) => {
    await loginAsTestUser(page);
    await expect(page.locator('text=Welcome')).toBeVisible({ timeout: 30000 });

    // Navigate to public route
    await page.goto('/info');
    await expect(page.locator('h1')).toHaveText('Info');

    // Navigate back to protected route — should not re-auth
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await expect(page.locator('h1')).toHaveText('Dashboard', { timeout: 30000 });
    await expect(page.locator('text=Welcome')).toBeVisible({ timeout: 30000 });
  });
});
