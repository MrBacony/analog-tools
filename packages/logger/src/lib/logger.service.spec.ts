import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LoggerService } from '../lib/logger.service';

// Mock console methods
const mockConsole = {
  trace: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  log: vi.fn()
};

// Save original console methods
const originalConsole = {
  trace: console.trace,
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
  log: console.log
};

describe('LoggerService', () => {
  let loggerService: LoggerService;

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
    
    // Create logger with test configuration
    loggerService = new LoggerService({ level: 'debug', name: 'test-logger' });
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

  it('should create a logger with the provided config', () => {
    expect(loggerService).toBeDefined();
    // Initialization message should be logged
    expect(mockConsole.info).toHaveBeenCalledWith('[test-logger] Logger initialized');
  });

  it('should log messages at the appropriate level', () => {
    loggerService.debug('Debug message', { key: 'value' });
    loggerService.info('Info message', { key: 'value' });
    loggerService.warn('Warning message', { key: 'value' });
    
    expect(mockConsole.debug).toHaveBeenCalledWith('[test-logger] Debug message', { key: 'value' });
    expect(mockConsole.info).toHaveBeenCalledWith('[test-logger] Info message', { key: 'value' });
    expect(mockConsole.warn).toHaveBeenCalledWith('[test-logger] Warning message', { key: 'value' });
    
    // Trace should not be logged since level is set to debug
    loggerService.trace('Trace message', { key: 'value' });
    expect(mockConsole.trace).not.toHaveBeenCalled();
  });

  it('should create child loggers', () => {
    const childLogger = loggerService.forContext('child');
    expect(childLogger).toBeDefined();

    childLogger.info('Child logger message');
    expect(mockConsole.info).toHaveBeenCalledWith('[test-logger:child] Child logger message');
  });

  it('should handle error logging with Error objects', () => {
    const error = new Error('Test error');
    loggerService.error('Error occurred', error, { additional: 'data' });
    
    expect(mockConsole.error).toHaveBeenCalledWith('[test-logger] Error occurred', error, { additional: 'data' });
  });

  it('should respect disabled contexts', () => {
    // Create logger with disabled contexts
    const loggerWithDisabledContexts = new LoggerService({
      level: 'debug',
      name: 'test-logger',
      disabledContexts: ['disabled-context']
    });
    
    const enabledLogger = loggerWithDisabledContexts.forContext('enabled-context');
    const disabledLogger = loggerWithDisabledContexts.forContext('disabled-context');
    
    enabledLogger.info('This should be logged');
    disabledLogger.info('This should not be logged');
    
    expect(mockConsole.info).toHaveBeenCalledWith('[test-logger:enabled-context] This should be logged');
    expect(mockConsole.info).not.toHaveBeenCalledWith('[test-logger:disabled-context] This should not be logged');
  });
});
