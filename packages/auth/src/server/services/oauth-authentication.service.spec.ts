import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OAuthAuthenticationService } from './oauth-authentication.service';
import { LoggerService } from '@analog-tools/logger';
import { SessionService } from './session.service';
import type { AnalogAuthConfig } from '../types/auth.types';
import {
  AuthSessionData,
  SessionWithHandler,
} from '../types/auth-session.types';
import { H3Event } from 'h3';
import {
  inject,
  registerMockService,
  registerService,
  resetAllInjections,
} from '@analog-tools/inject';

// Mock the @analog-tools/session functions
vi.mock('@analog-tools/session', () => ({
  getSession: vi.fn(),
  refetchSession: vi.fn(),
  regenerateSession: vi.fn(),
  updateSession: vi.fn(),
}));

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => 'mock-jwks'),
  jwtVerify: vi
    .fn()
    .mockResolvedValue({ payload: { sub: 'user123', nonce: 'test-nonce' } }),
}));

// Import the mocked functions for use in tests
import {
  getSession,
  refetchSession,
  regenerateSession,
  updateSession,
} from '@analog-tools/session';
import { jwtVerify } from 'jose';

// Mock the fetch function
vi.stubGlobal('fetch', vi.fn());
vi.stubGlobal('setTimeout', vi.fn());
vi.stubGlobal('AbortSignal', {
  timeout: vi.fn().mockReturnValue('timeout-signal'),
});

// Mock the h3 module
vi.mock('h3', () => ({
  createError: vi.fn().mockImplementation((errorObj) => {
    const error = new Error(errorObj.message);
    Object.assign(error, errorObj);
    return error;
  }),
}));

