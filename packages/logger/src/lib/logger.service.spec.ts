import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoggerService } from '../lib/logger.service';

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

    // Clear environment variables
    delete process.env['LOG_LEVEL'];
    delete process.env['LOG_DISABLED_CONTEXTS'];
  });

  it('should create a logger with the provided config', () => {
    expect(loggerService).toBeDefined();
  });

  it('should log messages at the appropriate level', () => {
    loggerService.debug('Debug message', { key: 'value' });
    loggerService.info('Info message', { key: 'value' });
    loggerService.warn('Warning message', { key: 'value' });

    expect(mockConsole.debug).toHaveBeenCalledWith(
      '[test-logger] Debug message',
      { key: 'value' }
    );
    expect(mockConsole.info).toHaveBeenCalledWith(
      '[test-logger] Info message',
      { key: 'value' }
    );
    expect(mockConsole.warn).toHaveBeenCalledWith(
      '[test-logger] Warning message',
      { key: 'value' }
    );

    // Trace should not be logged since level is set to debug
    loggerService.trace('Trace message', { key: 'value' });
    expect(mockConsole.trace).not.toHaveBeenCalled();
  });

  it('should create child loggers', () => {
    const childLogger = loggerService.forContext('child');
    expect(childLogger).toBeDefined();

    childLogger.info('Child logger message');
    expect(mockConsole.info).toHaveBeenCalledWith(
      '[test-logger:child] Child logger message'
    );
  });

  it('should handle error logging with Error objects', () => {
    const error = new Error('Test error');
    loggerService.error('Error occurred', error, { additional: 'data' });

    expect(mockConsole.error).toHaveBeenCalledWith(
      '[test-logger] Error occurred',
      error,
      { additional: 'data' }
    );
  });

  it('should respect disabled contexts', () => {
    // Create logger with disabled contexts
    const loggerWithDisabledContexts = new LoggerService({
      level: 'debug',
      name: 'test-logger',
      disabledContexts: ['disabled-context'],
    });

    const enabledLogger =
      loggerWithDisabledContexts.forContext('enabled-context');
    const disabledLogger =
      loggerWithDisabledContexts.forContext('disabled-context');

    enabledLogger.info('This should be logged');
    disabledLogger.info('This should not be logged');

    expect(mockConsole.info).toHaveBeenCalledWith(
      '[test-logger:enabled-context] This should be logged'
    );
    expect(mockConsole.info).not.toHaveBeenCalledWith(
      '[test-logger:disabled-context] This should not be logged'
    );
  });

  // Added tests below

  it('should handle fatal logging with Error objects', () => {
    const error = new Error('Fatal error');
    loggerService.fatal('Fatal error occurred', error, { additional: 'data' });

    expect(mockConsole.error).toHaveBeenCalledWith(
      '[test-logger] FATAL: Fatal error occurred',
      error,
      { additional: 'data' }
    );
  });

  it('should use environment variables for log level if not provided in config', () => {
    process.env['LOG_LEVEL'] = 'error';
    const envLogger = new LoggerService({ name: 'env-logger' });
    
    envLogger.warn('This should not be logged');
    envLogger.error('This should be logged');
    
    expect(mockConsole.warn).not.toHaveBeenCalled();
    expect(mockConsole.error).toHaveBeenCalledWith(
      '[env-logger] This should be logged',
      undefined
    );
  });

  it('should use environment variables for disabled contexts if not provided in config', () => {
    process.env['LOG_DISABLED_CONTEXTS'] = 'env-disabled';
    const envLogger = new LoggerService({ name: 'env-logger' });
    
    const enabledLogger = envLogger.forContext('enabled-context');
    const disabledLogger = envLogger.forContext('env-disabled');
    
    enabledLogger.info('This should be logged');
    disabledLogger.info('This should not be logged');
    
    expect(mockConsole.info).toHaveBeenCalledWith(
      '[env-logger:enabled-context] This should be logged'
    );
    expect(mockConsole.info).not.toHaveBeenCalledWith(
      '[env-logger:env-disabled] This should not be logged'
    );
  });

  it('should handle multiple child contexts correctly', () => {
    const child1 = loggerService.forContext('child1');
    const child2 = loggerService.forContext('child2');
    
    child1.info('Message from child1');
    child2.info('Message from child2');
    
    expect(mockConsole.info).toHaveBeenCalledWith(
      '[test-logger:child1] Message from child1'
    );
    expect(mockConsole.info).toHaveBeenCalledWith(
      '[test-logger:child2] Message from child2'
    );
  });

  it('should update disabled contexts when using setDisabledContexts', () => {
    const logger = new LoggerService({ name: 'test-logger' });
    const context = logger.forContext('dynamic-context');
    
    // Initially enabled
    context.info('Initially enabled');
    expect(mockConsole.info).toHaveBeenCalledWith(
      '[test-logger:dynamic-context] Initially enabled'
    );
    
    // Disable the context
    logger.setDisabledContexts(['dynamic-context']);
    context.info('Should be disabled now');
    
    // Check that the second message wasn't logged
    expect(mockConsole.info).toHaveBeenCalledTimes(1);
    expect(mockConsole.info).not.toHaveBeenCalledWith(
      '[test-logger:dynamic-context] Should be disabled now'
    );
  });

  it('should create child loggers that inherit parent log level', () => {
    const parentLogger = new LoggerService({ level: 'warn', name: 'parent' });
    const childLogger = parentLogger.forContext('child');
    
    childLogger.debug('Debug message');
    childLogger.info('Info message');
    childLogger.warn('Warning message');
    childLogger.error('Error message');
    
    expect(mockConsole.debug).not.toHaveBeenCalled();
    expect(mockConsole.info).not.toHaveBeenCalled();
    expect(mockConsole.warn).toHaveBeenCalledWith(
      '[parent:child] Warning message'
    );
    expect(mockConsole.error).toHaveBeenCalledWith(
      '[parent:child] Error message',
      undefined
    );
  });

  it('should reuse child logger instances with the same context', () => {
    const child1 = loggerService.forContext('reused');
    const child2 = loggerService.forContext('reused');
    
    // Should be the same instance
    expect(child1).toBe(child2);
  });

  it('should respect all log levels', () => {
    // Test each log level
    const levels = [
      { level: 'trace', methods: ['trace', 'debug', 'info', 'warn', 'error'] },
      { level: 'debug', methods: ['debug', 'info', 'warn', 'error'] },
      { level: 'info', methods: ['info', 'warn', 'error'] },
      { level: 'warn', methods: ['warn', 'error'] },
      { level: 'error', methods: ['error'] },
      { level: 'silent', methods: [] },
    ];
    
    for (const levelConfig of levels) {
      vi.clearAllMocks();
      const logger = new LoggerService({ level: levelConfig.level, name: 'level-test' });
      
      logger.trace('trace message');
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');
      logger.fatal('fatal message');
      
      // Check which methods got called
      // Check which methods got called
      if (levelConfig.methods.includes('trace')) {
        expect(mockConsole.trace).toHaveBeenCalledWith(
          '[level-test] trace message'
        );
      } else {
        expect(mockConsole.trace).not.toHaveBeenCalled();
      }
      
      if (levelConfig.methods.includes('debug')) {
        expect(mockConsole.debug).toHaveBeenCalledWith(
          '[level-test] debug message'
        );
      } else {
        expect(mockConsole.debug).not.toHaveBeenCalled();
      }
      
      if (levelConfig.methods.includes('info')) {
        expect(mockConsole.info).toHaveBeenCalledWith(
          '[level-test] info message'
        );
      } else {
        expect(mockConsole.info).not.toHaveBeenCalled();
      }
      
      if (levelConfig.methods.includes('warn')) {
        expect(mockConsole.warn).toHaveBeenCalledWith(
          '[level-test] warn message'
        );
      } else {
        expect(mockConsole.warn).not.toHaveBeenCalled();
      }
      
      if (levelConfig.methods.includes('error')) {
        // We need to check both error and fatal messages which both use console.error
        expect(mockConsole.error).toHaveBeenCalledTimes(2);
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[level-test] error message',
          undefined
        );
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[level-test] FATAL: fatal message',
          undefined
        );
      } else {
        expect(mockConsole.error).not.toHaveBeenCalled();
      }
    }
  });

  it('should use default config values when not provided', () => {
    const defaultLogger = new LoggerService();
    expect(defaultLogger).toBeDefined();
    
    defaultLogger.info('Using default logger');
    expect(mockConsole.info).toHaveBeenCalledWith(
      '[analog-tools] Using default logger'
    );
  });

  it('should handle child loggers with fatal level', () => {
    const childLogger = loggerService.forContext('child');
    const error = new Error('Fatal child error');
    childLogger.fatal('Fatal child error occurred', error, { additional: 'child-data' });

    expect(mockConsole.error).toHaveBeenCalledWith(
      '[test-logger:child] FATAL: Fatal child error occurred',
      error,
      { additional: 'child-data' }
    );
  });
});
