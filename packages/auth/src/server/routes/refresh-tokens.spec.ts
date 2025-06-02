import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { getRequestHeaders, H3Event } from 'h3';
import refreshTokensRoute from './refresh-tokens';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import { LoggerService } from '@analog-tools/logger';
import { AnalogAuthConfig } from '../types/auth.types';
import {
  registerCustomServiceInstance,
  resetAllInjections,
} from '@analog-tools/inject';

// Mock dependencies
vi.mock('h3', () => ({
  getRequestHeaders: vi.fn(),
  createError: vi.fn().mockImplementation((errorObj) => errorObj),
}));

describe('refresh-tokens route', () => {
  // Mock services and event
  let mockEvent: H3Event;
  let mockAuthService: Partial<OAuthAuthenticationService>;
  let mockLoggerService: Partial<LoggerService>;
  let mockContextLogger: any;
  const mockApiKey = 'test-api-key-12345';

  beforeEach(() => {
    // Set up mock event
    mockEvent = {
      context: {},
    } as unknown as H3Event;

    // Set up mock auth service
    mockAuthService = {
      getConfig: vi.fn().mockReturnValue({
        tokenRefreshApiKey: mockApiKey,
      } as AnalogAuthConfig),
      refreshExpiringTokens: vi.fn().mockResolvedValue({
        refreshed: 5,
        failed: 1,
        total: 6,
      }),
    };

    // Set up mock logger
    mockContextLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    };

    mockLoggerService = {
      forContext: vi.fn().mockReturnValue(mockContextLogger),
    };
    registerCustomServiceInstance(OAuthAuthenticationService, mockAuthService);
    registerCustomServiceInstance(LoggerService, {
      forContext: vi.fn().mockReturnValue(mockContextLogger),
    });

    // Mock request headers with correct API key by default
    (getRequestHeaders as unknown as Mock).mockReturnValue({
      authorization: `Bearer ${mockApiKey}`,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetAllInjections();
  });

  it('should refresh tokens when properly authenticated', async () => {
    const result = await refreshTokensRoute.handler(mockEvent);

    expect(mockAuthService.refreshExpiringTokens).toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      refreshed: 5,
      failed: 1,
      total: 6,
    });

    // Check if the logger info was called with the results
    expect(mockContextLogger.info).toHaveBeenCalledWith(
      'Token refresh job completed',
      {
        refreshed: 5,
        failed: 1,
        total: 6,
      }
    );
  });

  it('should throw 401 error when API key is missing', async () => {
    // Mock missing authorization header
    (getRequestHeaders as unknown as Mock).mockReturnValue({
      authorization: undefined,
    });

    await expect(refreshTokensRoute.handler(mockEvent)).rejects.toEqual({
      statusCode: 401,
      message: 'Unauthorized',
    });

    expect(mockContextLogger.warn).toHaveBeenCalledWith(
      'Unauthorized token refresh attempt'
    );
    expect(mockAuthService.refreshExpiringTokens).not.toHaveBeenCalled();
  });

  it('should throw 401 error when API key is incorrect', async () => {
    // Mock incorrect API key
    (getRequestHeaders as unknown as Mock).mockReturnValue({
      authorization: 'Bearer incorrect-api-key',
    });

    await expect(refreshTokensRoute.handler(mockEvent)).rejects.toEqual({
      statusCode: 401,
      message: 'Unauthorized',
    });

    expect(mockContextLogger.warn).toHaveBeenCalledWith(
      'Unauthorized token refresh attempt'
    );
    expect(mockAuthService.refreshExpiringTokens).not.toHaveBeenCalled();
  });

  it('should throw 500 error when token refresh API key is not configured', async () => {
    // Mock missing API key in config
    mockAuthService.getConfig = vi.fn().mockReturnValue({} as AnalogAuthConfig);

    await expect(refreshTokensRoute.handler(mockEvent)).rejects.toEqual({
      statusCode: 500,
      message: 'Server configuration error',
    });

    expect(mockContextLogger.error).toHaveBeenCalledWith(
      'Token refresh API key not configured in either AnalogAuthConfig.tokenRefreshApiKey or TOKEN_REFRESH_API_KEY env variable'
    );
    expect(mockAuthService.refreshExpiringTokens).not.toHaveBeenCalled();
  });

  it('should handle errors when refreshing tokens', async () => {
    const testError = new Error('Token refresh failed');
    mockAuthService.refreshExpiringTokens = vi
      .fn()
      .mockRejectedValue(testError);

    await expect(refreshTokensRoute.handler(mockEvent)).rejects.toEqual({
      statusCode: 500,
      message: 'Failed to refresh tokens',
    });

    expect(mockContextLogger.error).toHaveBeenCalledWith(
      'Error in token refresh job',
      testError
    );
  });
});
