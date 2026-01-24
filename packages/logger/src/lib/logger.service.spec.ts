import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoggerService } from '../lib/logger.service';
import { ColorEnum, Icon, LogStyling, LogLevel } from './logger.types';
import { LoggerError } from './errors';

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

    expect(mockConsole.error).toHaveBeenCalledTimes(1);

    const callArgs = mockConsole.error.mock.calls[0];
    expect(callArgs[0]).toBe('[test-logger] Error occurred');

    // Verify serialized error is second argument
    expect(callArgs[1]).toEqual({
      name: 'Error',
      message: 'Test error',
      stack: expect.any(String),
    });

    // Verify metadata is third argument
    expect(callArgs[2]).toEqual({ additional: 'data' });
  });

  it('should handle error logging with only Error object', () => {
    const error = new Error('Test error');
    loggerService.error(error);

    expect(mockConsole.error).toHaveBeenCalledTimes(1);

    const callArgs = mockConsole.error.mock.calls[0];
    expect(callArgs[0]).toBe('[test-logger] Test error');

    // Verify serialized error is second argument when only error provided
    expect(callArgs[1]).toEqual({
      name: 'Error',
      message: 'Test error',
      stack: expect.any(String),
    });
  });

  it('should handle error logging with message and metadata only', () => {
    loggerService.error('Error message', { metaKey: 'metaValue' });

    expect(mockConsole.error).toHaveBeenCalledTimes(1);

    const callArgs = mockConsole.error.mock.calls[0];
    expect(callArgs[0]).toBe('[test-logger] Error message');

    // When no error object, metadata should be second argument
    expect(callArgs[1]).toEqual({ metaKey: 'metaValue' });
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

    expect(mockConsole.error).toHaveBeenCalledTimes(1);

    const callArgs = mockConsole.error.mock.calls[0];
    expect(callArgs[0]).toBe('[test-logger] FATAL: Fatal error occurred');

    // Verify serialized error is second argument
    expect(callArgs[1]).toEqual({
      name: 'Error',
      message: 'Fatal error',
      stack: expect.any(String),
    });

    // Verify metadata is third argument
    expect(callArgs[2]).toEqual({ additional: 'data' });
  });

  it('should handle fatal logging with only Error object', () => {
    const error = new Error('Fatal error');
    loggerService.fatal(error);

    expect(mockConsole.error).toHaveBeenCalledTimes(1);

    const callArgs = mockConsole.error.mock.calls[0];
    expect(callArgs[0]).toBe('[test-logger] FATAL: Fatal error');

    // Verify serialized error is second argument when only error provided
    expect(callArgs[1]).toEqual({
      name: 'Error',
      message: 'Fatal error',
      stack: expect.any(String),
    });
  });

  it('should handle fatal logging with message and metadata only', () => {
    loggerService.fatal('Fatal message', { metaKey: 'metaValue' });

    expect(mockConsole.error).toHaveBeenCalledTimes(1);

    const callArgs = mockConsole.error.mock.calls[0];
    expect(callArgs[0]).toBe('[test-logger] FATAL: Fatal message');

    // When no error object, metadata should be second argument
    expect(callArgs[1]).toEqual({ metaKey: 'metaValue' });
  });

  it('should use environment variables for log level if not provided in config', () => {
    process.env['LOG_LEVEL'] = 'error';
    const envLogger = new LoggerService({ name: 'env-logger' });

    envLogger.warn('This should not be logged');
    envLogger.error('This should be logged');

    expect(mockConsole.warn).not.toHaveBeenCalled();
    expect(mockConsole.error).toHaveBeenCalledWith(
      '[env-logger] This should be logged'
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
      '[parent:child] Error message'
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
      const logger = new LoggerService({
        level: levelConfig.level as LogLevel,
        name: 'level-test',
      });

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
          '[level-test] error message'
        );
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[level-test] FATAL: fatal message'
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
    childLogger.fatal('Fatal child error occurred', error, {
      additional: 'child-data',
    });

    expect(mockConsole.error).toHaveBeenCalledTimes(1);
    // Just check that it was called correctly - don't make detailed assertions for now
    expect(mockConsole.error.mock.calls[0][0]).toBe(
      '[test-logger:child] FATAL: Fatal child error occurred'
    );
  });

  // ============================================
  // METADATA-BASED STYLING AND ICON TESTS
  // ============================================

  describe('Metadata-based styling and icons', () => {
    let styledLogger: LoggerService;

    beforeEach(() => {
      // Clear all mocks before each test in this describe block
      vi.clearAllMocks();

      styledLogger = new LoggerService({
        level: 'trace',
        name: 'styled-logger',
        useColors: true,
        styles: {
          highlight: { color: ColorEnum.LemonYellow, bold: true },
          success: { color: ColorEnum.ForestGreen },
          error: { color: ColorEnum.FireRed },
        },
        icons: {
          success: '✅',
          warning: '⚠️',
          error: '❌',
          info: 'ℹ️',
          debug: '🐞',
        },
      });
    });

    it('should apply semantic style to log message', () => {
      const styling: LogStyling = { style: 'highlight' };
      styledLogger.info('Highlighted message', styling);

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const call = mockConsole.info.mock.calls[0];
      expect(call[0]).toContain('[styled-logger]');
      expect(call[0]).toContain('Highlighted message');
      expect(call[0]).toContain(ColorEnum.LemonYellow); // Contains color code
      expect(call[0]).toContain('\x1b[1m'); // Contains bold code
    });

    it('should apply custom style to log message', () => {
      const styling: LogStyling = {
        style: { color: ColorEnum.RoyalPurple, bold: true, underline: true },
      };
      styledLogger.info('Custom styled message', styling);

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const call = mockConsole.info.mock.calls[0];
      expect(call[0]).toContain(ColorEnum.RoyalPurple);
      expect(call[0]).toContain('\x1b[1m'); // Bold
      expect(call[0]).toContain('\x1b[4m'); // Underline
    });

    it('should apply icon to log message', () => {
      const styling: LogStyling = { icon: '🚀' };
      styledLogger.info('Message with icon', styling);

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const call = mockConsole.info.mock.calls[0];
      expect(call[0]).toContain('🚀');
      expect(call[0]).toContain('Message with icon');
    });

    it('should apply both style and icon to log message', () => {
      const metadata: LogStyling = {
        style: 'success',
        icon: '✅',
      };
      styledLogger.info('Success message', metadata);

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const call = mockConsole.info.mock.calls[0];
      expect(call[0]).toContain('✅');
      expect(call[0]).toContain(ColorEnum.ForestGreen);
      expect(call[0]).toContain('Success message');
    });

    it('should handle metadata with regular log data', () => {
      const metadata: LogStyling = { style: 'highlight', icon: '⭐️' };
      styledLogger.info('Message with data', { key: 'value' }, metadata);

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const call = mockConsole.info.mock.calls[0];
      expect(call[0]).toContain('⭐️');
      expect(call[0]).toContain(ColorEnum.LemonYellow);
      expect(call[0]).toContain('Message with data');
      expect(call[1]).toEqual({ key: 'value' });
    });

    it('should handle metadata as last parameter with multiple data objects', () => {
      const metadata: LogStyling = { style: 'attention', icon: '🔥' };
      styledLogger.info(
        'Message',
        { data1: 'value1' },
        { data2: 'value2' },
        metadata
      );

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const call = mockConsole.info.mock.calls[0];
      expect(call[0]).toContain('🔥');
      expect(call[0]).toContain('Message');
      expect(call[1]).toEqual({ data1: 'value1' });
      expect(call[2]).toEqual({ data2: 'value2' });
    });

    it('should work with all log levels', () => {
      const metadata: LogStyling = { style: 'debug', icon: '🐞' };

      styledLogger.trace('Trace message', metadata);
      styledLogger.debug('Debug message', metadata);
      styledLogger.info('Info message', metadata);
      styledLogger.warn('Warn message', metadata);

      expect(mockConsole.trace).toHaveBeenCalledTimes(1);
      expect(mockConsole.debug).toHaveBeenCalledTimes(1);
      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      expect(mockConsole.warn).toHaveBeenCalledTimes(1);

      // Check trace call
      expect(mockConsole.trace.mock.calls[0][0]).toContain('🐞');
      expect(mockConsole.trace.mock.calls[0][0]).toContain(ColorEnum.SlateGray);
    });

    it('should handle error logging with metadata', () => {
      const error = new Error('Test error');
      const metadata: LogStyling = { style: 'error', icon: '❌' };
      styledLogger.error(
        'Error occurred',
        error,
        { additional: 'data' },
        metadata
      );

      expect(mockConsole.error).toHaveBeenCalledTimes(1);
      const call = mockConsole.error.mock.calls[0];
      expect(call[0]).toContain('❌');
      expect(call[0]).toContain(ColorEnum.FireRed);
      expect(call[0]).toContain('Error occurred');
      expect(call[1]).toEqual({
        name: 'Error',
        message: 'Test error',
        stack: expect.any(String),
      });
      expect(call[2]).toEqual({ additional: 'data' });
    });

    it('should handle fatal logging with metadata', () => {
      const metadata: LogStyling = { style: 'error', icon: '💀' };
      styledLogger.fatal('Fatal error', metadata);

      expect(mockConsole.error).toHaveBeenCalledTimes(1);
      const call = mockConsole.error.mock.calls[0];
      expect(call[0]).toContain('💀');
      expect(call[0]).toContain(ColorEnum.FireRed);
      expect(call[0]).toContain('FATAL: Fatal error');
    });

    it('should use global icon configuration for semantic styles', () => {
      styledLogger.info('Info message', { icon: 'info' });

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const call = mockConsole.info.mock.calls[0];
      expect(call[0]).toContain('ℹ️'); // Should use configured info icon
    });

    it('should override global style with per-call style', () => {
      const metadata: LogStyling = {
        style: { color: ColorEnum.RoseRed, bold: false },
      };
      styledLogger.info('Override style', metadata);

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const call = mockConsole.info.mock.calls[0];
      expect(call[0]).toContain(ColorEnum.RoseRed);
      expect(call[0]).not.toContain('\x1b[1m'); // Should not be bold
    });

    it('should handle unknown semantic style gracefully', () => {
      const metadata: LogStyling = { style: 'unknown' as 'highlight' };
      styledLogger.info('Unknown style', metadata);

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      expect(mockConsole.warn).toHaveBeenCalledTimes(1);
      expect(mockConsole.warn.mock.calls[0][0]).toContain(
        'Unknown semantic style'
      );
    });

    it('should handle unknown icon gracefully', () => {
      const metadata: LogStyling = { icon: 'unknown' as 'success' };
      styledLogger.info('Unknown icon', metadata);

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      expect(mockConsole.warn).toHaveBeenCalledTimes(1);
      expect(mockConsole.warn.mock.calls[0][0]).toContain(
        '[styled-logger] Invalid icon: unknown. Expected a valid emoji or semantic icon name.'
      );
    });

    it('should handle invalid icon (not emoji) gracefully', () => {
      const metadata: LogStyling = { icon: 'invalid-icon' };
      styledLogger.info('Invalid icon', metadata);

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      expect(mockConsole.warn).toHaveBeenCalledTimes(1);
      expect(mockConsole.warn.mock.calls[0][0]).toContain('Invalid icon');
    });

    it('should not apply styling when useColors is false', () => {
      const noColorLogger = new LoggerService({
        level: 'debug',
        name: 'no-color-logger',
        useColors: false,
      });

      const metadata: LogStyling = { style: 'highlight', icon: '🚀' };
      noColorLogger.info('No color message', metadata);

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const call = mockConsole.info.mock.calls[0];
      expect(call[0]).toContain('🚀'); // Icon should still be applied
      expect(call[0]).not.toContain(ColorEnum.LemonYellow); // Color should not be applied
    });

    it('should handle metadata with child loggers', () => {
      const childLogger = styledLogger.forContext('child');
      const metadata: LogStyling = { style: 'success', icon: '✅' };
      childLogger.info('Child message', metadata);

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const call = mockConsole.info.mock.calls[0];
      expect(call[0]).toContain('✅');
      expect(call[0]).toContain(ColorEnum.ForestGreen);
      expect(call[0]).toContain('[styled-logger:child]');
    });

    it('should handle mixed metadata and regular objects', () => {
      const regularObject = { key: 'value' };
      const metadata: LogStyling = { style: 'info', icon: 'ℹ️' };

      styledLogger.info('Mixed message', regularObject, metadata);

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const call = mockConsole.info.mock.calls[0];
      expect(call[0]).toContain('ℹ️');
      expect(call[0]).toContain(ColorEnum.OceanBlue);
      expect(call[1]).toEqual(regularObject);
    });

    it('should handle empty metadata object', () => {
      const metadata: LogStyling = {};
      styledLogger.info('Empty metadata', metadata);

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const call = mockConsole.info.mock.calls[0];
      expect(call[0]).toContain('Empty metadata');
      expect(call[0]).not.toContain(ColorEnum.LemonYellow); // No styling applied
    });

    it('should handle metadata without style but with icon', () => {
      const metadata: LogStyling = { icon: '🎯' };
      styledLogger.info('Icon only', metadata);

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const call = mockConsole.info.mock.calls[0];
      expect(call[0]).toContain('🎯');
      expect(call[0]).toContain('Icon only');
    });

    it('should handle metadata without icon but with style', () => {
      const metadata: LogStyling = { style: 'warning' };
      styledLogger.info('Style only', metadata);

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const call = mockConsole.info.mock.calls[0];
      expect(call[0]).toContain(ColorEnum.TangerineOrange);
      expect(call[0]).toContain('Style only');
    });

    it('should handle semantic icon references', () => {
      const metadata: LogStyling = { icon: 'success' };
      styledLogger.info('Semantic icon', metadata);

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const call = mockConsole.info.mock.calls[0];
      expect(call[0]).toContain('✅'); // Should resolve to configured success icon
    });

    it('should handle complex color styling', () => {
      const metadata: LogStyling = {
        style: { color: ColorEnum.DeepPurple, bold: true, underline: true },
      };
      styledLogger.info('Complex styling', metadata);

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const call = mockConsole.info.mock.calls[0];
      expect(call[0]).toContain(ColorEnum.DeepPurple);
      expect(call[0]).toContain('\x1b[1m'); // Bold
      expect(call[0]).toContain('\x1b[4m'); // Underline
      expect(call[0]).toContain('\x1b[0m'); // Reset
    });

    it('should handle style with only color', () => {
      const metadata: LogStyling = {
        style: { color: ColorEnum.MintGreen },
      };
      styledLogger.info('Color only', metadata);

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const call = mockConsole.info.mock.calls[0];
      expect(call[0]).toContain(ColorEnum.MintGreen);
      expect(call[0]).not.toContain('\x1b[1m'); // Should not be bold
      expect(call[0]).not.toContain('\x1b[4m'); // Should not be underlined
    });

    it('should handle various icon types', () => {
      const icons: Icon[] = ['✅', '⚠️', '❌', 'ℹ️', '🐞', '🚀', '🔥', '⭐️'];

      icons.forEach((icon, index) => {
        const metadata: LogStyling = { icon };
        styledLogger.info(`Message ${index}`, metadata);
      });

      expect(mockConsole.info).toHaveBeenCalledTimes(icons.length);
      icons.forEach((icon, index) => {
        expect(mockConsole.info.mock.calls[index][0]).toContain(icon);
      });
    });

    it('should handle background colors', () => {
      const metadata: LogStyling = {
        style: { color: ColorEnum.SkyBlueBg },
      };
      styledLogger.info('Background color', metadata);

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const call = mockConsole.info.mock.calls[0];
      expect(call[0]).toContain(ColorEnum.SkyBlueBg);
    });

    it('should preserve original functionality when no metadata provided', () => {
      styledLogger.info('Regular message', { key: 'value' });

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const call = mockConsole.info.mock.calls[0];
      expect(call[0]).toBe('[32m[styled-logger] Regular message[0m');
      expect(call[1]).toEqual({ key: 'value' });
    });

    it('should not treat regular objects as metadata', () => {
      const regularObject = { key: 'value', someProperty: 'test' };
      styledLogger.info('Regular object', regularObject);

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const call = mockConsole.info.mock.calls[0];
      expect(call[0]).toBe('[32m[styled-logger] Regular object[0m');
      expect(call[1]).toEqual(regularObject);
    });

    it('should handle metadata that looks like regular object', () => {
      const metadata: LogStyling = {
        style: 'info',
        icon: 'ℹ️',
        someOtherProp: 'value',
      } as LogStyling;
      styledLogger.info('Metadata with extra props', metadata);

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const call = mockConsole.info.mock.calls[0];
      expect(call[0]).toContain('ℹ️');
      expect(call[0]).toContain(ColorEnum.OceanBlue);
      expect(call[0]).toContain('Metadata with extra props');
      // Should not pass metadata object to console since it was consumed
      expect(call[1]).toBeUndefined();
    });

    it('should handle invalid color enum values gracefully', () => {
      const metadata: LogStyling = {
        style: { color: 'invalid' as ColorEnum, bold: true },
      };
      styledLogger.info('Invalid color test', metadata);

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const call = mockConsole.info.mock.calls[0];
      expect(call[0]).toContain('Invalid color test');
      // Should NOT contain the invalid color string
      expect(call[0]).not.toContain('invalid');
    });

    it('should handle null and undefined metadata gracefully', () => {
      styledLogger.info('Null metadata', null as unknown);
      styledLogger.info('Undefined metadata', undefined as unknown);

      expect(mockConsole.info).toHaveBeenCalledTimes(2);
      expect(mockConsole.info.mock.calls[0][0]).toContain('Null metadata');
      expect(mockConsole.info.mock.calls[1][0]).toContain('Undefined metadata');
    });

    it('should handle circular reference in metadata', () => {
      const circularObj: Record<string, unknown> = { prop: 'value' };
      circularObj['self'] = circularObj;

      styledLogger.info('Circular reference test', circularObj);

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      expect(mockConsole.info.mock.calls[0][0]).toContain(
        'Circular reference test'
      );
      // Circular references are replaced with a string during sanitization
      const sanitizedArg = mockConsole.info.mock.calls[0][1] as Record<string, unknown>;
      expect(sanitizedArg['prop']).toBe('value');
      expect(sanitizedArg['self']).toBe('[Circular Reference]');
    });

    it('should handle deeply nested child logger contexts', () => {
      const level1 = styledLogger.forContext('level1');
      const level2 = level1.forContext('level2');
      const level3 = level2.forContext('level3');

      level3.info('Deep nested message', { style: 'success', icon: '🚀' });

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const call = mockConsole.info.mock.calls[0];
      expect(call[0]).toContain('[styled-logger:level3]');
      expect(call[0]).toContain('🚀');
      expect(call[0]).toContain(ColorEnum.ForestGreen);
    });

    it('should handle rapid consecutive logging calls', () => {
      const metadata: LogStyling = { style: 'highlight', icon: '⚡️' };

      for (let i = 0; i < 10; i++) {
        styledLogger.info(`Message ${i}`, metadata);
      }

      expect(mockConsole.info).toHaveBeenCalledTimes(10);
      for (let i = 0; i < 10; i++) {
        expect(mockConsole.info.mock.calls[i][0]).toContain(`Message ${i}`);
        expect(mockConsole.info.mock.calls[i][0]).toContain('⚡️');
      }
    });

    it('should handle large metadata objects', () => {
      const largeMetadata: LogStyling = {
        style: 'info',
        icon: '📊',
        // Add additional properties to test large metadata
        data: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          value: `item${i}`,
        })),
        timestamp: Date.now(),
        environment: 'test',
        version: '1.0.0',
      } as LogStyling;

      styledLogger.info('Large metadata test', largeMetadata);

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const call = mockConsole.info.mock.calls[0];
      expect(call[0]).toContain('📊');
      expect(call[0]).toContain(ColorEnum.OceanBlue);
      expect(call[0]).toContain('Large metadata test');
    });

    it('should handle mixed valid and invalid icons in rapid succession', () => {
      const validIcon: LogStyling = { icon: '✅' };
      const invalidIcon: LogStyling = { icon: 'not-an-emoji' };

      styledLogger.info('Valid icon', validIcon);
      styledLogger.info('Invalid icon', invalidIcon);

      expect(mockConsole.info).toHaveBeenCalledTimes(2);
      expect(mockConsole.warn).toHaveBeenCalledTimes(1);
      expect(mockConsole.info.mock.calls[0][0]).toContain('✅');
      expect(mockConsole.info.mock.calls[1][0]).toContain('not-an-emoji');
      expect(mockConsole.warn.mock.calls[0][0]).toContain('Invalid icon');
    });

    it('should handle style with all formatting options', () => {
      const metadata: LogStyling = {
        style: { color: ColorEnum.RoyalPurple, bold: true, underline: true },
        icon: '🎨',
      };

      styledLogger.info('Full formatting test', metadata);

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const call = mockConsole.info.mock.calls[0];
      expect(call[0]).toContain('🎨');
      expect(call[0]).toContain(ColorEnum.RoyalPurple);
      expect(call[0]).toContain('\x1b[1m'); // Bold
      expect(call[0]).toContain('\x1b[4m'); // Underline
      expect(call[0]).toContain('\x1b[0m'); // Reset
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle logger creation with empty config', () => {
      const emptyLogger = new LoggerService({});
      expect(emptyLogger).toBeDefined();

      emptyLogger.info('Empty config test');
      expect(mockConsole.info).toHaveBeenCalledWith(
        '[analog-tools] Empty config test'
      );
    });

    it('should handle multiple child loggers with same context', () => {
      const child1 = loggerService.forContext('same-context');
      const child2 = loggerService.forContext('same-context');

      expect(child1).toBe(child2); // Should be the same instance

      child1.info('First message');
      child2.info('Second message');

      expect(mockConsole.info).toHaveBeenCalledTimes(2);
      expect(mockConsole.info.mock.calls[0][0]).toContain(
        '[test-logger:same-context]'
      );
      expect(mockConsole.info.mock.calls[1][0]).toContain(
        '[test-logger:same-context]'
      );
    });

    it('should handle extremely long log messages', () => {
      const longMessage = 'A'.repeat(1000);
      const metadata: LogStyling = { style: 'info', icon: '📝' };

      loggerService.info(longMessage, metadata);

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const call = mockConsole.info.mock.calls[0];
      expect(call[0]).toContain(longMessage);
      expect(call[0]).toContain('📝');
    });

    it('should handle setting disabled contexts dynamically', () => {
      const dynamicLogger = new LoggerService({ name: 'dynamic-logger' });
      const childLogger = dynamicLogger.forContext('dynamic-context');

      // Initially should log
      childLogger.info('Initial message');
      expect(mockConsole.info).toHaveBeenCalledWith(
        '[dynamic-logger:dynamic-context] Initial message'
      );

      // Disable context
      dynamicLogger.setDisabledContexts(['dynamic-context']);
      childLogger.info('Should not log');

      // Should still have only 1 call
      expect(mockConsole.info).toHaveBeenCalledTimes(1);

      // Re-enable context
      dynamicLogger.setDisabledContexts([]);
      childLogger.info('Should log again');

      expect(mockConsole.info).toHaveBeenCalledTimes(2);
    });
  });

  describe('Security - Style Injection', () => {
    let logger: LoggerService;
    let output: string[];

    beforeEach(() => {
      logger = new LoggerService();
      output = [];
      vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
        output.push(args.join(' '));
      });
      vi.spyOn(console, 'info').mockImplementation((...args: unknown[]) => {
        output.push(args.join(' '));
      });
      vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
        output.push(args.join(' '));
      });
      vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
        output.push(args.join(' '));
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });
    it('should not allow ANSI escape injection via style.color', () => {
      const maliciousColor = '\x1b[0m\x1b[31mINJECTED\x1b[0m';
      logger.info('test', {
        style: { color: maliciousColor as unknown as never },
      });
      expect(output.join(' ')).not.toContain('INJECTED');
      expect(output.join(' ')).not.toContain('\x1b[31mINJECTED');
      // Check for raw escape sequence using a safe string match
      expect(output.join(' ')).not.toMatch('INJECTED');
    });

    it('should only allow valid, whitelisted color values', () => {
      logger.info('test', { style: { color: 'red' as unknown as never } });
      expect(output.join(' ')).toContain('test');
    });

    it('should ignore invalid style.color values', () => {
      logger.info('test', {
        style: { color: 'not-a-color' as unknown as never },
      });
      expect(output.join(' ')).toContain('test');
    });
  });
});

