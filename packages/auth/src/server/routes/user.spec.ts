import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createError, H3Event } from 'h3';
import userRoute from './user';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import { registerMockService, resetAllInjections } from '@analog-tools/inject';
import { LoggerService } from '@analog-tools/logger';

// Mock dependencies
vi.mock('h3', () => ({
  createError: vi.fn().mockImplementation((errorObj) => errorObj),
}));

describe('user route', () => {
  // Mock services and event
  let mockEvent: H3Event;
  let mockAuthService: Partial<OAuthAuthenticationService>;
  const mockUserData = {
    id: '123',
    name: 'Test User',
    email: 'test@example.com',
  };

  beforeEach(() => {
    // Set up mock event
    mockEvent = {
      context: {},
    } as unknown as H3Event;

    // Set up mock auth service
    mockAuthService = {
      initSession: vi.fn().mockResolvedValue(undefined),
      isAuthenticated: vi.fn().mockResolvedValue(true),
      getAuthenticatedUser: vi.fn().mockResolvedValue(mockUserData),
    };

    registerMockService(OAuthAuthenticationService, mockAuthService);
    registerMockService(LoggerService, { forContext: vi.fn() });
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetAllInjections();
  });

  it('should initialize session', async () => {
    await userRoute.handler(mockEvent);
    expect(mockAuthService.initSession).toHaveBeenCalledWith(mockEvent);
  });

  it('should check if user is authenticated', async () => {
    await userRoute.handler(mockEvent);
    expect(mockAuthService.isAuthenticated).toHaveBeenCalledWith(mockEvent);
  });

  it('should return user data when authenticated', async () => {
    const result = await userRoute.handler(mockEvent);

    expect(mockAuthService.getAuthenticatedUser).toHaveBeenCalledWith(
      mockEvent
    );
    expect(result).toEqual(mockUserData);
  });

  it('should throw 401 error when user is not authenticated', async () => {
    // Mock user not being authenticated
    mockAuthService.isAuthenticated = vi.fn().mockResolvedValue(false);

    await expect(userRoute.handler(mockEvent)).rejects.toEqual({
      statusCode: 401,
      message: 'Unauthorized',
    });

    expect(mockAuthService.getAuthenticatedUser).not.toHaveBeenCalled();
    expect(createError).toHaveBeenCalledWith({
      statusCode: 401,
      message: 'Unauthorized',
    });
  });
});
