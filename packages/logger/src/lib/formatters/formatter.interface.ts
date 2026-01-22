import { LogLevelEnum, LogStyling } from '../logger.types';

/**
 * Immutable log entry for formatting
 */
export interface LogEntry {
  readonly level: LogLevelEnum;
  readonly message: string;
  readonly logger: string;
  readonly timestamp: Date;
  readonly context?: string;
  readonly metadata?: Record<string, unknown>;
  readonly error?: Error;
  readonly styling?: LogStyling;
  readonly correlationId?: string;
}

/**
 * Base formatter interface
 */
export interface ILogFormatter {
  /**
   * Format a log entry for output
   * @param entry - Immutable log entry containing all log information
   * @returns Formatted string ready for output
   */
  format(entry: LogEntry): string;

  /**
   * Check if this formatter's output is self-contained
   * 
   * Self-contained formatters (like JSON) serialize all data into the output string.
   * Non-self-contained formatters (like Console) only format the message and require
   * additional data (metadata, errors) to be passed as separate console arguments.
   * 
   * @returns True if output contains all data, false if additional console args are needed
   */
  isSelfContained(): boolean;
}

/**
 * Configuration for console formatter
 */
export interface ConsoleFormatterConfig {
  useColors?: boolean;
}

/**
 * Configuration for JSON formatter
 */
export interface JsonFormatterConfig {
  prettyPrint?: boolean;
}

/**
 * Type for custom formatter functions
 */
export type FormatterFunction = (entry: LogEntry) => string;
