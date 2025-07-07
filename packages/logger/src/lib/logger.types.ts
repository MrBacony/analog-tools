/**
 * Valid log level strings
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';

/**
 * Type guard to check if a string is a valid log level
 * @param level - The string to check
 * @returns True if the string is a valid log level
 */
export function isValidLogLevel(level: string): level is LogLevel {
  return ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'].includes(level);
}

/**
 * Configuration options for the LoggerService
 */
export interface LoggerConfig {
  /**
   * The log level to use
   * @default 'info'
   */
  level?: LogLevel;

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
