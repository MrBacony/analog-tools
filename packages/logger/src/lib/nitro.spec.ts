import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLoggerMiddleware, withLogging } from './nitro';
import { inject } from '@analog-tools/inject';
import { LoggerService } from './logger.service';
import { H3Event } from 'h3';

// Mock h3 dependencies
vi.mock('h3', () => ({
  // @ts-expect-error any is used here to avoid type errors in the mock
  defineEventHandler: (handler) => handler,
}));

// Mock the inject function from @analog-tools/inject
vi.mock('@analog-tools/inject', () => ({
  inject: vi.fn(),
  Injectable: () => (target: unknown) => target,
}));

describe('Nitro Integration', () => {
  // Mock logger
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    forContext: vi.fn().mockReturnThis(),
  };

  // Mock event
  const mockEvent = {
    method: 'GET',
    path: '/test',
    context: {
      id: '123456',
    },
  } as unknown as H3Event;

  beforeEach(() => {
    // Set up logger mock
    const mockLoggerService = {
      forContext: vi.fn().mockImplementation((ns) => {
        mockLogger.forContext(ns);
        return mockLogger;
      }),
    };

    (inject as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      mockLoggerService
    );

    // Reset all mocks between tests
    vi.clearAllMocks();
  });

  describe('createLoggerMiddleware', () => {
    it('should create a middleware that adds a logger to the event context', async () => {
      // Arrange
      const middleware = createLoggerMiddleware('test-api');

      // Act
      await middleware(mockEvent);

      // Assert
      expect(inject).toHaveBeenCalledWith(LoggerService);
      expect(mockLogger.forContext).toHaveBeenCalledWith('test-api');
      expect(mockEvent.context['logger']).toBe(mockLogger);
      expect(mockLogger.debug).toHaveBeenCalledWith('Request received', {
        method: mockEvent.method,
        path: mockEvent.path,
        requestId: mockEvent.context['id'],
      });
    });

    it('should use default namespace if not provided', async () => {
      // Arrange
      const middleware = createLoggerMiddleware();

      // Act
      await middleware(mockEvent);

      // Assert
      expect(mockLogger.forContext).toHaveBeenCalledWith('api');
    });
  });

  describe('withLogging', () => {
    it('should wrap a handler with logging functionality - success case', async () => {
      // Arrange
      const mockResult = { success: true };
      const mockHandler = vi.fn().mockResolvedValue(mockResult);
      const wrappedHandler = withLogging(mockHandler, {
        namespace: 'test-api',
      });

      // Set up Date.now mock to control timing
      const originalDateNow = Date.now;
      Date.now = vi
        .fn()
        .mockReturnValueOnce(1000) // Start time
        .mockReturnValueOnce(1500); // End time = 500ms elapsed

      try {
        // Act
        const result = await wrappedHandler(mockEvent);

        // Assert
        expect(result).toBe(mockResult);
        expect(mockHandler).toHaveBeenCalledWith(mockEvent);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Request completed in 500ms',
          {
            method: mockEvent.method,
            path: mockEvent.path,
            duration: 500,
          }
        );
      } finally {
        // Restore original Date.now
        Date.now = originalDateNow;
      }
    });

    it('should include response in log when logResponse is true', async () => {
      // Arrange
      const mockResult = { success: true, data: { id: 1 } };
      const mockHandler = vi.fn().mockResolvedValue(mockResult);
      const wrappedHandler = withLogging(mockHandler, {
        namespace: 'test-api',
        logResponse: true,
      });

      // Mock timing
      const originalDateNow = Date.now;
      Date.now = vi.fn().mockReturnValueOnce(1000).mockReturnValueOnce(1500);

      try {
        // Act
        const result = await wrappedHandler(mockEvent);

        // Assert
        expect(result).toBe(mockResult);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Request completed in 500ms',
          {
            method: mockEvent.method,
            path: mockEvent.path,
            duration: 500,
            response: mockResult,
          }
        );
      } finally {
        Date.now = originalDateNow;
      }
    });

    it('should use info level when specified', async () => {
      // Arrange
      const mockResult = { success: true };
      const mockHandler = vi.fn().mockResolvedValue(mockResult);
      const wrappedHandler = withLogging(mockHandler, {
        namespace: 'test-api',
        level: 'info',
      });

      // Mock timing
      const originalDateNow = Date.now;
      Date.now = vi.fn().mockReturnValueOnce(1000).mockReturnValueOnce(1500);

      try {
        // Act
        await wrappedHandler(mockEvent);

        // Assert
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Request completed in 500ms',
          expect.any(Object)
        );
        expect(mockLogger.debug).not.toHaveBeenCalled();
      } finally {
        Date.now = originalDateNow;
      }
    });

    it('should log errors when handler throws', async () => {
      // Arrange
      const testError = new Error('Test error');
      const mockHandler = vi.fn().mockRejectedValue(testError);
      const wrappedHandler = withLogging(mockHandler);

      // Mock timing
      const originalDateNow = Date.now;
      Date.now = vi.fn().mockReturnValueOnce(1000).mockReturnValueOnce(1500);

      try {
        // Act & Assert
        await expect(wrappedHandler(mockEvent)).rejects.toThrow(testError);

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Request failed after 500ms',
          testError,
          {
            method: mockEvent.method,
            path: mockEvent.path,
            duration: 500,
          }
        );
      } finally {
        Date.now = originalDateNow;
      }
    });

    it('should use default options when none provided', async () => {
      // Arrange
      const mockResult = { success: true };
      const mockHandler = vi.fn().mockResolvedValue(mockResult);
      const wrappedHandler = withLogging(mockHandler);

      // Mock timing
      const originalDateNow = Date.now;
      Date.now = vi.fn().mockReturnValueOnce(1000).mockReturnValueOnce(1500);

      try {
        // Act
        await wrappedHandler(mockEvent);

        // Assert
        expect(mockLogger.forContext).toHaveBeenCalledWith('api'); // Default namespace
        expect(mockLogger.debug).toHaveBeenCalled(); // Default level is debug
      } finally {
        Date.now = originalDateNow;
      }
    });
  });
});
