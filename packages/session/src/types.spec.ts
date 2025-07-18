import { describe, expect, it } from 'vitest';
import type {
  CookieOptions,
  SessionConfig,
  SessionData,
  SessionError,
  SessionOperationResult,
} from './types';

describe('Types - SessionData', () => {
  it('should accept any record of string keys and unknown values', () => {
    const validSessionData: SessionData = {
      userId: '123',
      role: 'admin',
      preferences: { theme: 'dark' },
      lastLogin: new Date(),
      isActive: true,
    };

    expect(validSessionData).toBeDefined();
    expect(typeof validSessionData).toBe('object');
  });

  it('should support empty session data', () => {
    const emptySessionData: SessionData = {};
    expect(emptySessionData).toEqual({});
  });
});

describe('Types - SessionConfig', () => {
  it('should require store and secret properties', () => {
    // This test validates type compilation - if it compiles, the interface is correct
    const config: SessionConfig = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      store: {} as any, // Mock storage
      secret: 'test-secret',
    };

    expect(config.store).toBeDefined();
    expect(config.secret).toBe('test-secret');
  });

  it('should support multiple secrets for rotation', () => {
    const config: SessionConfig = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      store: {} as any,
      secret: ['current-secret', 'old-secret'],
    };

    expect(Array.isArray(config.secret)).toBe(true);
    expect(config.secret).toHaveLength(2);
  });

  it('should have proper default values for optional properties', () => {
    const config: SessionConfig = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      store: {} as any,
      secret: 'test-secret',
      name: 'connect.sid',
      maxAge: 86400,
      cookie: {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
      },
    };

    expect(config.name).toBe('connect.sid');
    expect(config.maxAge).toBe(86400);
    expect(config.cookie?.httpOnly).toBe(true);
  });

  it('should support custom session data generator', () => {
    const config: SessionConfig<{ userId: string }> = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      store: {} as any,
      secret: 'test-secret',
      generate: () => ({ userId: 'anonymous' }),
    };

    expect(typeof config.generate).toBe('function');
    expect(config.generate?.()).toEqual({ userId: 'anonymous' });
  });
});

describe('Types - CookieOptions', () => {
  it('should support all standard cookie options', () => {
    const options: CookieOptions = {
      domain: 'example.com',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
    };

    expect(options.domain).toBe('example.com');
    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe('lax');
  });

  it('should support boolean sameSite option', () => {
    const options: CookieOptions = {
      sameSite: false,
    };

    expect(options.sameSite).toBe(false);
  });
});

describe('Types - SessionOperationResult', () => {
  it('should represent successful operation', () => {
    const result: SessionOperationResult = {
      success: true,
    };

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should represent failed operation with error', () => {
    const result: SessionOperationResult = {
      success: false,
      error: {
        code: 'INVALID_SESSION',
        message: 'Session not found',
      },
    };

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_SESSION');
  });
});

describe('Types - SessionError', () => {
  it('should have required code and message', () => {
    const error: SessionError = {
      code: 'CRYPTO_ERROR',
      message: 'Failed to sign cookie',
    };

    expect(error.code).toBe('CRYPTO_ERROR');
    expect(error.message).toBe('Failed to sign cookie');
  });

  it('should support optional details', () => {
    const error: SessionError = {
      code: 'STORAGE_ERROR',
      message: 'Connection failed',
      details: { connectionString: 'redis://localhost' },
    };

    expect(error.details).toBeDefined();
    expect(error.details?.connectionString).toBe('redis://localhost');
  });
});
