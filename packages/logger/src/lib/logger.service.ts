/**
 * Logger service using standard console for logging
 * Designed to be used with the @analog-tools/inject package
 */

import { LoggerConfig, LogLevel as LogLevel, isValidLogLevel, LogMetadata } from './logger.types';
import { ErrorSerializer, ErrorParam, StructuredError } from './error-serialization';

// Log level enumeration to match standard console methods
export enum LogLevelEnum {
  trace = 0,
  debug = 1,
  info = 2,
  warn = 3,
  error = 4,
  fatal = 5,
  silent = 6,
}

/**
 * ANSI color codes for console output
 */
const Colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',

  fg: {
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
  },

  bg: {
    black: '\x1b[40m',
    red: '\x1b[41m',
    green: '\x1b[42m',
    yellow: '\x1b[43m',
    blue: '\x1b[44m',
    magenta: '\x1b[45m',
    cyan: '\x1b[46m',
    white: '\x1b[47m',
    gray: '\x1b[100m',
  },
};

/**
 * Color mapping for different log levels
 */
const LogLevelColors: Record<keyof typeof LogLevelEnum, string> = {
  trace: Colors.fg.gray,
  debug: Colors.fg.cyan,
  info: Colors.fg.green,
  warn: Colors.fg.yellow,
  error: Colors.fg.red,
  fatal: `${Colors.bright}${Colors.fg.red}`,
  silent: Colors.reset,
};

/**
 * Logger service implementation using standard console
 * Can be injected using the @analog-tools/inject package
 * Serves as both the main logger and child logger with context
 */
export class LoggerService {
  /**
   * Mark this service as injectable
   * This is required for the @analog-tools/inject package to recognize it
   */
  static INJECTABLE = true;

  private logLevel: LogLevelEnum;
  private name: string;
  private childLoggers: Record<string, LoggerService> = {};
  private disabledContexts: string[] = [];
  private useColors: boolean;
  // Track active groups for indentation
  private activeGroups: string[] = [];

  // Properties for child loggers
  private context?: string;
  private parentLogger?: LoggerService;

  /**
   * Create a new LoggerService
   * @param config The logger configuration
   * @param context Optional context for child logger
   * @param parent Optional parent logger for child logger
   */
  constructor(
    private config: LoggerConfig = {},
    context?: string,
    parent?: LoggerService
  ) {
    if (parent) {
      // Child logger setup
      this.parentLogger = parent;
      this.name = parent.name;
      this.context = context;
      // Inherit settings from parent
      this.logLevel = parent.getLogLevel();
      this.useColors = parent.getUseColors();
    } else {
      // Root logger setup
      this.logLevel = this.castLoglevel(
        config.level || process.env['LOG_LEVEL'] || 'info'
      );
      this.name = config.name || 'analog-tools';
      // Detect test environment and disable colors in tests
      const isTestEnvironment =
        process.env['NODE_ENV'] === 'test' || process.env['VITEST'] === 'true';
      this.useColors = isTestEnvironment ? false : config.useColors !== false;
      this.setDisabledContexts(
        config.disabledContexts ??
          process.env['LOG_DISABLED_CONTEXTS']?.split(',') ??
          []
      );
    }
  }

  /**
   * Check if this logger's context is enabled
   * Always returns true for root logger
   */
  isContextEnabled(): boolean {
    if (!this.context) return true;
    
    // For child loggers, check the root logger's disabled contexts
    const rootLogger = this.parentLogger || this;
    return !rootLogger.disabledContexts.includes(this.context);
  }

  /**
   * Set disabled contexts for this logger
   * @param contexts Array of context names to disable
   */
  setDisabledContexts(contexts: string[]): void {
    this.disabledContexts = contexts;
  }

  /**
   * Get the current log level
   * @returns The current log level
   */
  getLogLevel(): LogLevelEnum {
    return this.logLevel;
  }

  /**
   * Get disabled contexts
   * @returns Array of disabled context names
   */
  getDisabledContexts(): string[] {
    // For child loggers, get from root logger
    const rootLogger = this.parentLogger || this;
    return rootLogger.disabledContexts || [];
  }

  /**
   * Enable or disable colored output
   * @param enabled Whether colors should be enabled
   */
  setUseColors(enabled: boolean): void {
    this.useColors = enabled;
  }

  /**
   * Check if colors are enabled
   * @returns Whether colors are enabled
   */
  getUseColors(): boolean {
    return this.useColors;
  }