describe('OAuthAuthenticationService', () => {
  let service: OAuthAuthenticationService;
  let mockConfig: AnalogAuthConfig;
  let mockSessionService: Partial<SessionService>;
  let mockLoggerService: Partial<LoggerService>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockLogger: any;
  let mockEvent: Partial<H3Event>;
  let mockSessionHandler: Partial<SessionWithHandler>;
  let mockSessionData: Partial<AuthSessionData>;

  // Mock OpenID Configuration response
  const mockOpenIDConfig = {
    issuer: 'https://auth.example.com',
    authorization_endpoint: 'https://auth.example.com/authorize',
    token_endpoint: 'https://auth.example.com/token',
    userinfo_endpoint: 'https://auth.example.com/userinfo',
    end_session_endpoint: 'https://auth.example.com/logout',
    revocation_endpoint: 'https://auth.example.com/revoke',
    jwks_uri: 'https://auth.example.com/jwks',
  };

  beforeEach(() => {
    // Set up mock logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      group: vi.fn(),
      groupEnd: vi.fn(),
    };

    mockLoggerService = {
      forContext: vi.fn().mockImplementation(() => {
        return mockLogger;
      }),
    };

    // Set up mock config
    mockConfig = {
      issuer: 'https://auth.example.com',
      clientId: 'test-client',
      clientSecret: 'test-secret',
      audience: 'test-audience',
      scope: 'openid profile email',
      callbackUri: 'https://app.example.com/callback',
      unprotectedRoutes: ['/api/auth/login', '/api/auth/callback'],
      tokenRefreshApiKey: 'test-refresh-key',
      sessionStorage: {
        prefix: 'prefix',
        ttl: 3600,
        sessionSecret: 'secret',
        driver: {
          type: 'redis',
          options: {
            url: 'redis://localhost:6379',
          },
        },
      },
    };

    // Set up mock session service
    mockSessionService = {
      initSession: vi.fn().mockResolvedValue(undefined),
      getSession: vi.fn(),
      getActiveSessions: vi.fn().mockResolvedValue([]),
    };

    // Set up mock session data
    mockSessionData = {
      auth: {
        isAuthenticated: true,
        accessToken: 'test-access-token',
        idToken: 'test-id-token',
        refreshToken: 'test-refresh-token',
        expiresAt: Date.now() + 3600 * 1000, // 1 hour in the future
        userInfo: {
          sub: 'user123',
          name: 'Test User',
          email: 'test@example.com',
        },
      },
      user: {
        id: 'user123',
        name: 'Test User',
        email: 'test@example.com',
      },
      codeVerifier: 'test-code-verifier',
      nonce: 'test-nonce',
    };

    // Set up mock session handler
    mockSessionHandler = {
      id: 'test-session-id',
      data: mockSessionData as AuthSessionData,
      save: vi.fn().mockResolvedValue(undefined),
      update: vi.fn((updater) => {
        // Get the updated data from the updater function
        const updatedData = updater(mockSessionData as AuthSessionData);

        // Reset mockSessionData to empty object, ensuring deleted properties are removed
        for (const key in mockSessionData) {
          if (Object.prototype.hasOwnProperty.call(mockSessionData, key)) {
            delete mockSessionData[key];
          }
        }

        // Apply the new updated data
        Object.assign(mockSessionData, updatedData);
      }),
    };

    // Set up mock H3Event
    mockEvent = {
      context: {
        sessionHandler: mockSessionHandler,
      },
    };

    // Mock successful fetch responses for different endpoints
    global.fetch = vi.fn().mockImplementation(async (url) => {
      if (url.includes('openid-configuration')) {
        return {
          ok: true,
          json: async () => mockOpenIDConfig,
        };
      }

      if (url === mockOpenIDConfig.token_endpoint) {
        return {
          ok: true,
          json: async () => ({
            access_token: 'new-access-token',
            id_token: 'new-id-token',
            refresh_token: 'new-refresh-token',
            expires_in: 3600,
          }),
        };
      }

      if (url === mockOpenIDConfig.userinfo_endpoint) {
        return {
          ok: true,
          json: async () => ({
            sub: 'user123',
            name: 'Test User',
            email: 'test@example.com',
          }),
        };
      }

      if (url === mockOpenIDConfig.revocation_endpoint) {
        return {
          ok: true,
          json: async () => ({}),
        };
      }

      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Not found' }),
      };
    });

    // Set up session API mocks
    vi.mocked(getSession).mockReturnValue(mockSessionData as AuthSessionData);
    vi.mocked(updateSession).mockImplementation(async (event, updater) => {
      if (typeof updater === 'function') {
        const updates = updater(mockSessionData as AuthSessionData);
        Object.assign(mockSessionData, updates);
      }
    });

    // Create service instance with mock config
    registerMockService(SessionService, mockSessionService);
    registerMockService(LoggerService, mockLoggerService);
    registerService(OAuthAuthenticationService, mockConfig);
    service = inject(OAuthAuthenticationService);
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Reset the inject ServiceRegistry
    resetAllInjections();

    // Reset session mocks
    vi.mocked(getSession).mockReset();
    vi.mocked(updateSession).mockReset();
  });

  describe('constructor', () => {
    it('should initialize with config values', () => {
      expect(service.getConfig()).toEqual(mockConfig);
    });

    it('should inject logger service', () => {
      expect(mockLoggerService.forContext).toHaveBeenCalled();
      expect(mockLoggerService.forContext).toHaveBeenCalledWith(
        'OAuthAuthenticationService'
      );
    });
  });

  describe('validateConfiguration', () => {
    it('should throw error when missing required config values', () => {
      // Create service with incomplete config
      const incompleteConfig: AnalogAuthConfig = {
        issuer: '',
        clientId: 'test-client',
        clientSecret: 'test-secret',
        audience: 'test-audience',
        scope: 'openid profile',
        callbackUri: 'https://app.example.com/callback',
        sessionStorage: {
          prefix: 'prefix',
          ttl: 3600,
          sessionSecret: 'secret',
          driver: {
            type: 'redis',
            options: {
              url: 'redis://localhost:6379',
            },
          },
        },
      };

      const invalidService = new OAuthAuthenticationService(incompleteConfig);

      // getConfig calls validateConfiguration internally
      expect(() => invalidService.getConfig()).toThrow(
        /not properly initialized/
      );
    });
  });

  describe('initSession', () => {
    it('should initialize session using SessionService', async () => {
      await service.initSession(mockEvent as H3Event);

      expect(mockSessionService.initSession).toHaveBeenCalledWith(mockEvent);
    });
  });

  describe('isUnprotectedRoute', () => {
    it('should return true for exact routes in unprotectedRoutes', () => {
      expect(service.isUnprotectedRoute('/api/auth/login')).toBe(true);
      expect(service.isUnprotectedRoute('/api/auth/callback')).toBe(true);
    });

    it('should return false for routes with additional paths when no wildcard', () => {
      expect(service.isUnprotectedRoute('/api/auth/login/extra')).toBe(false);
      expect(service.isUnprotectedRoute('/api/auth/callback/something')).toBe(
        false
      );
    });

    it('should return false for protected routes', () => {
      expect(service.isUnprotectedRoute('/api/protected')).toBe(false);
      expect(service.isUnprotectedRoute('/dashboard')).toBe(false);
    });

    it('should handle wildcard routes correctly', () => {
      // Create a service with wildcard routes for testing
      const wildcardConfig = {
        ...mockConfig,
        unprotectedRoutes: ['/api/public/*', '/static/*', '/exact-route'],
      };

      const wildcardService = new OAuthAuthenticationService(wildcardConfig);

      // Wildcard routes should match subpaths but not the exact prefix or just trailing slash
      expect(wildcardService.isUnprotectedRoute('/api/public')).toBe(false);
      expect(wildcardService.isUnprotectedRoute('/api/public/')).toBe(false);
      expect(wildcardService.isUnprotectedRoute('/api/public/images')).toBe(
        true
      );
      expect(
        wildcardService.isUnprotectedRoute('/api/public/css/style.css')
      ).toBe(true);

      expect(wildcardService.isUnprotectedRoute('/static')).toBe(false);
      expect(wildcardService.isUnprotectedRoute('/static/')).toBe(false);
      expect(
        wildcardService.isUnprotectedRoute('/static/images/logo.png')
      ).toBe(true);

      // Exact routes should work as expected
      expect(wildcardService.isUnprotectedRoute('/exact-route')).toBe(true);
      expect(wildcardService.isUnprotectedRoute('/exact-route/extra')).toBe(
        false
      );
    });

    it('should handle exact routes with trailing slash normalization', () => {
      const trailingSlashConfig = {
        ...mockConfig,
        unprotectedRoutes: ['/api/public', '/dashboard/'],
      };

      const trailingSlashService = new OAuthAuthenticationService(
        trailingSlashConfig
      );

      // Both routes should match with and without trailing slash
      expect(trailingSlashService.isUnprotectedRoute('/api/public')).toBe(true);
      expect(trailingSlashService.isUnprotectedRoute('/api/public/')).toBe(
        true
      );
      expect(trailingSlashService.isUnprotectedRoute('/dashboard')).toBe(true);
      expect(trailingSlashService.isUnprotectedRoute('/dashboard/')).toBe(true);

      // But not subpaths
      expect(trailingSlashService.isUnprotectedRoute('/api/public/sub')).toBe(
        false
      );
      expect(trailingSlashService.isUnprotectedRoute('/dashboard/sub')).toBe(
        false
      );
    });

    it('should handle edge cases for wildcard matching', () => {
      const edgeConfig = {
        ...mockConfig,
        unprotectedRoutes: ['/test/*', '/'],
      };

      const edgeService = new OAuthAuthenticationService(edgeConfig);

      // Root path should match exactly
      expect(edgeService.isUnprotectedRoute('/')).toBe(true);
      expect(edgeService.isUnprotectedRoute('/home')).toBe(false);

      // Wildcard should require actual content, not just empty or trailing slash
      expect(edgeService.isUnprotectedRoute('/test')).toBe(false);
      expect(edgeService.isUnprotectedRoute('/test/')).toBe(false);
      expect(edgeService.isUnprotectedRoute('/test/a')).toBe(true);
    });

    it('should return false when unprotectedRoutes is not an array', () => {
      const invalidConfig = {
        ...mockConfig,
        unprotectedRoutes: undefined as unknown as string[],
      };

      const invalidService = new OAuthAuthenticationService(invalidConfig);
      expect(invalidService.isUnprotectedRoute('/api/auth/login')).toBe(false);
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should generate OAuth authorization URL with correct parameters', async () => {
      const url = await service.getAuthorizationUrl({
        state: 'test-state',
        codeChallenge: 'test-challenge',
        nonce: 'test-nonce',
        redirectUri: 'https://custom-redirect.com',
      });

      expect(url).toContain(mockOpenIDConfig.authorization_endpoint);
      expect(url).toContain('client_id=test-client');
      expect(url).toContain('redirect_uri=https%3A%2F%2Fcustom-redirect.com');
      expect(url).toContain('scope=openid+profile+email');
      expect(url).toContain('audience=test-audience');
      expect(url).toContain('state=test-state');
      expect(url).toContain('response_type=code');
      expect(url).toContain('nonce=test-nonce');
      expect(url).toContain('code_challenge=test-challenge');
      expect(url).toContain('code_challenge_method=S256');
    });

    it('should use default callbackUri when redirect is not provided', async () => {
      const url = await service.getAuthorizationUrl({
        state: 'test-state',
        codeChallenge: 'c',
        nonce: 'n',
      });

      expect(url).toContain(
        `redirect_uri=${encodeURIComponent(mockConfig.callbackUri)}`
      );
    });

    it('should fetch and cache OpenID configuration', async () => {
      await service.getAuthorizationUrl({
        state: 'test-state',
        codeChallenge: 'c',
        nonce: 'n',
      });

      // First call should fetch the config
      expect(global.fetch).toHaveBeenCalledWith(
        'https://auth.example.com/.well-known/openid-configuration',
        { redirect: 'error', signal: 'timeout-signal' }
      );

      // Reset fetch mock to verify caching
      vi.mocked(global.fetch).mockClear();

      await service.getAuthorizationUrl({
        state: 'another-state',
        codeChallenge: 'c',
        nonce: 'n',
      });

      // Second call should use cached config
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should default the discovery fetch timeout to 10s', async () => {
      await service.getAuthorizationUrl({
        state: 'test-state',
        codeChallenge: 'c',
        nonce: 'n',
      });

      expect(AbortSignal.timeout).toHaveBeenCalledWith(10000);
    });

    it('should use discoveryTimeoutMs from config when set', async () => {
      Object.defineProperty(service, 'config', {
        value: { ...mockConfig, discoveryTimeoutMs: 3000 },
        writable: true,
      });

      await service.getAuthorizationUrl({
        state: 'test-state',
        codeChallenge: 'c',
        nonce: 'n',
      });

      expect(AbortSignal.timeout).toHaveBeenCalledWith(3000);
    });
  });

  describe('OpenID configuration validation', () => {
    it('should reject a non-https issuer (except localhost)', async () => {
      Object.defineProperty(service, 'config', {
        value: { ...mockConfig, issuer: 'http://insecure.example.com' },
        writable: true,
      });

      await expect(service.getAuthorizationUrl({ state: 'state', codeChallenge: 'c', nonce: 'n' })).rejects.toThrow(
        /issuer must use https/
      );
      // Never even contacts the provider.
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should allow an http issuer on localhost (development)', async () => {
      Object.defineProperty(service, 'config', {
        value: { ...mockConfig, issuer: 'http://localhost:8080/realms/dev' },
        writable: true,
      });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          issuer: 'http://localhost:8080/realms/dev',
          authorization_endpoint: 'http://localhost:8080/authorize',
          token_endpoint: 'http://localhost:8080/token',
          userinfo_endpoint: 'http://localhost:8080/userinfo',
          end_session_endpoint: 'http://localhost:8080/logout',
          revocation_endpoint: 'http://localhost:8080/revoke',
        }),
      });

      await expect(service.getAuthorizationUrl({ state: 'state', codeChallenge: 'c', nonce: 'n' })).resolves.toContain(
        'http://localhost:8080/authorize'
      );
    });

    it('should reject a discovery document whose issuer does not match', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...mockOpenIDConfig,
          issuer: 'https://evil.example.com',
        }),
      });

      await expect(service.getAuthorizationUrl({ state: 'state', codeChallenge: 'c', nonce: 'n' })).rejects.toThrow(
        /issuer does not match/
      );
    });

    it('should reject a discovery document advertising a non-https endpoint', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...mockOpenIDConfig,
          token_endpoint: 'http://evil.example.com/token',
        }),
      });

      await expect(service.getAuthorizationUrl({ state: 'state', codeChallenge: 'c', nonce: 'n' })).rejects.toThrow(
        /token_endpoint must use https/
      );
    });

    it('should reject an http localhost endpoint when the issuer is https', async () => {
      // The localhost exception must be tied to a localhost issuer, not applied
      // per-endpoint: a production https issuer must not fetch/POST over http.
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...mockOpenIDConfig,
          token_endpoint: 'http://localhost:9999/token',
        }),
      });

      await expect(service.getAuthorizationUrl({ state: 'state', codeChallenge: 'c', nonce: 'n' })).rejects.toThrow(
        /token_endpoint must use https/
      );
    });

    it('should allow an http issuer on an IPv4 loopback address (development)', async () => {
      Object.defineProperty(service, 'config', {
        value: { ...mockConfig, issuer: 'http://127.0.0.2:8080/realms/dev' },
        writable: true,
      });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          issuer: 'http://127.0.0.2:8080/realms/dev',
          authorization_endpoint: 'http://127.0.0.2:8080/authorize',
          token_endpoint: 'http://127.0.0.2:8080/token',
          userinfo_endpoint: 'http://127.0.0.2:8080/userinfo',
          end_session_endpoint: 'http://127.0.0.2:8080/logout',
          revocation_endpoint: 'http://127.0.0.2:8080/revoke',
        }),
      });

      await expect(service.getAuthorizationUrl({ state: 'state', codeChallenge: 'c', nonce: 'n' })).resolves.toContain(
        'http://127.0.0.2:8080/authorize'
      );
    });

    it('should reject a discovery fetch that is redirected', async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(service.getAuthorizationUrl({ state: 'state', codeChallenge: 'c', nonce: 'n' })).rejects.toThrow(
        /Failed to fetch OpenID configuration/
      );
    });

    it('should reject a discovery document missing a required endpoint', async () => {
      const { token_endpoint: _token_endpoint, ...incompleteConfig } =
        mockOpenIDConfig;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => incompleteConfig,
      });

      await expect(service.getAuthorizationUrl({ state: 'state', codeChallenge: 'c', nonce: 'n' })).rejects.toThrow(
        /missing token_endpoint/
      );

      // The incomplete document must not have been cached: a valid response
      // is still fetched and used on the next call.
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockOpenIDConfig,
      });
      await expect(service.getAuthorizationUrl({ state: 'state', codeChallenge: 'c', nonce: 'n' })).resolves.toContain(
        mockOpenIDConfig.authorization_endpoint
      );
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true for authenticated session with valid token', async () => {
      const result = await service.isAuthenticated(mockEvent as H3Event);

      expect(result).toBe(true);
      expect(mockSessionService.initSession).toHaveBeenCalled();
    });

    it('should initialize auth object if missing', async () => {
      // Remove auth from session data
      delete mockSessionData.auth;

      const result = await service.isAuthenticated(mockEvent as H3Event);

      expect(result).toBe(false);
      expect(updateSession).toHaveBeenCalled();
      expect(mockSessionData.auth).toEqual({ isAuthenticated: false });
    });

    it('should return false for session with auth.isAuthenticated = false', async () => {
      mockSessionData.auth = { isAuthenticated: false };

      const result = await service.isAuthenticated(mockEvent as H3Event);

      expect(result).toBe(false);
    });

    it('should refresh token if it is expired', async () => {
      // Reset fetch mock
      vi.mocked(global.fetch).mockReset();

      // Set token to be expired
      mockSessionData.auth = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(mockSessionData.auth as any),
        expiresAt: Date.now() - 1000, // 1 second in the past
        refreshToken: 'test-refresh-token',
      };

      // Mock the OpenID config response
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenIDConfig,
      } as Response);

      // Mock the token refresh response
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          id_token: 'new-id-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
        }),
      } as Response);

      const result = await service.isAuthenticated(mockEvent as H3Event);

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2); // Once for OpenID config, once for token refresh
      expect(global.fetch).toHaveBeenNthCalledWith(
        2, // Second call is token refresh
        mockOpenIDConfig.token_endpoint,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
          body: expect.stringContaining('grant_type=refresh_token'),
        })
      );

      // Check the request body contains all required parameters
      const tokenCallArgs = vi.mocked(global.fetch).mock.calls[1][1];
      const body = tokenCallArgs?.body as string;
      expect(body).toContain('grant_type=refresh_token');
      expect(body).toContain('client_id=test-client');
      expect(body).toContain('client_secret=test-secret');
      expect(body).toContain('refresh_token=test-refresh-token');

      expect(updateSession).toHaveBeenCalled();
      expect(mockSessionData.auth?.accessToken).toBe('new-access-token');
    });

    it('should return false if token refresh fails', async () => {
      // Reset fetch mock
      vi.mocked(global.fetch).mockReset();

      // Set token to be expired
      mockSessionData.auth = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(mockSessionData.auth as any),
        expiresAt: Date.now() - 1000, // 1 second in the past
        refreshToken: 'test-refresh-token',
      };

      // Mock the OpenID config response
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenIDConfig,
      } as Response);

      // Mock token refresh failure
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'invalid_grant' }),
      } as Response);

      const result = await service.isAuthenticated(mockEvent as H3Event);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error refreshing token',
        expect.any(Error)
      );
      expect(mockSessionData.auth?.isAuthenticated).toBe(false);
    });

    it('should trigger background refresh for tokens nearing expiration', async () => {
      // Clear previous fetch calls and timeouts
      vi.mocked(global.fetch).mockReset();
      vi.mocked(setTimeout).mockClear();

      // Set token to expire soon but not yet expired
      const fiveMinutesInMs = 5 * 60 * 1000;
      mockSessionData.auth = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(mockSessionData.auth as any),
        expiresAt: Date.now() + fiveMinutesInMs - 1000, // Just inside refresh window
        refreshToken: 'test-refresh-token',
      };

      const result = await service.isAuthenticated(mockEvent as H3Event);

      expect(result).toBe(true);
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 0);
    });

    it('should dedupe concurrent refresh requests for same expired session token', async () => {
      // Reset fetch mock
      vi.mocked(global.fetch).mockReset();

      const expiredAuth = {
        ...(mockSessionData.auth as NonNullable<AuthSessionData['auth']>),
        isAuthenticated: true,
        expiresAt: Date.now() - 1000,
        refreshToken: 'shared-refresh-token',
      };

      let resolveRefresh!: (value: unknown) => void;
      const refreshPromise = new Promise((resolve) => {
        resolveRefresh = resolve;
      });

      // Signals when the token-endpoint fetch actually starts waiting, so
      // the test can release it deterministically instead of relying on
      // both isAuthenticated() calls having reached that point by the time
      // this synchronous test body continues.
      let signalTokenFetchStarted: () => void;
      const tokenFetchStarted = new Promise<void>((resolve) => {
        signalTokenFetchStarted = resolve;
      });

      vi.mocked(global.fetch)
        .mockResolvedValue({
          ok: true,
          json: async () => mockOpenIDConfig,
        } as Response)
        .mockImplementation(async (url) => {
          if (url === mockOpenIDConfig.token_endpoint) {
            signalTokenFetchStarted();
            await refreshPromise;
            return {
              ok: true,
              json: async () => ({
                access_token: 'new-access-token',
                id_token: 'new-id-token',
                refresh_token: 'new-refresh-token',
                expires_in: 3600,
              }),
            } as Response;
          }

          return {
            ok: true,
            json: async () => mockOpenIDConfig,
          } as Response;
        });

      const currentSession = {
        ...mockSessionData,
        auth: expiredAuth,
      } as AuthSessionData;
      vi.mocked(getSession).mockReturnValue(currentSession);

      const first = service.isAuthenticated(mockEvent as H3Event);
      const second = service.isAuthenticated(mockEvent as H3Event);

      await tokenFetchStarted;
      resolveRefresh(undefined);

      const [firstResult, secondResult] = await Promise.all([first, second]);

      expect(firstResult).toBe(true);
      expect(secondResult).toBe(true);

      const tokenCalls = vi
        .mocked(global.fetch)
        .mock.calls.filter(([url]) => url === mockOpenIDConfig.token_endpoint);
      expect(tokenCalls).toHaveLength(1);
    });

    it('should not mark session unauthenticated if latest session already has valid token after refresh error', async () => {
      vi.mocked(global.fetch).mockReset();

      const now = Date.now();
      const staleExpiredSession = {
        ...mockSessionData,
        auth: {
          ...(mockSessionData.auth as NonNullable<AuthSessionData['auth']>),
          isAuthenticated: true,
          refreshToken: 'stale-refresh-token',
          expiresAt: now - 1000,
        },
      } as AuthSessionData;

      const latestValidSession = {
        ...mockSessionData,
        auth: {
          ...(mockSessionData.auth as NonNullable<AuthSessionData['auth']>),
          isAuthenticated: true,
          refreshToken: 'fresh-refresh-token',
          expiresAt: now + 60_000,
        },
      } as AuthSessionData;

      vi.mocked(getSession).mockReturnValue(staleExpiredSession);
      // Simulates a concurrent request having already refreshed the token
      // and written it to storage - only a real storage read (refetchSession)
      // can see this, not the request-scoped getSession(event).
      vi.mocked(refetchSession).mockResolvedValue(latestValidSession);

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockOpenIDConfig,
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ error: 'invalid_grant' }),
        } as Response);

      const result = await service.isAuthenticated(mockEvent as H3Event);

      expect(refetchSession).toHaveBeenCalledWith(mockEvent);
      expect(result).toBe(true);
      expect(mockSessionData.auth?.isAuthenticated).toBe(true);
    });
  });

  describe('getAuthenticatedUser', () => {
    it('should return user info when authenticated', async () => {
      // Mock isAuthenticated to return true
      vi.spyOn(service, 'isAuthenticated').mockResolvedValue(true);

      const user = await service.getAuthenticatedUser(mockEvent as H3Event);

      expect(user).toEqual(mockSessionData.auth?.userInfo);
      expect(service.isAuthenticated).toHaveBeenCalledWith(mockEvent);
    });

    it('should return null when not authenticated', async () => {
      // Mock isAuthenticated to return false
      vi.spyOn(service, 'isAuthenticated').mockResolvedValue(false);

      const user = await service.getAuthenticatedUser(mockEvent as H3Event);

      expect(user).toBeNull();
    });

    it('should use userHandler.mapUserToLocal if provided', async () => {
      // Mock isAuthenticated to return true
      vi.spyOn(service, 'isAuthenticated').mockResolvedValue(true);

      // Add userHandler with mapUserToLocal function
      const mappedUser = { id: 'mapped-id', name: 'Mapped Name' };
      const userHandler = {
        mapUserToLocal: vi.fn().mockReturnValue(mappedUser),
      };

      // Set userHandler in service config
      Object.defineProperty(service, 'config', {
        value: { ...mockConfig, userHandler },
        writable: true,
      });

      const user = await service.getAuthenticatedUser(mockEvent as H3Event);

      expect(user).toEqual(mappedUser);
      expect(userHandler.mapUserToLocal).toHaveBeenCalledWith(
        mockSessionData.auth?.userInfo
      );
    });
  });

  describe('handleCallback', () => {
    const mockCode = 'auth-code-123';
    const mockState = 'state-456';

    it('should not invalidate other authenticated sessions by default', async () => {
      const currentSessionId = 'current-session-id';
      mockEvent.context = {
        ...(mockEvent.context ?? {}),
        __session_id__: currentSessionId,
      };

      const otherSessionForSameUser = {
        id: 'other-session-id',
        data: {
          auth: {
            isAuthenticated: true,
            userInfo: { sub: 'user123' },
          },
          user: { id: 'user123' },
        },
        update: vi.fn(),
        save: vi.fn().mockResolvedValue(undefined),
      } as unknown as SessionWithHandler;

      const unrelatedSession = {
        id: 'unrelated-session-id',
        data: {
          auth: {
            isAuthenticated: true,
            userInfo: { sub: 'another-user' },
          },
          user: { id: 'another-user' },
        },
        update: vi.fn(),
        save: vi.fn().mockResolvedValue(undefined),
      } as unknown as SessionWithHandler;

      mockSessionService.getActiveSessions = vi
        .fn()
        .mockResolvedValue([otherSessionForSameUser, unrelatedSession]);

      await service.handleCallback(mockEvent as H3Event, mockCode, mockState);

      expect(mockSessionService.getActiveSessions).not.toHaveBeenCalled();
      expect(otherSessionForSameUser.update).not.toHaveBeenCalled();
      expect(otherSessionForSameUser.save).not.toHaveBeenCalled();
      expect(unrelatedSession.update).not.toHaveBeenCalled();
      expect(unrelatedSession.save).not.toHaveBeenCalled();
    });

    it('should invalidate other authenticated sessions for the same user when singleSessionPerUser is enabled', async () => {
      const currentSessionId = 'current-session-id';
      mockEvent.context = {
        ...(mockEvent.context ?? {}),
        __session_id__: currentSessionId,
      };

      Object.defineProperty(service, 'config', {
        value: { ...mockConfig, singleSessionPerUser: true },
        writable: true,
      });

      const otherSessionForSameUser = {
        id: 'other-session-id',
        data: {
          auth: {
            isAuthenticated: true,
            userInfo: { sub: 'user123' },
          },
          user: { id: 'user123' },
        },
        update: vi.fn(),
        save: vi.fn().mockResolvedValue(undefined),
      } as unknown as SessionWithHandler;

      const unrelatedSession = {
        id: 'unrelated-session-id',
        data: {
          auth: {
            isAuthenticated: true,
            userInfo: { sub: 'another-user' },
          },
          user: { id: 'another-user' },
        },
        update: vi.fn(),
        save: vi.fn().mockResolvedValue(undefined),
      } as unknown as SessionWithHandler;

      mockSessionService.getActiveSessions = vi
        .fn()
        .mockResolvedValue([otherSessionForSameUser, unrelatedSession]);

      await service.handleCallback(mockEvent as H3Event, mockCode, mockState);

      expect(otherSessionForSameUser.update).toHaveBeenCalledTimes(1);
      expect(otherSessionForSameUser.save).toHaveBeenCalledTimes(1);
      expect(unrelatedSession.update).not.toHaveBeenCalled();
      expect(unrelatedSession.save).not.toHaveBeenCalled();
    });

    it('should not fail login when invalidating other user sessions throws', async () => {
      const currentSessionId = 'current-session-id';
      mockEvent.context = {
        ...(mockEvent.context ?? {}),
        __session_id__: currentSessionId,
      };

      Object.defineProperty(service, 'config', {
        value: { ...mockConfig, singleSessionPerUser: true },
        writable: true,
      });

      mockSessionService.getActiveSessions = vi
        .fn()
        .mockRejectedValue(new Error('storage unavailable'));

      await expect(
        service.handleCallback(mockEvent as H3Event, mockCode, mockState)
      ).resolves.not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to invalidate other user sessions',
        expect.any(Error)
      );
    });

    it('should exchange code for tokens and store in session', async () => {
      // Mock successful responses
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockOpenIDConfig,
        }) // OpenID config
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'new-access-token',
            id_token: 'new-id-token',
            refresh_token: 'new-refresh-token',
            expires_in: 3600,
          }),
        }) // Token exchange
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sub: 'user123',
            name: 'Test User',
            email: 'test@example.com',
          }),
        }); // User info

      const result = await service.handleCallback(
        mockEvent as H3Event,
        mockCode,
        mockState
      );

      expect(global.fetch).toHaveBeenCalledWith(
        mockOpenIDConfig.token_endpoint,
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(`code=${mockCode}`),
        })
      );

      expect(global.fetch).toHaveBeenCalledWith(
        mockOpenIDConfig.userinfo_endpoint,
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer new-access-token',
          },
        })
      );

      expect(updateSession).toHaveBeenCalled();

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');

      expect(mockSessionData.auth).toEqual(
        expect.objectContaining({
          isAuthenticated: true,
          accessToken: 'new-access-token',
          idToken: 'new-id-token',
          refreshToken: 'new-refresh-token',
        })
      );

      // Session fixation: the id is regenerated on login, before the
      // authenticated tokens are written.
      expect(regenerateSession).toHaveBeenCalledWith(mockEvent);
      expect(
        vi.mocked(regenerateSession).mock.invocationCallOrder[0]
      ).toBeLessThan(
        vi.mocked(updateSession).mock.invocationCallOrder.at(-1) as number
      );
    });

    it('should reject when the ID token nonce does not match the session', async () => {
      vi.mocked(jwtVerify).mockResolvedValueOnce({
        payload: { sub: 'user123', nonce: 'attacker-nonce' },
        protectedHeader: { alg: 'RS256' },
      } as unknown as Awaited<ReturnType<typeof jwtVerify>>);

      await expect(
        service.handleCallback(mockEvent as H3Event, mockCode, mockState)
      ).rejects.toEqual(
        expect.objectContaining({ statusCode: 401 })
      );
    });

    it('should reject when the ID token subject does not match userinfo', async () => {
      vi.mocked(jwtVerify).mockResolvedValueOnce({
        payload: { sub: 'someone-else', nonce: 'test-nonce' },
        protectedHeader: { alg: 'RS256' },
      } as unknown as Awaited<ReturnType<typeof jwtVerify>>);

      await expect(
        service.handleCallback(mockEvent as H3Event, mockCode, mockState)
      ).rejects.toEqual(
        expect.objectContaining({ statusCode: 401 })
      );
    });

    it('should reject when the ID token has no subject', async () => {
      vi.mocked(jwtVerify).mockResolvedValueOnce({
        payload: { nonce: 'test-nonce' },
        protectedHeader: { alg: 'RS256' },
      } as unknown as Awaited<ReturnType<typeof jwtVerify>>);

      await expect(
        service.handleCallback(mockEvent as H3Event, mockCode, mockState)
      ).rejects.toEqual(expect.objectContaining({ statusCode: 401 }));
    });

    it('should accept a correct at_hash bound to the access token', async () => {
      vi.mocked(jwtVerify).mockResolvedValueOnce({
        payload: {
          sub: 'user123',
          nonce: 'test-nonce',
          at_hash: 'JbQWw3PiR3aMwaPtSiChOA', // sha256('new-access-token') left half, base64url
        },
        protectedHeader: { alg: 'RS256' },
      } as unknown as Awaited<ReturnType<typeof jwtVerify>>);

      await expect(
        service.handleCallback(mockEvent as H3Event, mockCode, mockState)
      ).resolves.toHaveProperty('user');
    });

    it('should reject when at_hash does not match the access token', async () => {
      vi.mocked(jwtVerify).mockResolvedValueOnce({
        payload: {
          sub: 'user123',
          nonce: 'test-nonce',
          at_hash: 'not-the-right-hash',
        },
        protectedHeader: { alg: 'RS256' },
      } as unknown as Awaited<ReturnType<typeof jwtVerify>>);

      await expect(
        service.handleCallback(mockEvent as H3Event, mockCode, mockState)
      ).rejects.toEqual(expect.objectContaining({ statusCode: 401 }));
    });

    it('should reject an at_hash claim when the signing alg has no known digest', async () => {
      vi.mocked(jwtVerify).mockResolvedValueOnce({
        payload: {
          sub: 'user123',
          nonce: 'test-nonce',
          at_hash: 'JbQWw3PiR3aMwaPtSiChOA',
        },
        protectedHeader: { alg: 'none' },
      } as unknown as Awaited<ReturnType<typeof jwtVerify>>);

      await expect(
        service.handleCallback(mockEvent as H3Event, mockCode, mockState)
      ).rejects.toEqual(expect.objectContaining({ statusCode: 401 }));
    });

    it('should reject an azp claim that does not match the client ID', async () => {
      vi.mocked(jwtVerify).mockResolvedValueOnce({
        payload: { sub: 'user123', nonce: 'test-nonce', azp: 'other-client' },
        protectedHeader: { alg: 'RS256' },
      } as unknown as Awaited<ReturnType<typeof jwtVerify>>);

      await expect(
        service.handleCallback(mockEvent as H3Event, mockCode, mockState)
      ).rejects.toEqual(expect.objectContaining({ statusCode: 401 }));
    });

    it('should accept an ID token whose azp matches the client ID', async () => {
      vi.mocked(jwtVerify).mockResolvedValueOnce({
        payload: { sub: 'user123', nonce: 'test-nonce', azp: 'test-client' },
        protectedHeader: { alg: 'RS256' },
      } as unknown as Awaited<ReturnType<typeof jwtVerify>>);

      await expect(
        service.handleCallback(mockEvent as H3Event, mockCode, mockState)
      ).resolves.toHaveProperty('user');
    });

    it('should reject a missing id_token when the configured scope includes openid', async () => {
      vi.mocked(global.fetch).mockImplementation(async (url) => {
        if (String(url).includes('openid-configuration')) {
          return { ok: true, json: async () => mockOpenIDConfig } as Response;
        }
        if (url === mockOpenIDConfig.token_endpoint) {
          return {
            ok: true,
            json: async () => ({
              access_token: 'new-access-token',
              refresh_token: 'new-refresh-token',
              expires_in: 3600,
            }),
          } as Response;
        }
        return { ok: false, status: 404, statusText: 'Not Found' } as Response;
      });

      await expect(
        service.handleCallback(mockEvent as H3Event, mockCode, mockState)
      ).rejects.toEqual(expect.objectContaining({ statusCode: 401 }));
    });

    it('should reject an http jwks_uri when the issuer is https', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...mockOpenIDConfig,
            jwks_uri: 'http://localhost:9999/jwks',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      await expect(
        service.handleCallback(mockEvent as H3Event, mockCode, mockState)
      ).rejects.toEqual(expect.objectContaining({ statusCode: 500 }));
    });

    it('should verify the ID token against the issuer normalized the same way as discovery', async () => {
      // A trailing slash on the configured issuer must not desync issuer
      // matching between discovery validation and ID-token verification.
      Object.defineProperty(service, 'config', {
        value: { ...mockConfig, issuer: 'https://auth.example.com/' },
        writable: true,
      });

      await service.handleCallback(mockEvent as H3Event, mockCode, mockState);

      expect(jwtVerify).toHaveBeenCalledWith(
        'new-id-token',
        'mock-jwks',
        expect.objectContaining({ issuer: 'https://auth.example.com' })
      );
    });

    it('should reject when PKCE verifier / nonce are missing from the session', async () => {
      vi.mocked(getSession).mockReturnValue({
        ...mockSessionData,
        codeVerifier: undefined,
        nonce: undefined,
      } as AuthSessionData);

      await expect(
        service.handleCallback(mockEvent as H3Event, mockCode, mockState)
      ).rejects.toEqual(
        expect.objectContaining({ statusCode: 400 })
      );
    });

    it('should use userHandler.createOrUpdateUser if provided', async () => {
      // Add userHandler with createOrUpdateUser function
      const userHandler = {
        createOrUpdateUser: vi.fn().mockResolvedValue({
          id: 'db-user-123',
          name: 'Database User',
          roles: ['user'],
        }),
      };

      // Set userHandler in service config
      Object.defineProperty(service, 'config', {
        value: { ...mockConfig, userHandler },
        writable: true,
      });

      await service.handleCallback(mockEvent as H3Event, mockCode, mockState);

      expect(userHandler.createOrUpdateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user123',
        })
      );

      expect(mockSessionData.user).toEqual({
        id: 'db-user-123',
        name: 'Database User',
        roles: ['user'],
      });
    });

    it('should throw error when code exchange fails', async () => {
      // Mock token endpoint failure
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockOpenIDConfig,
        }) // OpenID config
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ error: 'invalid_grant' }),
        }); // Token exchange failure

      await expect(
        service.handleCallback(mockEvent as H3Event, mockCode, mockState)
      ).rejects.toHaveProperty('statusCode', 401);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error exchanging code for tokens',
        expect.any(Object)
      );
    });

    it('should throw error when user info request fails', async () => {
      // Mock userinfo endpoint failure
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockOpenIDConfig,
        }) // OpenID config
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'new-access-token',
            id_token: 'new-id-token',
            refresh_token: 'new-refresh-token',
            expires_in: 3600,
          }),
        }) // Token exchange success
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ error: 'invalid_token' }),
        }); // User info failure

      await expect(
        service.handleCallback(mockEvent as H3Event, mockCode, mockState)
      ).rejects.toHaveProperty('statusCode', 401);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error getting user info',
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('logout', () => {
    beforeEach(() => {
      // Reset fetch mock for logout tests
      vi.mocked(global.fetch).mockReset();

      // Mock the OpenID config response
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenIDConfig,
      } as Response);

      // Mock token revocation responses
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);
    });

    it('should revoke tokens and clear session', async () => {
      const logoutUrl = await service.logout(mockEvent as H3Event);

      // We expect 3 fetch calls: OpenID config + 2 token revocations
      expect(global.fetch).toHaveBeenCalledTimes(3);

      // Check access token revocation
      const [accessTokenCallInput, accessTokenCallInit] = vi.mocked(
        global.fetch
      ).mock.calls[1];
      expect(accessTokenCallInput).toBe(mockOpenIDConfig.revocation_endpoint);
      const accessTokenBody = accessTokenCallInit?.body as URLSearchParams;
      expect(accessTokenBody.get('client_id')).toBe('test-client');
      expect(accessTokenBody.get('client_secret')).toBe('test-secret');
      expect(accessTokenBody.get('token')).toBe('test-access-token');

      // Check refresh token revocation
      const [refreshTokenCallInput, refreshTokenCallInit] = vi.mocked(
        global.fetch
      ).mock.calls[2];
      expect(refreshTokenCallInput).toBe(mockOpenIDConfig.revocation_endpoint);
      const refreshTokenBody = refreshTokenCallInit?.body as URLSearchParams;
      expect(refreshTokenBody.get('client_id')).toBe('test-client');
      expect(refreshTokenBody.get('client_secret')).toBe('test-secret');
      expect(refreshTokenBody.get('token')).toBe('test-refresh-token');

      // Check session update
      expect(updateSession).toHaveBeenCalled();

      expect(mockSessionData.auth).toEqual({ isAuthenticated: false });
      expect(mockSessionData.user).toBeNull();

      // Check logout URL
      expect(logoutUrl).toBe(
        `${mockOpenIDConfig.end_session_endpoint}?client_id=test-client`
      );
    });

    it('should include returnTo parameter in logout URL if AUTH_LOGOUT_URL is set', async () => {
      registerMockService(
        OAuthAuthenticationService,
        new OAuthAuthenticationService({
          ...mockConfig,
          logoutUrl: 'https://example.com/after-logout',
        })
      );

      service = inject(OAuthAuthenticationService);
      // Set the environment variable for this test
      const logoutUrl = await service.logout(mockEvent as H3Event);

      // Check logout URL includes returnTo parameter
      expect(logoutUrl).toBe(
        `${mockOpenIDConfig.end_session_endpoint}?client_id=test-client&returnTo=https%3A%2F%2Fexample.com%2Fafter-logout`
      );
    });

    it('should handle token revocation failures gracefully', async () => {
      // Mock revocation endpoint failure
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockOpenIDConfig,
        }) // OpenID config
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ error: 'invalid_token' }),
        }) // First revocation failure
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ error: 'invalid_token' }),
        }); // Second revocation failure

      const logoutUrl = await service.logout(mockEvent as H3Event);

      // Should log errors but not throw
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to revoke access token',
        expect.any(Object)
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to revoke refresh token',
        expect.any(Object)
      );

      // Should still clear session and return logout URL
      expect(mockSessionData.auth).toEqual({ isAuthenticated: false });
      expect(logoutUrl).toBe(
        `${mockOpenIDConfig.end_session_endpoint}?client_id=test-client`
      );
    });
  });

  describe('refreshExpiringTokens', () => {
    it('should refresh tokens that are about to expire', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          data: {
            auth: {
              isAuthenticated: true,
              accessToken: 'access-1',
              refreshToken: 'refresh-1',
              expiresAt: Date.now() + 60 * 1000, // 1 minute from now
            },
          },
          update: vi.fn(),
          save: vi.fn().mockResolvedValue(undefined),
          refetch: vi.fn().mockResolvedValue(null),
        },
        {
          id: 'session-2',
          data: {
            auth: {
              isAuthenticated: true,
              accessToken: 'access-2',
              refreshToken: 'refresh-2',
              expiresAt: Date.now() + 120 * 1000, // 30 seconds from now
            },
          },
          update: vi.fn(),
          save: vi.fn().mockResolvedValue(undefined),
          refetch: vi.fn().mockResolvedValue(null),
        },
      ];

      mockSessionService.getActiveSessions = vi
        .fn()
        .mockResolvedValue(mockSessions);

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenIDConfig,
      } as Response);

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token-1',
          refresh_token: 'new-refresh-token-1',
          expires_in: 3600,
        }),
      } as Response);

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token-2',
          refresh_token: 'new-refresh-token-2',
          expires_in: 3600,
        }),
      } as Response);

      const result = await service.refreshExpiringTokens();

      expect(result).toEqual({
        refreshed: 2,
        failed: 0,
        total: 2,
      });

      expect(mockSessions[0].update).toHaveBeenCalled();
      expect(mockSessions[0].save).toHaveBeenCalled();
      expect(mockSessions[1].update).toHaveBeenCalled();
      expect(mockSessions[1].save).toHaveBeenCalled();
    });

    it('should handle token refresh failures', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          data: {
            auth: {
              isAuthenticated: true,
              accessToken: 'access-1',
              refreshToken: 'refresh-1',
              expiresAt: Date.now() + 60 * 1000, // 1 minute from now
            },
          },
          update: vi.fn(),
          save: vi.fn().mockResolvedValue(undefined),
          refetch: vi.fn().mockResolvedValue(null),
        },
        {
          id: 'session-2',
          data: {
            auth: {
              isAuthenticated: true,
              accessToken: 'access-2',
              refreshToken: 'invalid-refresh', // This will fail
              expiresAt: Date.now() + 30 * 1000, // 30 seconds from now
            },
          },
          update: vi.fn(),
          save: vi.fn().mockResolvedValue(undefined),
          // No concurrent refresh happened - refetch reflects the same stale/expired auth
          refetch: vi.fn().mockResolvedValue({
            auth: {
              isAuthenticated: true,
              accessToken: 'access-2',
              refreshToken: 'invalid-refresh',
              expiresAt: Date.now() - 1000,
            },
          }),
        },
      ];

      mockSessionService.getActiveSessions = vi
        .fn()
        .mockResolvedValue(mockSessions);

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenIDConfig,
      } as Response);

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
        }),
      } as Response);

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'invalid_grant' }),
      } as Response);

      const result = await service.refreshExpiringTokens();

      expect(result).toEqual({
        refreshed: 1,
        failed: 1,
        total: 2,
      });

      expect(mockSessions[1].update).toHaveBeenCalled();
      expect(mockSessions[1].save).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to refresh token for session',
        expect.any(Object),
        expect.objectContaining({ sessionId: 'session-2' })
      );
    });

    it('should skip sessions without valid auth data', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          data: {
            auth: {
              isAuthenticated: false,
              accessToken: null,
              refreshToken: null,
              expiresAt: null,
            },
          },
          update: vi.fn(),
          save: vi.fn().mockResolvedValue(undefined),
        },
      ];

      mockSessionService.getActiveSessions = vi
        .fn()
        .mockResolvedValue(mockSessions);

      const result = await service.refreshExpiringTokens();

      expect(result).toEqual({
        refreshed: 0,
        failed: 0,
        total: 1,
      });

      // Verify no sessions were updated
      expect(mockSessions[0].update).not.toHaveBeenCalled();
      expect(mockSessions[0].save).not.toHaveBeenCalled();
    });

    it('should not mark a session unauthenticated if a concurrent refresh already succeeded', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          data: {
            auth: {
              isAuthenticated: true,
              accessToken: 'access-1',
              refreshToken: 'stale-refresh-token',
              expiresAt: Date.now() + 30 * 1000,
            },
          },
          update: vi.fn(),
          save: vi.fn().mockResolvedValue(undefined),
          // A concurrent request-driven refresh already rotated this
          // session's tokens and wrote a still-valid expiresAt to storage
          refetch: vi.fn().mockResolvedValue({
            auth: {
              isAuthenticated: true,
              accessToken: 'fresh-access-token',
              refreshToken: 'fresh-refresh-token',
              expiresAt: Date.now() + 60 * 60 * 1000,
            },
          }),
        },
      ];

      mockSessionService.getActiveSessions = vi
        .fn()
        .mockResolvedValue(mockSessions);

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenIDConfig,
      } as Response);

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'invalid_grant' }),
      } as Response);

      const result = await service.refreshExpiringTokens();

      expect(result).toEqual({
        refreshed: 0,
        failed: 0,
        total: 1,
      });

      expect(mockSessions[0].refetch).toHaveBeenCalled();
      expect(mockSessions[0].update).not.toHaveBeenCalled();
      expect(mockSessions[0].save).not.toHaveBeenCalled();
    });
  });
});
