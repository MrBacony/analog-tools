import { describe, expect, it, vi } from 'vitest';
import { withLogging } from '../lib/nitro';
import { LogLevel } from '../lib/logger.types';

// Mock dependencies
vi.mock('h3', () => ({
  defineEventHandler: (handler: (...args: unknown[]) => unknown) => handler,
}));

vi.mock('@analog-tools/inject', () => ({
  inject: vi.fn(),
}));

vi.mock('../index', () => ({
  LoggerService: class MockLoggerService {
    forContext() {
      return {
        trace: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        fatal: vi.fn(),
      };
    }
  },
}));

describe('Nitro Integration Type Safety', () => {
  it('should accept LogLevel types in withLogging options', () => {
    const validLevels: LogLevel[] = [
      'trace',
      'debug',
      'info', 
      'warn',
      'error',
      'fatal',
      'silent'
    ];

    validLevels.forEach(level => {
      const mockHandler = vi.fn();
      
      // This should compile without TypeScript errors
      const wrappedHandler = withLogging(mockHandler, {
        namespace: 'test',
        level: level, // Should accept LogLevel
        logResponse: false
      });

      expect(wrappedHandler).toBeDefined();
    });
  });

  it('should provide proper type safety for options', () => {
    const mockHandler = vi.fn();
    
    // Valid configuration
    const validConfig = {
      namespace: 'api',
      level: 'debug' as LogLevel,
      logResponse: true
    };

    const wrappedHandler = withLogging(mockHandler, validConfig);
    expect(wrappedHandler).toBeDefined();
  });

  it('should work with default options', () => {
    const mockHandler = vi.fn();
    
    // Should work without any options
    const wrappedHandler1 = withLogging(mockHandler);
    expect(wrappedHandler1).toBeDefined();

    // Should work with partial options
    const wrappedHandler2 = withLogging(mockHandler, {
      namespace: 'custom'
    });
    expect(wrappedHandler2).toBeDefined();

    // Should work with just level
    const wrappedHandler3 = withLogging(mockHandler, {
      level: 'warn'
    });
    expect(wrappedHandler3).toBeDefined();
  });
});
