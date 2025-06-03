import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { useAnalogAuthMiddleware } from './useAnalogAuthMiddleware';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import { LoggerService } from '@analog-tools/logger';
import { registerMockService, resetAllInjections } from '@analog-tools/inject';
import * as checkAuthenticationModule from './checkAuthentication';
import * as h3Module from 'h3';
import { H3Event, sendRedirect } from 'h3';
import { TRPCError } from '@trpc/server';

// Mock the dependencies
vi.mock('h3', async () => {
  const actual = await vi.importActual('h3');
  return {
    ...actual,
    getHeader: vi.fn(),
    getRequestURL: vi.fn(),
    sendRedirect: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('./checkAuthentication');

describe('useAnalogAuthMiddleware', () => {
  let mockAuthService: {
    initSession: ReturnType<typeof vi.fn>;
    isUnprotectedRoute: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    forContext: ReturnType<typeof vi.fn>;
  };
  let mockEvent: H3Event;
  // Using ReturnType of vi.fn to maintain type safety
  let mockGetHeader: any;
  let mockGetRequestURL: any;
  let mockCheckAuthentication: any;
  let mockLoggerInstance: {
    debug: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup mock auth service
    mockAuthService = {
      initSession: vi.fn().mockResolvedValue(undefined),
      isUnprotectedRoute: vi.fn().mockReturnValue(false),
    };

    // Setup mock logger instance
    mockLoggerInstance = {
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    };

    // Setup mock logger
    mockLogger = {
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      forContext: vi.fn().mockReturnValue(mockLoggerInstance),
    };

    // Register mocks
    registerMockService(OAuthAuthenticationService, mockAuthService);
    registerMockService(LoggerService, mockLogger);

    // Create mock event
    mockEvent = {} as H3Event;

    // Setup h3 mocks
    mockGetHeader = vi.spyOn(h3Module, 'getHeader');
    mockGetRequestURL = vi.spyOn(h3Module, 'getRequestURL');
    // Default values
    mockGetRequestURL.mockReturnValue({ pathname: '/api/protected' });
    // @ts-expect-error any type
    mockGetHeader.mockImplementation((event, headerName) => {
      if (headerName === 'ssr') return 'false';
      if (headerName === 'fetch') return 'false';
      return null;
    });

    // Setup checkAuthentication mock
    mockCheckAuthentication = vi.spyOn(
      checkAuthenticationModule,
      'checkAuthentication'
    );
    mockCheckAuthentication.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetAllInjections();
  });

  it('should bypass authentication for login routes', async () => {
    mockGetRequestURL.mockReturnValue({ pathname: '/api/auth/login' });

    await useAnalogAuthMiddleware(mockEvent);

    expect(mockAuthService.initSession).not.toHaveBeenCalled();
    expect(mockCheckAuthentication).not.toHaveBeenCalled();
  });

  it('should bypass authentication for callback routes', async () => {
    mockGetRequestURL.mockReturnValue({ pathname: '/api/auth/callback' });

    await useAnalogAuthMiddleware(mockEvent);

    expect(mockAuthService.initSession).not.toHaveBeenCalled();
    expect(mockCheckAuthentication).not.toHaveBeenCalled();
  });

  it('should bypass authentication for authenticated routes', async () => {
    mockGetRequestURL.mockReturnValue({ pathname: '/api/auth/authenticated' });

    await useAnalogAuthMiddleware(mockEvent);

    expect(mockAuthService.initSession).not.toHaveBeenCalled();
    expect(mockCheckAuthentication).not.toHaveBeenCalled();
  });

  it('should bypass authentication for trpc routes', async () => {
    mockGetRequestURL.mockReturnValue({ pathname: '/api/trpc' });

    await useAnalogAuthMiddleware(mockEvent);

    expect(mockAuthService.initSession).not.toHaveBeenCalled();
    expect(mockCheckAuthentication).not.toHaveBeenCalled();
  });

  it('should bypass authentication for routes marked as unprotected', async () => {
    mockGetRequestURL.mockReturnValue({ pathname: '/api/public' });
    mockAuthService.isUnprotectedRoute.mockReturnValue(true);

    await useAnalogAuthMiddleware(mockEvent);

    expect(mockAuthService.isUnprotectedRoute).toHaveBeenCalledWith(
      '/api/public'
    );
    expect(mockAuthService.initSession).not.toHaveBeenCalled();
    expect(mockCheckAuthentication).not.toHaveBeenCalled();
  });

  it('should check authentication for protected routes', async () => {
    mockGetRequestURL.mockReturnValue({ pathname: '/api/protected' });

    await useAnalogAuthMiddleware(mockEvent);

    expect(mockAuthService.initSession).toHaveBeenCalledWith(mockEvent);
    expect(mockCheckAuthentication).toHaveBeenCalledWith(mockEvent);
  });

  it('should throw TRPC UNAUTHORIZED error for unauthenticated API fetch requests', async () => {
    mockGetRequestURL.mockReturnValue({ pathname: '/api/protected' });
    // @ts-expect-error any type
    mockGetHeader.mockImplementation((event, headerName) => {
      if (headerName === 'ssr') return 'false';
      if (headerName === 'fetch') return 'true';
      return null;
    });
    mockCheckAuthentication.mockResolvedValue(false);

    await expect(useAnalogAuthMiddleware(mockEvent)).rejects.toThrow(TRPCError);

    const lastCall = (mockCheckAuthentication as Mock).mock.lastCall;
    expect(lastCall?.[0]).toBe(mockEvent);
  });

  it('should redirect to login for unauthenticated browser requests', async () => {
    mockGetRequestURL.mockReturnValue({ pathname: '/api/protected' });
    mockCheckAuthentication.mockResolvedValue(false);

    await useAnalogAuthMiddleware(mockEvent);

    expect(sendRedirect).toHaveBeenCalledWith(mockEvent, '/api/auth/login');
  });

  it('should return NOT_IMPLEMENTED error for fetch requests with SSR', async () => {
    mockGetRequestURL.mockReturnValue({ pathname: '/api/protected' });
    // @ts-expect-error any type
    mockGetHeader.mockImplementation((event, headerName) => {
      if (headerName === 'ssr') return 'true';
      if (headerName === 'fetch') return 'true';
      return null;
    });

    const result = await useAnalogAuthMiddleware(mockEvent);

    expect(result).toEqual({
      name: 'TrpcError',
      code: 'NOT_IMPLEMENTED',
      message: 'SSR is not supported for this route',
    });
  });

  it('should skip authentication check for SSR requests', async () => {
    mockGetRequestURL.mockReturnValue({ pathname: '/api/protected' });
    // @ts-expect-error any type
    mockGetHeader.mockImplementation((event, headerName) => {
      if (headerName === 'ssr') return 'true';
      return null;
    });

    await useAnalogAuthMiddleware(mockEvent);

    expect(mockAuthService.initSession).not.toHaveBeenCalled();
    expect(mockCheckAuthentication).not.toHaveBeenCalled();
  });

  it('should log debug message when redirecting to login page', async () => {
    mockGetRequestURL.mockReturnValue({ pathname: '/api/custom-path' });
    mockCheckAuthentication.mockResolvedValue(false);

    await useAnalogAuthMiddleware(mockEvent);

    expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
      'Redirecting to login page',
      { path: '/api/custom-path' }
    );
  });

  it('should propagate errors from initSession', async () => {
    const error = new Error('Init session error');
    mockAuthService.initSession.mockRejectedValue(error);

    await expect(useAnalogAuthMiddleware(mockEvent)).rejects.toThrow(
      'Init session error'
    );
  });

  it('should propagate errors from checkAuthentication', async () => {
    const error = new Error('Check authentication error');
    mockCheckAuthentication.mockRejectedValue(error);

    await expect(useAnalogAuthMiddleware(mockEvent)).rejects.toThrow(
      'Check authentication error'
    );
  });

  it('should propagate errors from sendRedirect', async () => {
    const mockSendRedirect = vi.mocked(sendRedirect);
    mockCheckAuthentication.mockResolvedValue(false);
    mockSendRedirect.mockRejectedValueOnce(new Error('Redirect error'));

    await expect(useAnalogAuthMiddleware(mockEvent)).rejects.toThrow(
      'Redirect error'
    );
  });
});
