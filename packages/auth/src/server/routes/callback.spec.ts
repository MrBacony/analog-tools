import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { getQuery, H3Event, sendRedirect } from 'h3';
import callbackRoute from './callback';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import { AuthSessionData } from '../types/auth-session.types';
import { registerMockService, resetAllInjections } from '@analog-tools/inject';

// Mock dependencies
vi.mock('h3', () => ({
  createError: vi.fn().mockImplementation((errorObj) => errorObj),
  getQuery: vi.fn(),
  sendRedirect: vi.fn().mockReturnValue('redirect-result'),
}));

describe('callback route', () => {
  // Mock services and event
  let mockEvent: H3Event;
  let mockAuthService: Partial<OAuthAuthenticationService>;
  let mockSessionData: Partial<AuthSessionData>;
  let mockSessionHandler: {
    data: Partial<AuthSessionData>;
    update: (fn: (data: AuthSessionData) => AuthSessionData) => void;
    save: () => Promise<void>;
  };

  const mockCode = 'auth-code-123';
  const mockState = 'state-456';

  beforeEach(() => {
    // Set up initial session data
    mockSessionData = {
      state: mockState,
      redirectUrl: '/dashboard',
    };

    // Set up mock session handler
    mockSessionHandler = {
      data: mockSessionData,
      update: vi.fn((updater) => {
        const result = updater(mockSessionData as AuthSessionData);
        // Reset mockSessionData and only add properties from result
        // This ensures deleted properties are properly removed
        for (const key in mockSessionData) {
          if (Object.prototype.hasOwnProperty.call(mockSessionData, key)) {
            delete mockSessionData[key];
          }
        }
        Object.assign(mockSessionData, result);
      }),
      save: vi.fn().mockResolvedValue(undefined),
    };

    // Set up mock event
    mockEvent = {
      context: {
        sessionHandler: mockSessionHandler,
      },
    } as unknown as H3Event;

    // Set up mock auth service
    mockAuthService = {
      initSession: vi.fn().mockResolvedValue(undefined),
      handleCallback: vi.fn().mockResolvedValue(undefined),
    };

    registerMockService(OAuthAuthenticationService, mockAuthService);
    //registerCustomServiceInstance(LoggerService, {forContext: vi.fn().mockReturnValue(mockContextLogger)});

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
    expect(mockSessionHandler.update).toHaveBeenCalledTimes(2); // Once for state, once for redirectUrl
    expect(mockSessionHandler.save).toHaveBeenCalled();
    expect(sendRedirect).toHaveBeenCalledWith(mockEvent, '/dashboard');
    expect(result).toBe('redirect-result');

    // Verify state has been removed from session
    expect(mockSessionData.state).toBeUndefined();

    // Verify redirectUrl has been removed from session
    expect(mockSessionData.redirectUrl).toBeUndefined();
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
    // Remove state from session
    mockSessionData.state = undefined;

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
    // Remove redirectUrl from session
    mockSessionData.redirectUrl = undefined;

    await callbackRoute.handler(mockEvent);

    expect(sendRedirect).toHaveBeenCalledWith(mockEvent, '/');
  });
});
