/**
 * Integration tests for useAnalogAuthMiddleware against a real h3 server.
 *
 * Regression guard for the 500-instead-of-401 bug: h3 derives the HTTP status
 * only from its own error class, so an unauthenticated API request (the
 * `fetch: true` header comes from the Angular authInterceptor) must answer 401.
 * With a non-h3 error the client receives 500 and never redirects to the login
 * page. Only checkAuthentication is mocked here; h3 and the middleware are real.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineEventHandler, H3Event, toNodeListener } from 'h3';
import { createServer, Server } from 'node:http';
import { registerMockService, resetAllInjections } from '@analog-tools/inject';
import { LoggerService } from '@analog-tools/logger';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import { checkAuthentication } from './checkAuthentication';
import { useAnalogAuthMiddleware } from './useAnalogAuthMiddleware';

vi.mock('@analog-tools/session', () => ({
  updateSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./checkAuthentication');

interface ProbeResponse {
  status: number;
  location: string | null;
  body: string;
}

/**
 * Serves the middleware from a real h3 app. Registering the handler without a
 * path mirrors a Nitro server middleware (apps/*\/src/server/middleware/*.ts).
 */
async function request(
  headers: Record<string, string> = {},
  path = '/api/protected'
): Promise<ProbeResponse> {
  const app = createApp();
  app.use(
    defineEventHandler(async (event: H3Event) => {
      await useAnalogAuthMiddleware(event);
      return { reached: 'route-handler' };
    })
  );

  const server: Server = createServer(toNodeListener(app));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };

  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      headers,
      redirect: 'manual',
    });

    return {
      status: response.status,
      location: response.headers.get('location'),
      body: await response.text(),
    };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('useAnalogAuthMiddleware over HTTP (real h3)', () => {
  beforeEach(() => {
    resetAllInjections();

    registerMockService(OAuthAuthenticationService, {
      initSession: vi.fn().mockResolvedValue(undefined),
      isUnprotectedRoute: vi.fn().mockReturnValue(false),
    });
    registerMockService(LoggerService, {
      forContext: vi.fn().mockReturnValue({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    });

    vi.mocked(checkAuthentication).mockResolvedValue(false);
  });

  it('answers 401 for an unauthenticated API request with fetch:true', async () => {
    const { status, body } = await request({ fetch: 'true' });

    expect(status).toBe(401);
    // The body must not carry the 500 payload h3 emits for unhandled errors.
    expect(body).not.toContain('500');
  });

  it('keeps the redirect to the login page for browser navigations', async () => {
    const { status, location } = await request();

    expect(status).toBe(302);
    expect(location).toBe('/api/auth/login');
  });

  it('lets an authenticated API request with fetch:true reach the route', async () => {
    vi.mocked(checkAuthentication).mockResolvedValue(true);

    const { status } = await request({ fetch: 'true' });

    expect(status).toBe(200);
  });
});
