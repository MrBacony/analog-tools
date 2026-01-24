import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LoggerService } from '../../logger.service';

describe('LoggerService sanitization integration', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should sanitize metadata by default', () => {
    const logger = new LoggerService({ level: 'info' });
    logger.info('User login', { password: 'secret123', email: 'user@test.com' });

    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls[0];
    const outputStr = JSON.stringify(output);
    expect(outputStr).toContain('[REDACTED]');
    expect(outputStr).toContain('[EMAIL]');
    expect(outputStr).not.toContain('secret123');
  });

  it('should not sanitize when disabled', () => {
    const logger = new LoggerService({
      level: 'info',
      sanitization: { enabled: false },
    });
    logger.info('User login', { password: 'secret123' });

    const output = consoleSpy.mock.calls[0];
    const outputStr = JSON.stringify(output);
    expect(outputStr).toContain('secret123');
  });

  it('should sanitize log messages', () => {
    const logger = new LoggerService({ level: 'info' });
    logger.info('Email sent to user@example.com');

    const output = consoleSpy.mock.calls[0][0];
    expect(output).toContain('[EMAIL]');
    expect(output).not.toContain('user@example.com');
  });

  it('should escape control characters in messages', () => {
    const logger = new LoggerService({ level: 'info' });
    logger.info('Line 1\nLine 2');

    const output = consoleSpy.mock.calls[0][0];
    expect(output).toContain('\\n');
    expect(output).not.toContain('\n');
  });

  it('should respect custom rules', () => {
    const logger = new LoggerService({
      level: 'info',
      sanitization: {
        customRules: [{ pattern: /custom/gi, replacement: '[CUSTOM]' }],
      },
    });
    logger.info('This custom text should be redacted');

    const output = consoleSpy.mock.calls[0][0];
    expect(output).toContain('[CUSTOM]');
  });

  it('should replace defaults with provided rules', () => {
    const logger = new LoggerService({
      level: 'info',
      sanitization: {
        rules: [{ pattern: /email/gi, replacement: '[EMAIL_REMOVED]' }],
      },
    });
    logger.info('Email: user@test.com');

    const output = consoleSpy.mock.calls[0][0];
    // Since only custom rule is used (no defaults), the email pattern is not redacted
    expect(output).toContain('user@test.com');
  });

  it('should sanitize error context', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = new LoggerService({ level: 'error' });
    logger.error('User update failed', { userId: 'user123', password: 'secret' });

    const output = errorSpy.mock.calls[0];
    const outputStr = JSON.stringify(output);
    expect(outputStr).toContain('[REDACTED]');
    expect(outputStr).not.toContain('secret');
  });

  it('should sanitize array data', () => {
    const logger = new LoggerService({ level: 'info' });
    logger.info('Batch processing', ['user@a.com', 'user@b.com']);

    const output = consoleSpy.mock.calls[0];
    const outputStr = JSON.stringify(output);
    expect(outputStr).toContain('[EMAIL]');
    expect(outputStr).not.toContain('user@a.com');
  });

  it('child loggers should inherit parent sanitizer', () => {
    const logger = new LoggerService({
      level: 'info',
      sanitization: { enabled: false },
    });
    const childLogger = logger.forContext('child');
    childLogger.info('Test email@example.com');

    const output = consoleSpy.mock.calls[0][0];
    // Child inherits disabled sanitization from parent
    expect(output).toContain('email@example.com');
  });
});
