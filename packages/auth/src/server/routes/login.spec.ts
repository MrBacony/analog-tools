import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { getQuery, H3Event, sendRedirect } from 'h3';
import { randomUUID } from 'uncrypto';
import loginRoute from './login';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import { registerMockService, resetAllInjections } from '@analog-tools/inject';
import { LoggerService } from '@analog-tools/logger';
import { updateSession } from '@analog-tools/session';

// Mock dependencies
vi.mock('h3', () => ({
  getQuery: vi.fn(),
  sendRedirect: vi.fn().mockReturnValue('redirect-result'),
}));

vi.mock('uncrypto', () => ({
  randomUUID: vi.fn().mockReturnValue('mock-state-uuid'),
}));

// Mock the session API
vi.mock('@analog-tools/session', () => ({
  updateSession: vi.fn().mockResolvedValue(undefined),
}));

describe('login route', () => {
  // Mock services and event
  let mockEvent: H3Event;
  let mockAuthService: Partial<OAuthAuthenticationService>;
  let mockUpdateSession: Mock;

  beforeEach(async () => {
    // Get the mock function
    mockUpdateSession = updateSession as Mock;

    // Set up mock event
    mockEvent = {
      context: {},
    } as unknown as H3Event;

    // Set up mock auth service
    mockAuthService = {
      initSession: vi.fn().mockResolvedValue(undefined),
      getAuthorizationUrl: vi
        .fn()
        .mockResolvedValue('https://auth.example.com/authorize'),
    };

    registerMockService(OAuthAuthenticationService, mockAuthService);
    registerMockService(LoggerService, { forContext: vi.fn() });
    // Mock getQuery to return test values
    (getQuery as unknown as Mock).mockReturnValue({
      redirect_uri: 'https://app.example.com/dashboard',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetAllInjections();
  });

  it('should initialize session', async () => {
    await loginRoute.handler(mockEvent);
    expect(mockAuthService.initSession).toHaveBeenCalledWith(mockEvent);
  });

  it('should generate a random state and store it in session', async () => {
    await loginRoute.handler(mockEvent);

    // Verify randomUUID was called
    expect(randomUUID).toHaveBeenCalled();

    // Verify session was updated with state
    expect(mockUpdateSession).toHaveBeenCalledWith(mockEvent, expect.any(Function));
  });

  it('should get redirect URL from query parameters', async () => {
    await loginRoute.handler(mockEvent);
    expect(getQuery).toHaveBeenCalledWith(mockEvent);
  });

  it('should get authorization URL with state and redirect URI', async () => {
    await loginRoute.handler(mockEvent);

    expect(mockAuthService.getAuthorizationUrl).toHaveBeenCalledWith(
      'mock-state-uuid',
      'https://app.example.com/dashboard'
    );
  });

  it('should redirect to OAuth provider', async () => {
    const result = await loginRoute.handler(mockEvent);

    expect(sendRedirect).toHaveBeenCalledWith(
      mockEvent,
      'https://auth.example.com/authorize'
    );
    expect(result).toBe('redirect-result');
  });
});
