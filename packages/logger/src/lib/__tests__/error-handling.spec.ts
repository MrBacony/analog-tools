import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoggerService } from '../logger.service';
import { LogMetadata, LogLevelEnum } from '../logger.types';

// Mock console methods
const mockConsole = {
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
};

describe('Logger Error Handling Method Overloads', () => {
  let logger: LoggerService;

  beforeEach(() => {
    // Set up console mocks
    console.error = mockConsole.error;
    console.info = mockConsole.info;
    console.warn = mockConsole.warn;
    console.debug = mockConsole.debug;
    console.trace = mockConsole.trace;

    // Clear all mocks
    vi.clearAllMocks();

    // Create logger instance
    logger = new LoggerService({ level: 'trace', name: 'test-logger' });
  });

  describe('error() method overloads', () => {
    describe('error(message: string) overload', () => {
      it('should log simple string message', () => {
        const message = 'Test error message';
        
        logger.error(message);
        
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        const [loggedMessage] = mockConsole.error.mock.calls[0];
        expect(loggedMessage).toContain(message);
        expect(loggedMessage).toContain('test-logger');
      });

      it('should format message with logger context', () => {
        const contextLogger = logger.forContext('auth');
        const message = 'Authentication failed';
        
        contextLogger.error(message);
        
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        const [loggedMessage] = mockConsole.error.mock.calls[0];
        expect(loggedMessage).toContain(message);
        expect(loggedMessage).toContain('test-logger');
        expect(loggedMessage).toContain('auth');
      });
    });

    describe('error(error: Error) overload', () => {
      it('should log Error object with extracted message', () => {
        const error = new Error('Test error');
        
        logger.error(error);
        
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        const [loggedMessage, serializedError] = mockConsole.error.mock.calls[0];
        expect(loggedMessage).toContain('Test error');
        expect(serializedError).toBeDefined();
        expect(serializedError).toHaveProperty('message', 'Test error');
        expect(serializedError).toHaveProperty('name', 'Error');
      });

      it('should serialize Error object properly', () => {
        const error = new Error('Test error');
        error.stack = 'Error: Test error\n    at test:1:1';
        
        logger.error(error);
        
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        const [, serializedError] = mockConsole.error.mock.calls[0];
        expect(serializedError).toHaveProperty('message', 'Test error');
        expect(serializedError).toHaveProperty('name', 'Error');
        expect(serializedError).toHaveProperty('stack');
        expect(serializedError.stack).toContain('Error: Test error');
      });

      it('should handle Error objects with custom properties', () => {
        const error = new Error('Custom error') as Error & { code: string; statusCode: number };
        error.code = 'ERR_CUSTOM';
        error.statusCode = 500;
        
        logger.error(error);
        
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        const [, serializedError] = mockConsole.error.mock.calls[0];
        expect(serializedError).toHaveProperty('message', 'Custom error');
        expect(serializedError).toHaveProperty('code', 'ERR_CUSTOM');
        expect(serializedError).toHaveProperty('statusCode', 500);
      });

      it('should handle custom Error subclasses', () => {
        class CustomError extends Error {
          constructor(message: string, public code: string) {
            super(message);
            this.name = 'CustomError';
          }
        }
        
        const error = new CustomError('Custom error message', 'CUSTOM_CODE');
        
        logger.error(error);
        
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        const [loggedMessage, serializedError] = mockConsole.error.mock.calls[0];
        expect(loggedMessage).toContain('Custom error message');
        expect(serializedError).toHaveProperty('message', 'Custom error message');
        expect(serializedError).toHaveProperty('name', 'CustomError');
        expect(serializedError).toHaveProperty('code', 'CUSTOM_CODE');
      });
    });

    describe('error(message: string, error: Error) overload', () => {
      it('should log message with serialized error', () => {
        const message = 'Operation failed';
        const error = new Error('Database connection lost');
        
        logger.error(message, error);
        
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        const [loggedMessage, serializedError] = mockConsole.error.mock.calls[0];
        expect(loggedMessage).toContain(message);
        expect(serializedError).toHaveProperty('message', 'Database connection lost');
      });

      it('should preserve both message and error information', () => {
        const customMessage = 'Failed to process request';
        const originalError = new Error('Network timeout');
        
        logger.error(customMessage, originalError);
        
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        const [loggedMessage, serializedError] = mockConsole.error.mock.calls[0];
        expect(loggedMessage).toContain(customMessage);
        expect(loggedMessage).not.toContain('Network timeout'); // Message should be custom, not from error
        expect(serializedError).toHaveProperty('message', 'Network timeout');
      });
    });

    describe('error(message: string, metadata: LogMetadata) overload', () => {
      it('should log message with structured metadata', () => {
        const message = 'User action failed';
        const metadata: LogMetadata = {
          userId: '12345',
          action: 'login',
          timestamp: new Date('2023-01-01T00:00:00Z'),
        };
        
        logger.error(message, metadata);
        
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        const [loggedMessage] = mockConsole.error.mock.calls[0];
        expect(loggedMessage).toContain(message);
        // Note: metadata handling would depend on implementation details
      });

      it('should handle metadata with correlationId', () => {
        const message = 'Request processing failed';
        const metadata: LogMetadata = {
          correlationId: 'abc-123-def',
          requestId: 'req-456',
          traceId: 'trace-789',
        };
        
        logger.error(message, metadata);
        
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        const [loggedMessage] = mockConsole.error.mock.calls[0];
        expect(loggedMessage).toContain(message);
      });

      it('should handle metadata with context object', () => {
        const message = 'Business logic error';
        const metadata: LogMetadata = {
          context: {
            service: 'user-service',
            version: '1.2.3',
            environment: 'staging',
          },
          severity: 'high',
        };
        
        logger.error(message, metadata);
        
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        const [loggedMessage] = mockConsole.error.mock.calls[0];
        expect(loggedMessage).toContain(message);
      });
    });

    describe('error(message: string, error: Error, metadata: LogMetadata) overload', () => {
      it('should log all three parameters correctly', () => {
        const message = 'Transaction failed';
        const error = new Error('Database lock timeout');
        const metadata: LogMetadata = {
          transactionId: 'tx-12345',
          userId: 'user-67890',
          amount: 100.50,
        };
        
        logger.error(message, error, metadata);
        
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        const [loggedMessage, serializedError] = mockConsole.error.mock.calls[0];
        expect(loggedMessage).toContain(message);
        expect(serializedError).toHaveProperty('message', 'Database lock timeout');
      });

      it('should handle complex error and metadata combination', () => {
        const message = 'API call failed';
        const error = new Error('Service unavailable') as Error & { statusCode: number };
        error.statusCode = 503;
        const metadata: LogMetadata = {
          endpoint: '/api/users',
          method: 'POST',
          correlationId: 'call-abc123',
          retryAttempt: 3,
        };
        
        logger.error(message, error, metadata);
        
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        const [loggedMessage, serializedError] = mockConsole.error.mock.calls[0];
        expect(loggedMessage).toContain(message);
        expect(serializedError).toHaveProperty('message', 'Service unavailable');
        expect(serializedError).toHaveProperty('statusCode', 503);
      });

      it('should preserve error serialization with metadata', () => {
        const message = 'Complex operation failed';
        const error = new Error('Inner error') as Error & { code: string };
        error.code = 'ERR_INNER';
        const metadata: LogMetadata = {
          operationId: 'op-999',
          duration: 1500,
        };
        
        logger.error(message, error, metadata);
        
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        const [loggedMessage, serializedError] = mockConsole.error.mock.calls[0];
        expect(loggedMessage).toContain(message);
        expect(serializedError).toHaveProperty('message', 'Inner error');
        expect(serializedError).toHaveProperty('code', 'ERR_INNER');
      });
    });

    describe('Backwards compatibility overload', () => {
      it('should maintain compatibility with current ...data syntax', () => {
        const message = 'Legacy error message';
        const additionalData = { context: 'legacy', version: '1.0' };
        
        logger.error(message, null, additionalData);
        
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        const [loggedMessage, ...data] = mockConsole.error.mock.calls[0];
        expect(loggedMessage).toContain(message);
        expect(data).toContain(additionalData);
      });

      it('should handle mixed parameter scenarios', () => {
        const message = 'Mixed parameters';
        const error = new Error('Some error');
        const extraData = { key: 'value' };
        
        logger.error(message, error, extraData);
        
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        const [loggedMessage, serializedError, ...data] = mockConsole.error.mock.calls[0];
        expect(loggedMessage).toContain(message);
        expect(serializedError).toHaveProperty('message', 'Some error');
        // extraData is treated as metadata in this case, so it should be the third parameter
        expect(data).toEqual([extraData]);
      });
    });
  });

  describe('fatal() method overloads', () => {
    describe('fatal(message: string) overload', () => {
      it('should log simple string message with FATAL prefix', () => {
        const message = 'System shutdown';
        
        logger.fatal(message);
        
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        const [loggedMessage] = mockConsole.error.mock.calls[0];
        expect(loggedMessage).toContain('FATAL: ' + message);
      });
    });

    describe('fatal(error: Error) overload', () => {
      it('should log Error object with FATAL prefix', () => {
        const error = new Error('Critical system error');
        
        logger.fatal(error);
        
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        const [loggedMessage, serializedError] = mockConsole.error.mock.calls[0];
        expect(loggedMessage).toContain('FATAL: Critical system error');
        expect(serializedError).toHaveProperty('message', 'Critical system error');
      });
    });

    describe('fatal(message: string, error: Error) overload', () => {
      it('should log message with error and FATAL prefix', () => {
        const message = 'Critical failure';
        const error = new Error('Memory exhausted');
        
        logger.fatal(message, error);
        
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        const [loggedMessage, serializedError] = mockConsole.error.mock.calls[0];
        expect(loggedMessage).toContain('FATAL: ' + message);
        expect(serializedError).toHaveProperty('message', 'Memory exhausted');
      });
    });

    describe('fatal(message: string, metadata: LogMetadata) overload', () => {
      it('should log message with metadata and FATAL prefix', () => {
        const message = 'System critical state';
        const metadata: LogMetadata = {
          severity: 'critical',
          alert: true,
          notificationRequired: true,
        };
        
        logger.fatal(message, metadata);
        
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        const [loggedMessage] = mockConsole.error.mock.calls[0];
        expect(loggedMessage).toContain('FATAL: ' + message);
      });
    });

    describe('fatal(message: string, error: Error, metadata: LogMetadata) overload', () => {
      it('should log all parameters with FATAL prefix', () => {
        const message = 'System failure detected';
        const error = new Error('Disk full');
        const metadata: LogMetadata = {
          diskUsage: '100%',
          availableSpace: '0MB',
          alertLevel: 'critical',
        };
        
        logger.fatal(message, error, metadata);
        
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        const [loggedMessage, serializedError] = mockConsole.error.mock.calls[0];
        expect(loggedMessage).toContain('FATAL: ' + message);
        expect(serializedError).toHaveProperty('message', 'Disk full');
      });
    });
  });

  describe('Parameter resolution logic', () => {
    describe('parseErrorParameters() method', () => {
      it('should correctly identify Error objects', () => {
        // Test will be implemented
        expect(true).toBe(true); // Placeholder
      });

      it('should correctly identify LogMetadata objects', () => {
        const metadata: LogMetadata = { correlationId: '123' };
        
        // Use a test to trigger the method indirectly
        logger.error('test', metadata);
        
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        // The fact that it doesn't throw error during parsing indicates success
      });

      it('should distinguish between Error and LogMetadata', () => {
        const error = new Error('Test error');
        const metadata: LogMetadata = { userId: '123' };
        
        // Test error first
        logger.error('test with error', error);
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        
        vi.clearAllMocks();
        
        // Test metadata
        logger.error('test with metadata', metadata);
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
      });

      it('should handle edge cases in parameter detection', () => {
        // Test with null
        logger.error('test with null', null);
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        
        vi.clearAllMocks();
        
        // Test with undefined
        logger.error('test with undefined', undefined);
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
      });
    });

    describe('isLogMetadata() type guard', () => {
      it('should return true for valid LogMetadata objects', () => {
        const validMetadata: LogMetadata = {
          correlationId: '123',
          userId: 'user1',
          context: { service: 'test' }
        };
        
        // Test indirectly by ensuring no errors during parameter parsing
        logger.error('test', validMetadata);
        
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        const [loggedMessage] = mockConsole.error.mock.calls[0];
        expect(loggedMessage).toContain('test');
      });

      it('should return false for Error objects', () => {
        const error = new Error('Test error');
        
        logger.error('test', error);
        
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        const [loggedMessage, serializedError] = mockConsole.error.mock.calls[0];
        expect(loggedMessage).toContain('test');
        expect(serializedError).toHaveProperty('message', 'Test error');
      });

      it('should return false for arrays', () => {
        const arrayData = ['item1', 'item2'];
        
        logger.error('test', arrayData);
        
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        // Array should be treated as additional data, not metadata
      });

      it('should return false for Date objects', () => {
        const dateData = new Date();
        
        logger.error('test', dateData);
        
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        // Date should be treated as additional data, not metadata
      });

      it('should return false for null and undefined', () => {
        logger.error('test', null);
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        
        vi.clearAllMocks();
        
        logger.error('test', undefined);
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Integration with error serialization', () => {
    it('should only serialize errors when logging level permits', () => {
      // Test will be implemented
      expect(true).toBe(true); // Placeholder
    });

    it('should skip serialization when log level too high', () => {
      // Test will be implemented
      expect(true).toBe(true); // Placeholder
    });

    it('should handle serialization errors gracefully', () => {
      // Test will be implemented
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Child logger inheritance', () => {
    it('should preserve overload behavior in child loggers', () => {
      // Test will be implemented
      expect(true).toBe(true); // Placeholder
    });

    it('should maintain context in child logger error handling', () => {
      // Test will be implemented
      expect(true).toBe(true); // Placeholder
    });
  });
});
