import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAuthRoute } from './handleAuthRoute';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import { getLastPathSegment } from '../utils/getLastPathSegment';
import { createError, H3Event } from 'h3';
import { registerMockService, resetAllInjections } from '@analog-tools/inject';
import { LoggerService } from '@analog-tools/logger';

// Mock dependencies
vi.mock('./registerRoutes', () => ({
  registerRoutes: vi.fn(() => ({
    login: vi.fn(() => 'login-handler-result'),
    callback: vi.fn(() => 'callback-handler-result'),
    nonexistent: undefined,
  })),
}));

vi.mock('../utils/getLastPathSegment', () => ({
  getLastPathSegment: vi.fn(),
}));

vi.mock('h3', async () => {
  const actual = await vi.importActual('h3');
  return {
    ...actual,
    createError: vi.fn((err) => err),
  };
});

describe('handleAuthRoute', () => {
  let mockAuthService = {
    initSession: vi.fn().mockResolvedValue(undefined),
  };

  let mockEvent: Partial<H3Event>;

  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();

    // Setup default mocks
    mockEvent = { path: '/api/auth/login' } as Partial<H3Event>;
    mockAuthService = {
      initSession: vi.fn().mockResolvedValue(undefined),
    };
    registerMockService(OAuthAuthenticationService, mockAuthService);
    registerMockService(LoggerService, { forContext: vi.fn() });
    vi.mocked(getLastPathSegment).mockReturnValue('login');
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetAllInjections();
  });

  it('should not handle routes that do not include "/api/auth/"', async () => {
    // @ts-expect-error updating mockEvent to simulate a different path
    mockEvent.path = '/api/other/route';

    const result = await handleAuthRoute(mockEvent as H3Event);

    expect(result).toBeUndefined();
    expect(mockAuthService.initSession).not.toHaveBeenCalled();
  });

  it('should throw a 400 error if path segment is empty', async () => {
    vi.mocked(getLastPathSegment).mockReturnValue('');

    await expect(handleAuthRoute(mockEvent as H3Event)).rejects.toEqual({
      statusCode: 400,
      statusMessage: 'Missing path parameter',
    });

    // inject should not be called when path is empty as we throw before getting there
    registerMockService(OAuthAuthenticationService, mockAuthService);

    expect(createError).toHaveBeenCalledWith({
      statusCode: 400,
      statusMessage: 'Missing path parameter',
    });
  });

  it('should handle existing routes and return their handler result', async () => {
    const result = await handleAuthRoute(mockEvent as H3Event);

    expect(mockAuthService.initSession).toHaveBeenCalledWith(mockEvent);
    expect(getLastPathSegment).toHaveBeenCalledWith('/api/auth/login');
    expect(result).toBe('login-handler-result');
  });

  it('should throw a 404 error if route does not exist', async () => {
    vi.mocked(getLastPathSegment).mockReturnValue('nonexistent-route');

    await expect(handleAuthRoute(mockEvent as H3Event)).rejects.toEqual({
      statusCode: 404,
      statusMessage: "Authentication route 'nonexistent-route' not found",
    });

    expect(mockAuthService.initSession).toHaveBeenCalledWith(mockEvent);
    expect(createError).toHaveBeenCalledWith({
      statusCode: 404,
      statusMessage: "Authentication route 'nonexistent-route' not found",
    });
  });

  it('should support the callback route', async () => {
    vi.mocked(getLastPathSegment).mockReturnValue('callback');

    const result = await handleAuthRoute(mockEvent as H3Event);

    expect(mockAuthService.initSession).toHaveBeenCalledWith(mockEvent);
    expect(result).toBe('callback-handler-result');
  });
});
