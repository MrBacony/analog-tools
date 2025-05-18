import { Level } from 'pino';

/**
 * Configuration options for the LoggerService
 */
export interface LoggerConfig {
  /**
   * The log level to use (trace, debug, info, warn, error, fatal, silent)
   * @default 'info'
   */
  level?: Level;

  /**
   * The name of the logger to use in logs
   * @default 'analog-tools'
   */
  name?: string;

  /**
   * Whether to use pretty printing in development environments
   * @default true
   */
  prettyPrint?: boolean;

  /**
   * Custom transport configuration
   */
  transport?: Record<string, unknown>;
}

/**
 * The interface for a logger instance
 */
export interface ILogger {
  /**
   * Create a child logger with a specific context
   * @param context The context for the child logger
   */
  forContext(context: string): ILogger;

  /**
   * Log a trace message
   * @param message The message to log
   * @param data Additional data to log
   */
  trace(message: string, data?: Record<string, unknown>): void;

  /**
   * Log a debug message
   * @param message The message to log
   * @param data Additional data to log
   */
  debug(message: string, data?: Record<string, unknown>): void;

  /**
   * Log an info message
   * @param message The message to log
   * @param data Additional data to log
   */
  info(message: string, data?: Record<string, unknown>): void;

  /**
   * Log a warning message
   * @param message The message to log
   * @param data Additional data to log
   */
  warn(message: string, data?: Record<string, unknown>): void;

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
  ): void;

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
  ): void;
}
