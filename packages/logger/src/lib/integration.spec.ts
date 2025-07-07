import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoggerService, LogLevelEnum } from '../lib/logger.service';
import { LoggerConfig, LogLevel, isValidLogLevel } from '../lib/logger.types';

// Mock console methods
const mockConsole = {
  trace: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  log: vi.fn(),
};

// Save original console methods
const originalConsole = {
  trace: console.trace,
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
  log: console.log,
};

describe('Logger Integration with Type Safety', () => {
  beforeEach(() => {
    // Set up console mocks
    console.trace = mockConsole.trace;
    console.debug = mockConsole.debug;
    console.info = mockConsole.info;
    console.warn = mockConsole.warn;
    console.error = mockConsole.error;
    console.log = mockConsole.log;

    // Clear all mocks between tests
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original console methods
    console.trace = originalConsole.trace;
    console.debug = originalConsole.debug;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.log = originalConsole.log;

    // Clean up environment variables
    delete process.env['LOG_LEVEL'];
    delete process.env['LOG_DISABLED_CONTEXTS'];
  });

  describe('Type-safe logger configuration', () => {
    it('should work with properly typed configuration', () => {
      const config: LoggerConfig = {
        level: 'debug',
        name: 'integration-test',
        useColors: false,
        disabledContexts: ['disabled-context']
      };

      const logger = new LoggerService(config);
      expect(logger).toBeDefined();

      // Test basic logging
      logger.debug('Debug message');
      logger.info('Info message');

      expect(mockConsole.debug).toHaveBeenCalledWith(
        '[integration-test] Debug message'
      );
      expect(mockConsole.info).toHaveBeenCalledWith(
        '[integration-test] Info message'
      );
    });

    it('should handle invalid levels gracefully in production scenarios', () => {
      // Simulate a scenario where config comes from external source
      const externalConfig = {
        level: 'verbose', // Invalid level
        name: 'external-app'
      };

      const logger = new LoggerService(externalConfig as LoggerConfig);

      // Should have warned about invalid level
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('[LoggerService] Invalid log level "verbose"')
      );

      // Should fall back to info level
      logger.debug('Debug message');
      logger.info('Info message');

      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockConsole.info).toHaveBeenCalledWith(
        '[external-app] Info message'
      );
    });
  });

  describe('Child logger inheritance with type safety', () => {
    it('should maintain type safety with child loggers', () => {
      const parentConfig: LoggerConfig = {
        level: 'warn',
        name: 'parent-logger',
        disabledContexts: ['disabled']
      };

      const parentLogger = new LoggerService(parentConfig);
      const childLogger = parentLogger.forContext('child');
      const disabledLogger = parentLogger.forContext('disabled');

      // Child should inherit log level
      childLogger.info('Info message');
      childLogger.warn('Warn message');

      expect(mockConsole.info).not.toHaveBeenCalled();
      expect(mockConsole.warn).toHaveBeenCalledWith(
        '[parent-logger:child] Warn message'
      );

      // Disabled child should not log
      disabledLogger.warn('Should not appear');
      expect(mockConsole.warn).toHaveBeenCalledTimes(1); // Only the previous warn
    });

    it('should update child loggers when parent disabled contexts change', () => {
      const parentLogger = new LoggerService({ name: 'parent' });
      const childLogger = parentLogger.forContext('dynamic');

      // Initially enabled
      childLogger.info('Initial message');
      expect(mockConsole.info).toHaveBeenCalledWith(
        '[parent:dynamic] Initial message'
      );

      // Disable the context
      parentLogger.setDisabledContexts(['dynamic']);
      childLogger.info('Should be disabled');

      // Should still only have been called once
      expect(mockConsole.info).toHaveBeenCalledTimes(1);
    });
  });

  describe('Enum and type exports', () => {
    it('should export LogLevel enum for external use', () => {
      expect(LogLevelEnum.trace).toBe(0);
      expect(LogLevelEnum.debug).toBe(1);
      expect(LogLevelEnum.info).toBe(2);
      expect(LogLevelEnum.warn).toBe(3);
      expect(LogLevelEnum.error).toBe(4);
      expect(LogLevelEnum.fatal).toBe(5);
      expect(LogLevelEnum.silent).toBe(6);
    });

    it('should export isValidLogLevel function for external validation', () => {
      expect(isValidLogLevel('debug')).toBe(true);
      expect(isValidLogLevel('invalid')).toBe(false);
    });

    it('should provide LogLevel type for external use', () => {
      // This test documents that LogLevel can be used externally
      const level: LogLevel = 'debug';
      expect(level).toBe('debug');

      const config: LoggerConfig = { level };
      expect(config.level).toBe('debug');
    });
  });

  describe('Environment variable handling with type safety', () => {
    it('should validate environment variables', () => {
      process.env['LOG_LEVEL'] = 'invalid';
      
      const logger = new LoggerService({ name: 'env-test' });

      // Should have warned about invalid env var
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('[LoggerService] Invalid log level "invalid"')
      );

      // Should use info level as fallback
      logger.debug('Debug message');
      logger.info('Info message');

      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockConsole.info).toHaveBeenCalledWith(
        '[env-test] Info message'
      );
    });

    it('should work with valid environment variables', () => {
      process.env['LOG_LEVEL'] = 'error';
      
      const logger = new LoggerService({ name: 'env-test' });

      // Should not have warned
      expect(mockConsole.warn).not.toHaveBeenCalled();

      // Should use error level
      logger.warn('Warn message');
      logger.error('Error message');

      expect(mockConsole.warn).not.toHaveBeenCalled();
      expect(mockConsole.error).toHaveBeenCalledWith(
        '[env-test] Error message'
      );
    });
  });

  describe('Real-world usage scenarios', () => {
    it('should work in a typical application setup', () => {
      // Simulate typical app configuration
      const appConfig: LoggerConfig = {
        level: 'info',
        name: 'my-app',
        useColors: false
      };

      const appLogger = new LoggerService(appConfig);
      const dbLogger = appLogger.forContext('database');
      const apiLogger = appLogger.forContext('api');

      // Simulate application logging
      appLogger.info('Application starting');
      dbLogger.info('Connected to database');
      apiLogger.info('API server listening on port 3000');

      expect(mockConsole.info).toHaveBeenCalledTimes(3);
      expect(mockConsole.info).toHaveBeenNthCalledWith(1, '[my-app] Application starting');
      expect(mockConsole.info).toHaveBeenNthCalledWith(2, '[my-app:database] Connected to database');
      expect(mockConsole.info).toHaveBeenNthCalledWith(3, '[my-app:api] API server listening on port 3000');
    });

    it('should handle dynamic logger configuration', () => {
      // Start with one level
      const config: LoggerConfig = { level: 'warn', name: 'dynamic-app' };
      const logger = new LoggerService(config);

      logger.info('Should not appear');
      logger.warn('Warning message');

      expect(mockConsole.info).not.toHaveBeenCalled();
      expect(mockConsole.warn).toHaveBeenCalledWith('[dynamic-app] Warning message');

      // Simulate changing disabled contexts dynamically
      logger.setDisabledContexts(['api']);
      const apiLogger = logger.forContext('api');
      const dbLogger = logger.forContext('database');

      apiLogger.warn('API warning');  // Should not appear
      dbLogger.warn('DB warning');    // Should appear

      expect(mockConsole.warn).toHaveBeenCalledTimes(2); // Only original + db warning
      expect(mockConsole.warn).toHaveBeenLastCalledWith('[dynamic-app:database] DB warning');
    });
  });
});
