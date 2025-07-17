import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OAuthAuthenticationService } from './oauth-authentication.service';
import { LoggerService } from '@analog-tools/logger';
import { SessionService } from './session.service';
import { AnalogAuthConfig } from '../types/auth.types';
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
  updateSession: vi.fn(),
}));

// Import the mocked functions for use in tests
import { getSession, updateSession } from '@analog-tools/session';

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
    authorization_endpoint: 'https://auth.example.com/authorize',
    token_endpoint: 'https://auth.example.com/token',
    userinfo_endpoint: 'https://auth.example.com/userinfo',
    end_session_endpoint: 'https://auth.example.com/logout',
    revocation_endpoint: 'https://auth.example.com/revoke',
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
        type: 'redis',
        config: {
          url: 'redis://localhost:6379',
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
          type: 'redis',
          config: {
            url: 'redis://localhost:6379',
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
    it('should return true for routes in unprotectedRoutes', () => {
      expect(service.isUnprotectedRoute('/api/auth/login')).toBe(true);
      expect(service.isUnprotectedRoute('/api/auth/login/extra')).toBe(true);
    });

    it('should return false for protected routes', () => {
      expect(service.isUnprotectedRoute('/api/protected')).toBe(false);
      expect(service.isUnprotectedRoute('/dashboard')).toBe(false);
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should generate OAuth authorization URL with correct parameters', async () => {
      const url = await service.getAuthorizationUrl(
        'test-state',
        'https://custom-redirect.com'
      );

      expect(url).toContain(mockOpenIDConfig.authorization_endpoint);
      expect(url).toContain('client_id=test-client');
      expect(url).toContain('redirect_uri=https%3A%2F%2Fcustom-redirect.com');
      expect(url).toContain('scope=openid+profile+email');
      expect(url).toContain('audience=test-audience');
      expect(url).toContain('state=test-state');
      expect(url).toContain('response_type=code');
    });

    it('should use default callbackUri when redirect is not provided', async () => {
      const url = await service.getAuthorizationUrl('test-state');

      expect(url).toContain(
        `redirect_uri=${encodeURIComponent(mockConfig.callbackUri)}`
      );
    });

    it('should fetch and cache OpenID configuration', async () => {
      await service.getAuthorizationUrl('test-state');

      // First call should fetch the config
      expect(global.fetch).toHaveBeenCalledWith(
        'https://auth.example.com/.well-known/openid-configuration'
      );

      // Reset fetch mock to verify caching
      vi.mocked(global.fetch).mockClear();

      await service.getAuthorizationUrl('another-state');

      // Second call should use cached config
      expect(global.fetch).not.toHaveBeenCalled();
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
  });
});
