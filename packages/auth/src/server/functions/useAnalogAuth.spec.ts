import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAnalogAuth } from './useAnalogAuth';
import { AnalogAuthConfig, MemorySessionConfig } from '../types/auth.types';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import * as injectModule from '@analog-tools/inject';
import * as useAnalogAuthMiddlewareModule from './useAnalogAuthMiddleware';
import { H3Event } from 'h3';

// Import the module path directly for spying purposes
import * as handleAuthRouteModule from './handleAuthRoute';

// Mock the modules
vi.mock('@analog-tools/inject', async () => {
  const actual = await vi.importActual('@analog-tools/inject');
  return {
    ...actual,
    registerService: vi.fn(),
  };
});

vi.mock('./useAnalogAuthMiddleware', () => ({
  useAnalogAuthMiddleware: vi.fn().mockResolvedValue(undefined),
}));

// Mock handleAuthRoute with a direct return value
vi.mock('./handleAuthRoute', () => ({
  handleAuthRoute: vi.fn().mockReturnValue('auth-route-result'),
}));

describe('useAnalogAuth', () => {
  let mockConfig: AnalogAuthConfig;
  let mockEvent: H3Event;

  beforeEach(() => {
    mockConfig = {
      issuer: 'https://example.com',
      clientId: 'client-123',
      clientSecret: 'secret-456',
      audience: 'api',
      scope: 'openid profile',
      callbackUri: 'https://app.example.com/callback',
    };

    mockEvent = { path: '/api/auth/callback' } as H3Event;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should throw error when mandatory configuration values are missing', async () => {
    // Create a config with missing values
    const incompleteConfig = {
      issuer: '',
      clientId: 'client-123',
      audience: 'api',
      scope: 'openid profile',
    } as AnalogAuthConfig;

    await expect(useAnalogAuth(incompleteConfig, mockEvent)).rejects.toThrow(
      'AnalogAuth initialization failed: Missing mandatory configuration values: issuer, clientSecret, callbackUri'
    );

    // Verify that registerService was not called
    expect(injectModule.registerService).not.toHaveBeenCalled();
    expect(
      useAnalogAuthMiddlewareModule.useAnalogAuthMiddleware
    ).not.toHaveBeenCalled();
    expect(handleAuthRouteModule.handleAuthRoute).not.toHaveBeenCalled();
  });

  it('should initialize authentication with valid config', async () => {
    const result = await useAnalogAuth(mockConfig, mockEvent);

    // Verify that the service was registered with the correct config
    expect(injectModule.registerService).toHaveBeenCalledWith(
      OAuthAuthenticationService,
      mockConfig
    );

    // Verify that middleware was called
    expect(
      useAnalogAuthMiddlewareModule.useAnalogAuthMiddleware
    ).toHaveBeenCalledWith(mockEvent);

    // Verify that handleAuthRoute was called
    expect(handleAuthRouteModule.handleAuthRoute).toHaveBeenCalledWith(
      mockEvent
    );

    // Verify the return value comes from handleAuthRoute
    expect(result).toBe('auth-route-result');
  });

  it('should pass along config with optional fields', async () => {
    const configWithOptionalFields = {
      ...mockConfig,
      unprotectedRoutes: ['/api/public'],
      sessionStorage: {
        type: 'memory',
        config: {} as MemorySessionConfig,
      },
      userHandler: {
        mapUserToLocal: vi.fn(),
        createOrUpdateUser: vi.fn(),
      },
    } as AnalogAuthConfig;

    await useAnalogAuth(configWithOptionalFields, mockEvent);

    // Verify that the service was registered with the complete config
    expect(injectModule.registerService).toHaveBeenCalledWith(
      OAuthAuthenticationService,
      configWithOptionalFields
    );
  });

  it('should check each mandatory field individually', async () => {
    // Test each mandatory field one by one
    const mandatoryFields: (keyof AnalogAuthConfig)[] = [
      'issuer',
      'clientId',
      'clientSecret',
      'callbackUri',
    ];

    for (const field of mandatoryFields) {
      // Create a config with one missing field
      const testConfig = { ...mockConfig };
      // @ts-expect-error not assigning a value to the field
      testConfig[field] = '';

      await expect(useAnalogAuth(testConfig, mockEvent)).rejects.toThrow(
        `AnalogAuth initialization failed: Missing mandatory configuration values: ${field}`
      );
    }
  });
});
