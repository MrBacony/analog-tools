import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createError, H3Event, sendRedirect } from 'h3';
import logoutRoute from './logout';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import { LoggerService } from '@analog-tools/logger';
import { registerCustomServiceInstance } from '@analog-tools/inject';

// Mock dependencies
vi.mock('h3', () => ({
  createError: vi.fn().mockImplementation((errorObj) => errorObj),
  sendRedirect: vi.fn().mockReturnValue('redirect-result'),
}));

describe('logout route', () => {
  // Mock services and event
  let mockEvent: H3Event;
  let mockContextLogger: any;
  let mockAuthService: Partial<OAuthAuthenticationService>;
  
  beforeEach(() => {
   
    // Set up mock event
    mockEvent = {
      context: {},
    } as unknown as H3Event;


    mockContextLogger = {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
      };

    // Set up mock auth service
    mockAuthService = {
      initSession: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue('https://auth.example.com/logout'),
    };
    registerCustomServiceInstance(OAuthAuthenticationService, mockAuthService);
    registerCustomServiceInstance(LoggerService, {forContext: vi.fn().mockReturnValue(mockContextLogger)});
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should initialize session', async () => {
    await logoutRoute.handler(mockEvent);
    expect(mockAuthService.initSession).toHaveBeenCalledWith(mockEvent);
  });
  
  it('should call logout method and redirect to the logout URL', async () => {
    const result = await logoutRoute.handler(mockEvent);
    
    expect(mockAuthService.logout).toHaveBeenCalledWith(mockEvent);
    expect(sendRedirect).toHaveBeenCalledWith(
      mockEvent,
      'https://auth.example.com/logout'
    );
    expect(result).toBe('redirect-result');
  });
  
  it('should handle errors and log them', async () => {
    const testError = new Error('Test logout error');
    mockAuthService.logout = vi.fn().mockRejectedValue(testError);
    
    await expect(logoutRoute.handler(mockEvent)).rejects.toEqual({
      statusCode: 500,
      message: 'Logout failed',
    });
    
    expect(mockContextLogger.error).toHaveBeenCalledWith('Logout failed', testError);
    expect(createError).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Logout failed',
    });
  });
});
