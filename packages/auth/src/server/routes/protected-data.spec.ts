import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { H3Event } from 'h3';
import protectedDataRoute from './protected-data';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import { registerMockService, resetAllInjections } from '@analog-tools/inject';
import { LoggerService } from '@analog-tools/logger';

describe('protected-data route', () => {
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
      getAuthenticatedUser: vi.fn().mockResolvedValue(mockUserData),
    };

    registerMockService(OAuthAuthenticationService, mockAuthService);
    registerMockService(LoggerService, { forContext: vi.fn() });
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetAllInjections();
  });

  it('should return protected data with user information', async () => {
    const result = await protectedDataRoute.handler(mockEvent);

    expect(mockAuthService.getAuthenticatedUser).toHaveBeenCalledWith(
      mockEvent
    );
    expect(result).toEqual({
      message: 'This is protected data that requires authentication',
      user: mockUserData,
    });
  });
});