  /**
   * Create a child logger with a specific context
   * @param context The context for the child logger
   * @returns A new logger instance with the given context
   */
  forContext(context: string): LoggerService {
    if (!this.childLoggers[context]) {
      this.childLoggers[context] = new LoggerService({}, context, this);
    }

    return this.childLoggers[context];
  }

  /**
   * Start a new log group with the given name
   * All subsequent log messages will be indented
   * @param groupName The name of the group
   */
  group(groupName: string): void {
    if (!this.isContextEnabled()) return;

    // Use parent's active groups for child loggers
    const groups = this.parentLogger?.activeGroups || this.activeGroups;
    groups.push(groupName);

    console.group(
      `${this.formatMessage(LogLevelEnum.info, `Group: ${groupName}`)} ▼`
    );
  }

  /**
   * End a log group with the given name
   * Subsequent log messages will no longer be indented
   * @param groupName The name of the group (optional, will end the most recent group if not provided)
   */
  groupEnd(groupName?: string): void {
    if (!this.isContextEnabled()) return;

    // Use parent's active groups for child loggers
    const groups = this.parentLogger?.activeGroups || this.activeGroups;

    if (groupName) {
      // Find the specific group to end
      const index = groups.lastIndexOf(groupName);
      if (index !== -1) {
        // Remove this group and all nested groups after it
        const removed = groups.splice(index);
        for (let i = 0; i < removed.length; i++) {
          console.groupEnd();
          console.log('');
        }
      }
    } else if (groups.length > 0) {
      // End the most recent group
      groups.pop();
      console.groupEnd();
      console.log('');
    }
  }

  /**
   * Log a trace message
   * @param message The message to log
   * @param data Additional data to log
   */
  trace(message: string, ...data: unknown[]): void {
    if (!this.isContextEnabled() || this.logLevel > LogLevelEnum.trace) return;
    console.trace(this.formatMessage(LogLevelEnum.trace, message), ...(data || []));
  }

  /**
   * Log a debug message
   * @param message The message to log
   * @param data Additional data to log
   */
  debug(message: string, ...data: unknown[]): void {
    if (!this.isContextEnabled() || this.logLevel > LogLevelEnum.debug) return;
    console.debug(this.formatMessage(LogLevelEnum.debug, message), ...(data || []));
  }

  /**
   * Log an info message
   * @param message The message to log
   * @param data Additional data to log
   */
  info(message: string, ...data: unknown[]): void {
    if (!this.isContextEnabled() || this.logLevel > LogLevelEnum.info) return;
    console.info(this.formatMessage(LogLevelEnum.info, message), ...(data || []));
  }

  /**
   * Log an alternative info message (with magenta color)
   * @param message The message to log
   * @param data Additional data to log
   */
  info2(message: string, ...data: unknown[]): void {
    if (!this.isContextEnabled() || this.logLevel > LogLevelEnum.info) return;
    console.info(
      this.formatMessage(LogLevelEnum.info, message, Colors.fg.magenta),
      ...(data || [])
    );
  }

  /**
   * Log a warning message
   * @param message The message to log
   * @param data Additional data to log
   */
  warn(message: string, ...data: unknown[]): void {
    if (!this.isContextEnabled() || this.logLevel > LogLevelEnum.warn) return;
    console.warn(this.formatMessage(LogLevelEnum.warn, message), ...(data || []));
  }

  /**
   * Log an error message with enhanced error handling and type safety
   * 
   * Supports multiple overloads for flexibility:
   * - error(message: string): Simple error message
   * - error(error: Error): Log an Error object 
   * - error(message: string, error: Error): Message with Error object
   * - error(message: string, metadata: LogMetadata): Message with structured metadata
   * - error(message: string, error: Error, metadata: LogMetadata): Message with Error and metadata
   * - error(message: string, error?: ErrorParam, ...data: unknown[]): Backwards compatible overload
   * 
   * @example
   * ```typescript
   * // Simple message
   * logger.error('Something went wrong');
   * 
   * // With Error object
   * logger.error('Database connection failed', dbError);
   * 
   * // With metadata
   * logger.error('User validation failed', { userId: '123', action: 'login' });
   * 
   * // With Error and metadata
   * logger.error('Payment processing failed', paymentError, { orderId: 'order-123' });
   * ```
   */
  error(message: string): void;
  error(error: Error): void;
  error(message: string, error: Error): void;
  error(message: string, metadata: LogMetadata): void;
  error(message: string, error: Error, metadata: LogMetadata): void;
  error(message: string, error?: ErrorParam, ...data: unknown[]): void;
  error(
    messageOrError: string | Error,
    errorOrMetadata?: ErrorParam | LogMetadata,
    metadataOrData?: LogMetadata | unknown,
    ...additionalData: unknown[]
  ): void {
    if (!this.isContextEnabled() || this.logLevel > LogLevelEnum.error) return;

    const { message, serializedError, metadata, data } = this.parseErrorParameters(
      messageOrError,
      errorOrMetadata,
      metadataOrData,
      additionalData
    );

    const formattedMessage = this.formatMessage(LogLevelEnum.error, message);
    
    const errorParam: unknown[] = [formattedMessage];

    if(serializedError) {
      errorParam.push(serializedError);
    }

    if(metadata) {
      errorParam.push(metadata);
    }

    console.error(...errorParam, ...(data || []));
  }

