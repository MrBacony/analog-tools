import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { checkAuthentication } from './checkAuthentication';
import { registerCustomServiceInstance } from '@analog-tools/inject';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import type { H3Event } from 'h3';
import { LoggerService } from '@analog-tools/logger';

describe('checkAuthentication', () => {
  let mockAuthService: {
    initSession: ReturnType<typeof vi.fn>;
    isAuthenticated: ReturnType<typeof vi.fn>;
  };
  let mockEvent: H3Event;

  beforeEach(() => {
    mockAuthService = {
      initSession: vi.fn().mockResolvedValue(undefined),
      isAuthenticated: vi.fn().mockResolvedValue(true),
    };
    registerCustomServiceInstance(OAuthAuthenticationService, mockAuthService);
    registerCustomServiceInstance(LoggerService, { forContext: vi.fn() });
    mockEvent = {} as H3Event;
  });

  it('should initialize session and check authentication', async () => {
    await checkAuthentication(mockEvent);

    expect(mockAuthService.initSession).toHaveBeenCalledWith(mockEvent);
    expect(mockAuthService.isAuthenticated).toHaveBeenCalledWith(mockEvent);
  });

  it('should return the result of isAuthenticated', async () => {
    (mockAuthService.isAuthenticated as Mock).mockResolvedValueOnce('result');
    const result = await checkAuthentication(mockEvent);
    expect(result).toBe('result');
  });

  it('should propagate errors from initSession', async () => {
    (mockAuthService.initSession as Mock).mockRejectedValueOnce(
      new Error('init error')
    );
    await expect(checkAuthentication(mockEvent)).rejects.toThrow('init error');
  });

  it('should propagate errors from isAuthenticated', async () => {
    (mockAuthService.isAuthenticated as Mock).mockRejectedValueOnce(
      new Error('auth error')
    );
    await expect(checkAuthentication(mockEvent)).rejects.toThrow('auth error');
  });
});
