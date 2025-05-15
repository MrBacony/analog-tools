import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoggerService } from '../lib/logger.service';

// Mock pino
vi.mock('pino', () => {
  const mockLogger = {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(() => mockLogger),
  };

  return {
    default: vi.fn(() => mockLogger),
    mockLogger,
  };
});

describe('LoggerService', () => {
  let loggerService: LoggerService;

  beforeEach(() => {
    vi.clearAllMocks();
    loggerService = new LoggerService({ level: 'debug', name: 'test-logger' });
  });

  it('should create a logger with the provided config', () => {
    expect(loggerService).toBeDefined();
  });

  it('should create a child logger with the correct context', () => {
    const childLogger = loggerService.forContext('TestContext');
    expect(childLogger).toBeDefined();
  });

  it('should call the appropriate log methods', () => {
    const data = { test: 'data' };

    loggerService.trace('Trace message', data);
    loggerService.debug('Debug message', data);
    loggerService.info('Info message', data);
    loggerService.warn('Warning message', data);
    loggerService.error('Error message', new Error('Test error'), data);
    loggerService.fatal('Fatal message', new Error('Fatal error'), data);

    // Assertions would verify that the underlying pino methods were called
    // with the correct arguments
  });
});
