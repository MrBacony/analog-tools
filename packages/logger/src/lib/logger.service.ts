/**
 * Logger service using standard console for logging
 * Designed to be used with the @analog-tools/inject package
 */

import { ILogger, LoggerConfig } from './logger.types';

// Log level enumeration to match standard console methods
enum LogLevel {
  trace = 0,
  debug = 1,
  info = 2,
  warn = 3,
  error = 4,
  fatal = 5,
  silent = 6
}

/**
 * Logger service implementation using standard console
 * Can be injected using the @analog-tools/inject package
 */
export class LoggerService implements ILogger {
  /**
   * Mark this service as injectable
   * This is required for the @analog-tools/inject package to recognize it
   */
  static INJECTABLE = true;

  private logLevel: LogLevel;
  private name: string;
  private childLogger: Record<string, ChildLoggerService> = {};

  /**
   * Create a new LoggerService
   * @param config The logger configuration
   */
  constructor(private config: LoggerConfig = {}) {
    this.logLevel = this.getLogLevel(config.level || process.env['LOG_LEVEL'] || 'info');
    this.name = config.name || 'analog-tools';

    console.info(`[${this.name}] Logger initialized`);
  }

  /**
   * Create a child logger with a specific context
   * @param context The context for the child logger
   * @returns A new logger instance with the given context
   */
  forContext(context: string): ILogger {
    if(!this.childLogger[context]) {
      const isEnabled = this.config.disabledContexts?.includes(context) !== true;
      this.childLogger[context] = new ChildLoggerService(this.name, context, this.logLevel, isEnabled);
    }

    return this.childLogger[context];
  }

  /**
   * Log a trace message
   * @param message The message to log
   * @param data Additional data to log
   */
  trace(message: string, ...data: unknown[]): void {
    if (this.logLevel <= LogLevel.trace) {
      console.trace(`[${this.name}] ${message}`, ...(data || []));
    }
  }

  /**
   * Log a debug message
   * @param message The message to log
   * @param data Additional data to log
   */
  debug(message: string, ...data: unknown[]): void {
    if (this.logLevel <= LogLevel.debug) {
      console.debug(`[${this.name}] ${message}`, ...(data || []));
    }
  }

  /**
   * Log an info message
   * @param message The message to log
   * @param data Additional data to log
   */
  info(message: string, ...data: unknown[]): void {
    if (this.logLevel <= LogLevel.info) {
      console.info(`[${this.name}] ${message}`, ...(data || []));
    }
  }

  /**
   * Log a warning message
   * @param message The message to log
   * @param data Additional data to log
   */
  warn(message: string, ...data: unknown[]): void {
    if (this.logLevel <= LogLevel.warn) {
      console.warn(`[${this.name}] ${message}`, ...(data || []));
    }
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
    ...data: unknown[]
  ): void {
    if (this.logLevel <= LogLevel.error) {
      console.error(`[${this.name}] ${message}`, error, ...(data || []));
    }
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
    ...data: unknown[]
  ): void {
    if (this.logLevel <= LogLevel.fatal) {
      console.error(`[${this.name}] FATAL: ${message}`, error, ...(data || []));
    }
  }

  /**
   * Convert string log level to numeric LogLevel
   * @param level String log level
   * @returns Numeric LogLevel
   * @private
   */
  private getLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'trace': return LogLevel.trace;
      case 'debug': return LogLevel.debug;
      case 'info': return LogLevel.info;
      case 'warn': return LogLevel.warn;
      case 'error': return LogLevel.error;
      case 'fatal': return LogLevel.fatal;
      case 'silent': return LogLevel.silent;
      default: return LogLevel.info;
    }
  }
}

/**
 * Child logger service implementation
 * Created by the LoggerService.forContext method
 * @internal
 */
class ChildLoggerService implements ILogger {
  constructor(
    private name: string,
    private context: string,
    private logLevel: LogLevel,
    private isEnabled: boolean
  ) {}

  forContext(context: string): ILogger {
    return new ChildLoggerService(this.name, `${this.context}:${context}`, this.logLevel, this.isEnabled);
  }

  trace(message: string, ...data: unknown[]): void {
    if (!this.isEnabled || this.logLevel > LogLevel.trace) return;
    console.trace(`[${this.name}:${this.context}] ${message}`, ...(data || []));
  }

  debug(message: string, ...data: unknown[]): void {
    if (!this.isEnabled || this.logLevel > LogLevel.debug) return;
    console.debug(`[${this.name}:${this.context}] ${message}`, ...(data || []));
  }

  info(message: string, ...data: unknown[]): void {
    if (!this.isEnabled || this.logLevel > LogLevel.info) return;
    console.info(`[${this.name}:${this.context}] ${message}`, ...(data || []));
  }

  warn(message: string, ...data: unknown[]): void {
    if (!this.isEnabled || this.logLevel > LogLevel.warn) return;
    console.warn(`[${this.name}:${this.context}] ${message}`, ...(data || []));
  }

  error(
    message: string,
    error?: Error | unknown,
    ...data: unknown[]
  ): void {
    if (!this.isEnabled || this.logLevel > LogLevel.error) return;
    console.error(`[${this.name}:${this.context}] ${message}`, error, ...(data || []));
  }

  fatal(
    message: string,
    error?: Error | unknown,
    ...data: unknown[]
  ): void {
    if (!this.isEnabled || this.logLevel > LogLevel.fatal) return;
    console.error(`[${this.name}:${this.context}] FATAL: ${message}`, error, ...(data || []));
  }
}
