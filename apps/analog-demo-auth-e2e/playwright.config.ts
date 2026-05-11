import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

const baseURL = process.env['BASE_URL'] || 'http://localhost:4201';

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  timeout: 60_000,
  retries: 1,
  // Auth tests share server-side session state — run serially to avoid races
  workers: 1,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  reporter: 'line',
  webServer: {
    command: 'npx nx run analog-demo-auth:serve',
    url: 'http://localhost:4201',
    reuseExistingServer:
      process.env['PLAYWRIGHT_REUSE_EXISTING_SERVER'] === 'true',
    cwd: workspaceRoot,
    timeout: 120_000,
  },
  globalSetup: './src/global-setup.ts',
  globalTeardown: './src/global-teardown.ts',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
