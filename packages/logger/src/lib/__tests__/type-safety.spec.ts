import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoggerService, LogLevelEnum } from '../logger.service';
import { LoggerConfig, LogLevel, isValidLogLevel } from '../logger.types';
import { LoggerError } from '../errors';

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

describe('Logger Type Safety', () => {
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
  });

  describe('LogLevel type', () => {
    it('should accept valid log level strings in config', () => {
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
        const config: LoggerConfig = { level };
        const logger = new LoggerService(config);
        expect(logger).toBeDefined();
      });
    });

    it('should work with LogLevelEnum values', () => {
      expect(LogLevelEnum.trace).toBe(0);
      expect(LogLevelEnum.debug).toBe(1);
      expect(LogLevelEnum.info).toBe(2);
      expect(LogLevelEnum.warn).toBe(3);
      expect(LogLevelEnum.error).toBe(4);
      expect(LogLevelEnum.fatal).toBe(5);
      expect(LogLevelEnum.silent).toBe(6);
    });
  });

  describe('isValidLogLevel type guard', () => {
    it('should return true for valid log levels', () => {
      expect(isValidLogLevel('trace')).toBe(true);
      expect(isValidLogLevel('debug')).toBe(true);
      expect(isValidLogLevel('info')).toBe(true);
      expect(isValidLogLevel('warn')).toBe(true);
      expect(isValidLogLevel('error')).toBe(true);
      expect(isValidLogLevel('fatal')).toBe(true);
      expect(isValidLogLevel('silent')).toBe(true);
    });

    it('should return false for invalid log levels', () => {
      expect(isValidLogLevel('invalid')).toBe(false);
      expect(isValidLogLevel('WARNING')).toBe(false);
      expect(isValidLogLevel('')).toBe(false);
      expect(isValidLogLevel('log')).toBe(false);
      expect(isValidLogLevel('verbose')).toBe(false);
    });

    it('should be case sensitive', () => {
      expect(isValidLogLevel('INFO')).toBe(false);
      expect(isValidLogLevel('Debug')).toBe(false);
      expect(isValidLogLevel('TRACE')).toBe(false);
    });
  });

  describe('Runtime validation', () => {
    it('should throw LoggerError for invalid log levels', () => {
      expect(() => new LoggerService({ 
        level: 'invalid' as LogLevel, // Force invalid level
        name: 'test-logger' 
      })).toThrow(LoggerError);
    });

    it('should throw LoggerError for case insensitive input', () => {
      expect(() => new LoggerService({ 
        level: 'INFO' as LogLevel, // Uppercase
        name: 'test-logger' 
      })).toThrow(LoggerError);
    });

      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockConsole.info).toHaveBeenCalledWith(
        '[test-logger] Info message'
      );
    });

    it('should accept valid levels without warning', () => {
      const logger = new LoggerService({ 
        level: 'debug',
        name: 'test-logger' 
      });

      // Should not have warned
      expect(mockConsole.warn).not.toHaveBeenCalled();

      // Should work at debug level
      logger.debug('Debug message');
      expect(mockConsole.debug).toHaveBeenCalledWith(
        '[test-logger] Debug message'
      );
    });
  });

  describe('Type safety in config', () => {
    it('should enforce LogLevel type in config', () => {
      // This test validates that TypeScript compilation would catch type errors
      const validConfig: LoggerConfig = {
        level: 'debug', // This should compile fine
        name: 'test-logger'
      };

      const logger = new LoggerService(validConfig);
      expect(logger).toBeDefined();
    });

    it('should provide proper intellisense for log levels', () => {
      // This test documents the expected developer experience
      const levels: LogLevel[] = [
        'trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'
      ];
      
      levels.forEach(level => {
        const config: LoggerConfig = { level };
        expect(config.level).toBe(level);
      });
    });
  });

  describe('Backwards compatibility concerns', () => {
    it('should handle environment variable LOG_LEVEL with validation', () => {
      // Test with valid env var
      process.env['LOG_LEVEL'] = 'warn';
      const logger1 = new LoggerService({ name: 'env-test' });
      
      logger1.info('Info message');
      logger1.warn('Warn message');
      
      expect(mockConsole.info).not.toHaveBeenCalled();
      expect(mockConsole.warn).toHaveBeenCalledWith(
        '[env-test] Warn message'
      );

      // Clear console mocks
      vi.clearAllMocks();

      // Test with invalid env var
      process.env['LOG_LEVEL'] = 'invalid';
      expect(() => new LoggerService({ name: 'env-test-invalid' }))
        .toThrow(LoggerError);
      // Clean up
      delete process.env['LOG_LEVEL'];
    });
  });
