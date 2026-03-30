import { expect, test } from '@playwright/test';

test('shows the analog example home heading', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('h1')).toContainText('Analog.');
});