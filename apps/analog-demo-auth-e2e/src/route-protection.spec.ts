import { test, expect } from '@playwright/test';

test.describe('Route Protection', () => {
  test('home page is accessible without auth', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('Analog Auth Demo');
  });

  test('info page is accessible without auth', async ({ page }) => {
    await page.goto('/info');
    await expect(page.locator('h1')).toHaveText('Info');
  });

  test('dashboard redirects unauthenticated users to login', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    // Should redirect to Keycloak login
    await page.waitForURL(/.*\/realms\/dev\/protocol\/openid-connect\/auth.*/);
    await expect(page).toHaveURL(
      /.*\/realms\/dev\/protocol\/openid-connect\/auth.*/
    );
  });

  test('health API is accessible without auth', async ({ request }) => {
    const response = await request.get('/api/v1/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('me API returns 401 or 302without auth', async ({ request }) => {
    const response = await request.get('/api/v1/me', {
      maxRedirects: 0,
    });
    // Expect either 401 or redirect to login
    expect([401, 302]).toContain(response.status());
  });
});
