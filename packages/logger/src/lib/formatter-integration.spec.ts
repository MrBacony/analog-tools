import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LoggerService } from './logger.service';
import { JsonFormatter } from './formatters/json-formatter';

describe('Logger Formatter Integration', () => {
  let logger: LoggerService;

  const mockConsole = {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  const originalConsole = {
    info: console.info,
    error: console.error,
    debug: console.debug,
  };

  beforeEach(() => {
    console.info = mockConsole.info;
    console.error = mockConsole.error;
    console.debug = mockConsole.debug;
    vi.clearAllMocks();
  });

  afterEach(() => {
    console.info = originalConsole.info;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
  });

  it('should use JSON formatter when configured', () => {
    logger = new LoggerService({
      formatter: new JsonFormatter(),
      name: 'test-json'
    });

    logger.info('Structured message', { key: 'value' });

    expect(mockConsole.info).toHaveBeenCalled();
    const output = mockConsole.info.mock.calls[0][0];
    const parsed = JSON.parse(output);

    expect(parsed).toMatchObject({
      level: 'info',
      logger: 'test-json',
      message: 'Structured message',
      metadata: { key: 'value' }
    });
    expect(parsed.timestamp).toBeDefined();
  });

  it('should include correlationId in JSON output', () => {
    logger = new LoggerService({
      formatter: new JsonFormatter(),
      correlationId: 'req-123'
    });

    logger.info('Log with cid');

    const output = mockConsole.info.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.correlationId).toBe('req-123');
  });

  it('should inherit correlationId in child loggers', () => {
    logger = new LoggerService({
      formatter: new JsonFormatter(),
      correlationId: 'parent-cid'
    });

    const child = logger.forContext('child');
    child.info('Child log');

    const output = mockConsole.info.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.correlationId).toBe('parent-cid');
    expect(parsed.context).toBe('child');
  });

  it('should allow overriding correlationId in child loggers', () => {
    logger = new LoggerService({
      formatter: new JsonFormatter(),
      correlationId: 'parent-cid'
    });

    const child = logger.forContext('child');
    child.setCorrelationId('child-cid');
    child.info('Child log');

    const output = mockConsole.info.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.correlationId).toBe('child-cid');
  });

  it('should serialize errors in JSON output', () => {
    logger = new LoggerService({
      formatter: new JsonFormatter()
    });

    const error = new Error('Database connection failed');
    (error as Error & { code?: string }).code = 'ECONNREFUSED';

    logger.error('CRITICAL', error);

    const output = mockConsole.error.mock.calls[0][0];
    const parsed = JSON.parse(output);
    
    expect(parsed.level).toBe('error');
    expect(parsed.message).toBe('CRITICAL');
    expect(parsed.error).toBeDefined();
    expect(parsed.error.message).toBe('Database connection failed');
    expect(parsed.error.code).toBe('ECONNREFUSED');
    expect(parsed.error.stack).toBeDefined();
  });
});
