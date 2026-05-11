import { describe, expect, it, vi } from 'vitest';

const requiredEnv = {
  AUTH_ISSUER: 'http://localhost:8080/realms/dev',
  AUTH_CLIENT_ID: 'analog-demo-auth',
  AUTH_CLIENT_SECRET: 'local-client-secret',
  SESSION_SECRET: 'local-session-secret',
};

async function importAuthConfig(env: Record<string, string | undefined>) {
  vi.resetModules();
  vi.unstubAllEnvs();

  for (const [name, value] of Object.entries(env)) {
    if (value === undefined) {
      vi.stubEnv(name, '');
    } else {
      vi.stubEnv(name, value);
    }
  }

  return import('./auth.config');
}

describe('authConfig', () => {
  it.each([
    ['AUTH_ISSUER'],
    ['AUTH_CLIENT_ID'],
    ['AUTH_CLIENT_SECRET'],
    ['SESSION_SECRET'],
  ])('throws when %s is missing', async (envName) => {
    await expect(
      importAuthConfig({ ...requiredEnv, [envName]: undefined })
    ).rejects.toThrow(`${envName} environment variable is required`);
  });

  it('uses required OAuth environment variables', async () => {
    const { authConfig } = await importAuthConfig(requiredEnv);

    expect(authConfig.issuer).toBe(requiredEnv.AUTH_ISSUER);
    expect(authConfig.clientId).toBe(requiredEnv.AUTH_CLIENT_ID);
    expect(authConfig.clientSecret).toBe(requiredEnv.AUTH_CLIENT_SECRET);
    expect(authConfig.sessionStorage.sessionSecret).toBe(
      requiredEnv.SESSION_SECRET
    );
  });
});