  /**
   * Log a fatal error message with enhanced error handling and type safety
   * 
   * Supports multiple overloads for flexibility:
   * - fatal(message: string): Simple fatal message
   * - fatal(error: Error): Log a fatal Error object 
   * - fatal(message: string, error: Error): Message with Error object
   * - fatal(message: string, metadata: LogMetadata): Message with structured metadata
   * - fatal(message: string, error: Error, metadata: LogMetadata): Message with Error and metadata
   * - fatal(message: string, error?: ErrorParam, ...data: unknown[]): Backwards compatible overload
   * 
   * @example
   * ```typescript
   * // Simple fatal message
   * logger.fatal('Application crashed');
   * 
   * // With Error object
   * logger.fatal('Critical system failure', systemError);
   * 
   * // With metadata
   * logger.fatal('Out of memory', { heapUsed: '2GB', maxHeap: '1.5GB' });
   * 
   * // With Error and metadata
   * logger.fatal('Database corruption detected', dbError, { tableName: 'users' });
   * ```
   */
  fatal(message: string): void;
  fatal(error: Error): void;
  fatal(message: string, error: Error): void;
  fatal(message: string, metadata: LogMetadata): void;
  fatal(message: string, error: Error, metadata: LogMetadata): void;
  fatal(message: string, error?: ErrorParam, ...data: unknown[]): void;
  fatal(
    messageOrError: string | Error,
    errorOrMetadata?: ErrorParam | LogMetadata,
    metadataOrData?: LogMetadata | unknown,
    ...additionalData: unknown[]
  ): void {
    if (!this.isContextEnabled() || this.logLevel > LogLevelEnum.fatal) return;

    const { message, serializedError, metadata, data } = this.parseErrorParameters(
      messageOrError,
      errorOrMetadata,
      metadataOrData,
      additionalData
    );

    const formattedMessage = this.formatMessage(LogLevelEnum.fatal, `FATAL: ${message}`);
    
    const errorParam: unknown[] = [formattedMessage];

    if(serializedError) {
      errorParam.push(serializedError);
    }

    if(metadata) {
      errorParam.push(metadata);
    }

    console.error(...errorParam, ...(data || []));
  }

  /**
   * Parse and normalize error method parameters to support multiple overloads
   * 
   * Handles various parameter combinations:
   * - error(Error) -> extracts message and serializes error
   * - error(message) -> uses message as-is
   * - error(message, Error) -> uses message and serializes error
   * - error(message, LogMetadata) -> uses message and metadata
   * - error(message, Error, LogMetadata) -> uses all three with proper typing
   * - error(message, ...data) -> backwards compatibility mode
   * 
   * @private
   * @param messageOrError - String message or Error object
   * @param errorOrMetadata - Error object, LogMetadata, or additional data
   * @param metadataOrData - LogMetadata or additional data
   * @param additionalData - Extra data for backwards compatibility
   * @returns Parsed parameters with normalized structure
   */
  private parseErrorParameters(
    messageOrError: string | Error,
    errorOrMetadata?: ErrorParam | LogMetadata,
    metadataOrData?: LogMetadata | unknown,
    additionalData: unknown[] = []
  ): {
    message: string;
    serializedError?: StructuredError | string;
    metadata?: LogMetadata;
    data: unknown[];
  } {
    // Case 1: error(error: Error)
    if (messageOrError instanceof Error && errorOrMetadata === undefined) {
      return {
        message: messageOrError.message,
        serializedError: ErrorSerializer.serialize(messageOrError),
        data: []
      };
    }

    // Case 2: error(message: string)
    if (typeof messageOrError === 'string' && errorOrMetadata === undefined) {
      return {
        message: messageOrError,
        data: []
      };
    }

    // Case 3: error(message: string, error: Error)
    if (typeof messageOrError === 'string' && errorOrMetadata instanceof Error && metadataOrData === undefined) {
      return {
        message: messageOrError,
        serializedError: ErrorSerializer.serialize(errorOrMetadata),
        data: []
      };
    }

    // Case 4: error(message: string, metadata: LogMetadata)
    if (typeof messageOrError === 'string' && this.isLogMetadata(errorOrMetadata) && metadataOrData === undefined) {
      return {
        message: messageOrError,
        metadata: errorOrMetadata,
        data: []
      };
    }

    // Case 5: error(message: string, error: Error, metadata: LogMetadata)
    if (typeof messageOrError === 'string' && errorOrMetadata instanceof Error && this.isLogMetadata(metadataOrData)) {
      return {
        message: messageOrError,
        serializedError: ErrorSerializer.serialize(errorOrMetadata),
        metadata: metadataOrData,
        data: additionalData
      };
    }

    // Backwards compatibility: error(message: string, error?: ErrorParam, ...data: unknown[])
    const message = typeof messageOrError === 'string' ? messageOrError : 'Unknown error';
    const serializedError = errorOrMetadata ? ErrorSerializer.serialize(errorOrMetadata) : undefined;
    const data = metadataOrData !== undefined ? [metadataOrData, ...additionalData] : additionalData;

    return { message, serializedError, data };
  }

