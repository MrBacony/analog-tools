
/**
 * Configuration options for the LoggerService
 */
export interface LoggerConfig {
  /**
   * The log level to use (trace, debug, info, warn, error, fatal, silent)
   * @default 'info'
   */
  level?: string;

  /**
   * The name of the logger to use in logs
   * @default 'analog-tools'
   */
  name?: string;

  /**
   * The contexts you don't want to log
   */
  disabledContexts?: string[];
  
  /**
   * Whether to use colors in the console output
   * @default true
   */
  useColors?: boolean;
}

/**
 * The interface for a logger instance
 */
export interface ILogger {

  /**
   * Log a trace message
   * @param message The message to log
   * @param data Additional data to log
   */
  trace(message: string , ...data: unknown[]): void;

  /**
   * Log a debug message
   * @param message The message to log
   * @param data Additional data to log
   */
  debug(message: string , ...data: unknown[]): void;

  /**
   * Log an info message
   * @param message The message to log
   * @param data Additional data to log
   */
  info(message: string , ...data: unknown[]): void;

  /**
   * Log a warning message
   * @param message The message to log
   * @param data Additional data to log
   */
  warn(message: string, ...data: unknown[]): void;

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
    ...data: unknown[]
  ): void;
}
