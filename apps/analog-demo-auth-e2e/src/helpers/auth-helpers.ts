import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export async function loginAsTestUser(page: Page): Promise<void> {
  // Navigate to protected route — triggers redirect chain:
  // /dashboard → /api/auth/login → Keycloak → /api/auth/callback → /dashboard
  const response = await page.goto('/dashboard');

  // After all redirects settle, check where we ended up
  // Give the page a moment to finish any client-side redirects
  await page.waitForLoadState('load');

  const currentUrl = page.url();

  if (currentUrl.includes('/openid-connect/auth')) {
    // On Keycloak login page — fill credentials
    await page.locator('#username').fill('testuser');
    await page.locator('#password').fill('test123');
    await page.locator('#kc-login').click();
    await page.waitForURL('**/dashboard', { timeout: 30000 });
  } else if (!currentUrl.includes('/dashboard')) {
    // Unexpected location — wait for redirect to complete
    await page.waitForURL('**/dashboard', { timeout: 30000 });
  }

  // Wait for Angular to hydrate auth state (SSR may initially show loading state)
  await expect(page.locator('text=Welcome')).toBeVisible({ timeout: 30000 });
}