  /**
   * Type guard to check if an object is LogMetadata
   * 
   * LogMetadata is defined as a plain object that is not:
   * - null or undefined
   * - An Array
   * - An Error instance
   * - A Date instance
   * - A RegExp instance
   * - A Function
   * 
   * @private
   * @param obj - Object to check
   * @returns True if object matches LogMetadata interface
   */
  private isLogMetadata(obj: unknown): obj is LogMetadata {
    return typeof obj === 'object' && 
           obj !== null && 
           !Array.isArray(obj) && 
           !(obj instanceof Error) &&
           !(obj instanceof Date) &&
           !(obj instanceof RegExp) &&
           typeof obj !== 'function';
  }

  /**
   * Cast a string to a LogLevel, with runtime validation and warning for invalid levels
   * @param level String representation of log level
   * @returns Numeric LogLevel
   * @private
   */
  private castLoglevel(level: string): LogLevelEnum {
    // First check if the exact case is valid
    if (isValidLogLevel(level)) {
      // Perfect case match, no warning needed
      switch (level) {
        case 'trace':
          return LogLevelEnum.trace;
        case 'debug':
          return LogLevelEnum.debug;
        case 'info':
          return LogLevelEnum.info;
        case 'warn':
          return LogLevelEnum.warn;
        case 'error':
          return LogLevelEnum.error;
        case 'fatal':
          return LogLevelEnum.fatal;
        case 'silent':
          return LogLevelEnum.silent;
      }
    }

    // Check lowercase version
    const lowerLevel = level.toLowerCase();
    if (isValidLogLevel(lowerLevel)) {
      // Valid lowercase, but wrong case - warn about case sensitivity
      console.warn(`[LoggerService] Invalid log level "${level}". Log levels are case-sensitive. Falling back to "info". Valid levels: trace, debug, info, warn, error, fatal, silent`);
      return LogLevelEnum.info;
    }

    // Completely invalid level
    console.warn(`[LoggerService] Invalid log level "${level}". Falling back to "info". Valid levels: trace, debug, info, warn, error, fatal, silent`);
    return LogLevelEnum.info;
  }

  /**
   * Get color for a specific log level
   * @param level The log level
   * @returns ANSI color code for the log level
   * @private
   */
  private getColorForLevel(level: LogLevelEnum): string {
    switch (level) {
      case LogLevelEnum.trace:
        return LogLevelColors.trace;
      case LogLevelEnum.debug:
        return LogLevelColors.debug;
      case LogLevelEnum.info:
        return LogLevelColors.info;
      case LogLevelEnum.warn:
        return LogLevelColors.warn;
      case LogLevelEnum.error:
        return LogLevelColors.error;
      case LogLevelEnum.fatal:
        return LogLevelColors.fatal;
      default:
        return Colors.reset;
    }
  }

  /**
   * Format a log message with color and proper prefix
   * @param level Log level for the message
   * @param message The message to format
   * @param overrideColor Optional color override for the message
   * @returns Formatted message with color
   * @private
   */
  private formatMessage(
    level: LogLevelEnum,
    message: string,
    overrideColor?: string
  ): string {
    const prefix = this.context
      ? `[${this.name}:${this.context}]`
      : `[${this.name}]`;

    if (this.useColors) {
      let color = this.getColorForLevel(level);
      if (overrideColor) {
        color = overrideColor;
      }
      return `${color}${prefix} ${message}${Colors.reset}`;
    } else {
      return `${prefix} ${message}`;
    }
  }
}
