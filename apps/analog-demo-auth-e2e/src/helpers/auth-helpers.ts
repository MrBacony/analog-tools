import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const dashboardUrlPattern = /.*\/dashboard.*/;
const keycloakLoginUrlPattern =
  /.*\/realms\/dev\/protocol\/openid-connect\/auth.*/;
const username = process.env['TEST_USERNAME'] || 'testuser';
const password = process.env['TEST_PASSWORD'] || 'test123';

export async function loginAsTestUser(page: Page): Promise<void> {
  // Navigate to protected route — triggers redirect chain:
  // /dashboard → /api/auth/login → Keycloak → /api/auth/callback → /dashboard
  await page.goto('/dashboard');

  const keycloakLogin = page.locator('#kc-login');
  const welcomeMessage = page.getByTestId('welcome-message');

  await Promise.race([
    page.waitForURL(keycloakLoginUrlPattern, { timeout: 30000 }),
    welcomeMessage.waitFor({ state: 'visible', timeout: 30000 }),
  ]);

  if (
    page.url().includes('/openid-connect/auth') ||
    (await keycloakLogin.isVisible())
  ) {
    await expect(keycloakLogin).toBeVisible({ timeout: 30000 });
    await page.locator('#username').fill(username);
    await page.locator('#password').fill(password);
    await keycloakLogin.click();
  }

  // Wait for Angular to hydrate auth state and load the user resource.
  await page.waitForURL(dashboardUrlPattern, { timeout: 30000 });
  await expect(welcomeMessage).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByTestId('user-info')).toContainText(username, {
    timeout: 30000,
  });
}
