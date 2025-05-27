import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { H3Event } from 'h3';
import authenticatedRoute from './authenticated';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import { registerCustomServiceInstance } from '@analog-tools/inject';
import { LoggerService } from '@analog-tools/logger';


describe('authenticated route', () => {
  // Mock services and event
  let mockEvent: H3Event;
  let mockAuthService: Partial<OAuthAuthenticationService>;
  
  beforeEach(() => {
    // Set up mock event
    mockEvent = {
      context: {},
    } as unknown as H3Event;
    
    // Set up mock auth service
    mockAuthService = {
      isAuthenticated: vi.fn().mockResolvedValue(true),
    };
    

        registerCustomServiceInstance(OAuthAuthenticationService, mockAuthService);
        registerCustomServiceInstance(LoggerService, {forContext: vi.fn()});
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should return true when user is authenticated', async () => {
    mockAuthService.isAuthenticated = vi.fn().mockResolvedValue(true);
    
    const result = await authenticatedRoute.handler(mockEvent);
    
    expect(mockAuthService.isAuthenticated).toHaveBeenCalledWith(mockEvent);
    expect(result).toEqual({ authenticated: true });
  });
  
  it('should return false when user is not authenticated', async () => {
    mockAuthService.isAuthenticated = vi.fn().mockResolvedValue(false);
    
    const result = await authenticatedRoute.handler(mockEvent);
    
    expect(mockAuthService.isAuthenticated).toHaveBeenCalledWith(mockEvent);
    expect(result).toEqual({ authenticated: false });
  });
});
