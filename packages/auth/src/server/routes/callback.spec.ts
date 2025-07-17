import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { getQuery, H3Event, sendRedirect } from 'h3';
import callbackRoute from './callback';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import { AuthSessionData } from '../types/auth-session.types';
import { registerMockService, resetAllInjections } from '@analog-tools/inject';
import { getSession, updateSession } from '@analog-tools/session';

// Mock dependencies
vi.mock('h3', () => ({
  createError: vi.fn().mockImplementation((errorObj) => errorObj),
  getQuery: vi.fn(),
  sendRedirect: vi.fn().mockReturnValue('redirect-result'),
}));

// Mock the session API
vi.mock('@analog-tools/session', () => ({
  getSession: vi.fn(),
  updateSession: vi.fn().mockResolvedValue(undefined),
}));

describe('callback route', () => {
  // Mock services and event
  let mockEvent: H3Event;
  let mockAuthService: Partial<OAuthAuthenticationService>;
  let mockSessionData: Partial<AuthSessionData>;
  let mockGetSession: Mock;
  let mockUpdateSession: Mock;

  const mockCode = 'auth-code-123';
  const mockState = 'state-456';

  beforeEach(async () => {
    // Get the mock functions
    mockGetSession = getSession as Mock;
    mockUpdateSession = updateSession as Mock;

    // Set up initial session data
    mockSessionData = {
      state: mockState,
      redirectUrl: '/dashboard',
    };

    // Set up mock event
    mockEvent = {
      context: {},
    } as unknown as H3Event;

    // Set up mock auth service
    mockAuthService = {
      initSession: vi.fn().mockResolvedValue(undefined),
      handleCallback: vi.fn().mockResolvedValue(undefined),
      isAuthenticated: vi.fn().mockResolvedValue(false),
    };

    // Mock getSession to return our mock session data
    mockGetSession.mockReturnValue(mockSessionData);

    registerMockService(OAuthAuthenticationService, mockAuthService);

    // Mock getQuery to return code and state
    (getQuery as unknown as Mock).mockReturnValue({
      code: mockCode,
      state: mockState,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetAllInjections();
  });

  it('should initialize session', async () => {
    await callbackRoute.handler(mockEvent);
    expect(mockAuthService.initSession).toHaveBeenCalledWith(mockEvent);
  });

  it('should verify state parameter and handle callback when valid', async () => {
    const result = await callbackRoute.handler(mockEvent);

    expect(mockAuthService.handleCallback).toHaveBeenCalledWith(
      mockEvent,
      mockCode,
      mockState
    );
    expect(mockUpdateSession).toHaveBeenCalledTimes(2); // Once for state, once for redirectUrl
    expect(sendRedirect).toHaveBeenCalledWith(mockEvent, '/dashboard');
    expect(result).toBe('redirect-result');
  });

  it('should throw error when state parameter is missing', async () => {
    // Mock missing state in query
    (getQuery as unknown as Mock).mockReturnValue({
      code: mockCode,
      state: undefined,
    });

    await expect(callbackRoute.handler(mockEvent)).rejects.toEqual({
      statusCode: 400,
      message:
        'Invalid or missing state parameter. Authentication flow may have been tampered with.',
      statusMessage: 'Authorization Failed',
    });

    expect(mockAuthService.handleCallback).not.toHaveBeenCalled();
  });

  it('should throw error when state in session is missing', async () => {
    // Mock session without state
    mockGetSession.mockReturnValue({ ...mockSessionData, state: undefined });

    await expect(callbackRoute.handler(mockEvent)).rejects.toEqual({
      statusCode: 400,
      message:
        'Invalid or missing state parameter. Authentication flow may have been tampered with.',
      statusMessage: 'Authorization Failed',
    });

    expect(mockAuthService.handleCallback).not.toHaveBeenCalled();
  });

  it('should throw error when state parameter does not match session state', async () => {
    // Mock different state in query
    (getQuery as unknown as Mock).mockReturnValue({
      code: mockCode,
      state: 'different-state',
    });

    await expect(callbackRoute.handler(mockEvent)).rejects.toEqual({
      statusCode: 400,
      message:
        'Invalid or missing state parameter. Authentication flow may have been tampered with.',
      statusMessage: 'Authorization Failed',
    });

    expect(mockAuthService.handleCallback).not.toHaveBeenCalled();
  });

  it('should use default redirect URL when not provided in session', async () => {
    // Mock session without redirectUrl
    mockGetSession.mockReturnValue({ ...mockSessionData, redirectUrl: undefined });

    await callbackRoute.handler(mockEvent);

    expect(sendRedirect).toHaveBeenCalledWith(mockEvent, '/');
  });
});
