import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth-helpers';

test.describe('Auth Flow', () => {
  test('login redirects to Keycloak and back to dashboard with user info', async ({
    page,
  }) => {
    await loginAsTestUser(page);

    // Should be on dashboard with user info
    await expect(page.locator('h1')).toContainText('Dashboard');
    await expect(page.getByTestId('welcome-message')).toBeVisible();
  });

  test('logout clears session and redirects to provider logout', async ({
    page,
  }) => {
    await loginAsTestUser(page);

    // Wait for auth state to load and Logout button to appear
    const logoutButton = page.locator('button:has-text("Logout")');
    await expect(logoutButton).toBeVisible({ timeout: 10000 });
    await logoutButton.click();

    // Should be redirected to the configured identity provider logout route.
    await page.waitForURL(
      /.*\/realms\/dev\/protocol\/openid-connect\/logout.*/
    );
  });

  test('user info is displayed after login', async ({ page }) => {
    await loginAsTestUser(page);

    // User info should contain the test user's data
    await expect(page.getByTestId('user-info')).toContainText('testuser');
  });
});
