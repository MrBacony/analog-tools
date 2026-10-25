/**
 * Integration test for #93: a deep link opened while logged out must survive
 * the middleware -> login -> callback round trip. The real middleware, auth
 * routes and session run against a real h3 server; only the identity provider
 * side of OAuthAuthenticationService is stubbed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, H3Event, toNodeListener } from 'h3';
import { createServer, Server } from 'node:http';
import { registerMockService, resetAllInjections } from '@analog-tools/inject';
import { LoggerService } from '@analog-tools/logger';
import { createUnstorageStore, useSession } from '@analog-tools/session';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import { useAnalogAuthMiddleware } from './useAnalogAuthMiddleware';
import { handleAuthRoute } from './handleAuthRoute';

async function startServer(): Promise<{ baseUrl: string; server: Server }> {
  const store = await createUnstorageStore({ type: 'memory' });

  registerMockService(OAuthAuthenticationService, {
    initSession: (event: H3Event) =>
      useSession(event, { store, secret: 'test-secret', name: 'sid' }),
    isUnprotectedRoute: () => false,
    isAuthenticated: vi.fn().mockResolvedValue(false),
    getAuthorizationUrl: async ({ state }: { state: string }) =>
      `https://idp.example/authorize?state=${state}`,
    handleCallback: vi.fn().mockResolvedValue(undefined),
  });

  const app = createApp();
  app.use(useAnalogAuthMiddleware);
  app.use(handleAuthRoute);
  app.use(() => 'protected page');

  const server = createServer(toNodeListener(app));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  return { baseUrl: `http://127.0.0.1:${port}`, server };
}

describe('deep link survives login (real h3 + session)', () => {
  let baseUrl: string;
  let server: Server;
  let cookie = '';

  async function get(path: string): Promise<string> {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: cookie ? { cookie } : {},
      redirect: 'manual',
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      cookie = setCookie.split(';')[0];
    }
    expect(response.status).toBe(302);
    return response.headers.get('location') ?? '';
  }

  beforeEach(async () => {
    resetAllInjections();
    registerMockService(LoggerService, {
      forContext: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    });
    cookie = '';
    ({ baseUrl, server } = await startServer());
    return () => new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('redirects to the originally requested path after the callback', async () => {
    const loginUrl = await get('/beitreten/ABC123?ref=mail');
    const authorizeUrl = await get(loginUrl);
    const state = new URL(authorizeUrl).searchParams.get('state');

    const finalLocation = await get(`/api/auth/callback?code=c&state=${state}`);

    expect(finalLocation).toBe('/beitreten/ABC123?ref=mail');
  });
});