// SECURITY TESTS: Style injection
describe('Security - Style Injection', () => {
  let logger: LoggerService;
  let output: string[];

  beforeEach(() => {
    logger = new LoggerService();
    output = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      output.push(args.join(' '));
    });
    vi.spyOn(console, 'info').mockImplementation((...args: unknown[]) => {
      output.push(args.join(' '));
    });
    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      output.push(args.join(' '));
    });
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      output.push(args.join(' '));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not allow ANSI escape injection via style.color', () => {
    const maliciousColor = '\x1b[0m\x1b[31mINJECTED\x1b[0m';
    logger.info('test', {
      style: { color: maliciousColor as unknown as never },
    });
    expect(output.join(' ')).not.toContain('INJECTED');
    expect(output.join(' ')).not.toContain('\x1b[31mINJECTED');
    // eslint-disable-next-line no-control-regex
    expect(output.join(' ')).not.toMatch(
      // eslint-disable-next-line no-control-regex
      new RegExp('\\x1b\\[[0-9;]*mINJECTED')
    );
  });

  it('should only allow valid, whitelisted color values', () => {
    logger.info('test', { style: { color: 'red' as unknown as never } });
    expect(output.join(' ')).toContain('test');
  });

  it('should ignore invalid style.color values', () => {
    logger.info('test', {
      style: { color: 'not-a-color' as unknown as never },
    });
    expect(output.join(' ')).toContain('test');
  });
});
describe('LoggerService Error Handling', () => {
  it('should throw LoggerError for invalid log level', () => {
    expect(() => new LoggerService({ level: 'invalid' as LogLevel, name: 'test-logger' }))
      .toThrow(LoggerError);
  });

  it('should throw LoggerError for case-sensitive log level', () => {
    expect(() => new LoggerService({ level: 'INFO' as LogLevel, name: 'test-logger' }))
      .toThrow(LoggerError);
  });

  it('should throw LoggerError for completely invalid log level', () => {
    expect(() => new LoggerService({ level: 'nonsense' as LogLevel, name: 'test-logger' }))
      .toThrow(LoggerError);
  });
});
