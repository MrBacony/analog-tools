/**
 * Logger service using Pino for structured logging
 * Designed to be used with the @analog-tools/inject package
 */

import pino, { Logger as PinoLogger } from 'pino';
import { ILogger, LoggerConfig } from './logger.types';

/**
 * Logger service implementation using Pino
 * Can be injected using the @analog-tools/inject package
 */
export class LoggerService implements ILogger {
  /**
   * Mark this service as injectable
   * This is required for the @analog-tools/inject package to recognize it
   */
  static INJECTABLE = true;

  private logger: PinoLogger;

  /**
   * Create a new LoggerService
   * @param config The logger configuration
   */
  constructor(private config: LoggerConfig = {}) {
    this.logger = pino({
      level: config.level || process.env['LOG_LEVEL'] || 'info',
      name: config.name || 'analog-tools',
      transport:
        config.prettyPrint !== false && process.env['NODE_ENV'] !== 'production'
          ? { target: 'pino-pretty' }
          : undefined,
      ...config.transport,
    });

    this.logger.info('Logger initialized');
  }

  /**
   * Create a child logger with a specific context
   * @param context The context for the child logger
   * @returns A new logger instance with the given context
   */
  forContext(context: string): ILogger {
    const childLogger = this.logger.child({ context });
    return new ChildLoggerService(childLogger);
  }

  /**
   * Log a trace message
   * @param message The message to log
   * @param data Additional data to log
   */
  trace(message: string, data?: Record<string, unknown>): void {
    this.logger.trace(data || {}, message);
  }

  /**
   * Log a debug message
   * @param message The message to log
   * @param data Additional data to log
   */
  debug(message: string, data?: Record<string, unknown>): void {
    this.logger.debug(data || {}, message);
  }

  /**
   * Log an info message
   * @param message The message to log
   * @param data Additional data to log
   */
  info(message: string, data?: Record<string, unknown>): void {
    this.logger.info(data || {}, message);
  }

  /**
   * Log a warning message
   * @param message The message to log
   * @param data Additional data to log
   */
  warn(message: string, data?: Record<string, unknown>): void {
    this.logger.warn(data || {}, message);
  }

  /**
   * Log an error message
   * @param message The message to log
   * @param error The error that occurred
   * @param data Additional data to log
   */
  error(
    message: string,
    error?: Error | unknown,
    data?: Record<string, unknown>
  ): void {
    this.logger.error({ err: error, ...(data || {}) }, message);
  }

  /**
   * Log a fatal message
   * @param message The message to log
   * @param error The error that occurred
   * @param data Additional data to log
   */
  fatal(
    message: string,
    error?: Error | unknown,
    data?: Record<string, unknown>
  ): void {
    this.logger.fatal({ err: error, ...(data || {}) }, message);
  }
}

/**
 * Child logger service implementation
 * Created by the LoggerService.forContext method
 * @internal
 */
class ChildLoggerService implements ILogger {
  constructor(private logger: PinoLogger) {}

  forContext(context: string): ILogger {
    const childLogger = this.logger.child({ context });
    return new ChildLoggerService(childLogger);
  }

  trace(message: string, data?: Record<string, unknown>): void {
    this.logger.trace(data || {}, message);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.logger.debug(data || {}, message);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.logger.info(data || {}, message);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.logger.warn(data || {}, message);
  }

  error(
    message: string,
    error?: Error | unknown,
    data?: Record<string, unknown>
  ): void {
    this.logger.error({ err: error, ...(data || {}) }, message);
  }

  fatal(
    message: string,
    error?: Error | unknown,
    data?: Record<string, unknown>
  ): void {
    this.logger.fatal({ err: error, ...(data || {}) }, message);
  }
}
