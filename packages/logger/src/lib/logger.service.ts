/**
 * Logger service using standard console for logging
 * Designed to be used with the @analog-tools/inject package
 * Refactored to use LoggerStyleEngine for styling and formatting
 */

import {
  isValidLogLevel,
  LoggerConfig,
  LogLevelEnum,
  LogStyling,
  LogContext,
} from './logger.types';
import {
  ErrorParam,
  ErrorSerializer,
  StructuredError,
} from './error-serialization';
import { LoggerStyleEngine } from './logger-style-engine';
import { DEFAULT_ICON_SCHEME, DEFAULT_STYLE_SCHEME } from './logger.config';
import { LoggerError } from './errors';
import { 
  LogDeduplicator, 
  MessageFormatter 
} from './deduplication/deduplicator';
import { 
  DeduplicationConfig, 
  DEFAULT_DEDUPLICATION_CONFIG 
} from './deduplication/deduplication.types';

/**
 * Logger service implementation using standard console
 * Can be injected using the @analog-tools/inject package
 * Serves as both the main logger and child logger with context
 * Uses LoggerStyleEngine for all formatting and styling operations
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
  // Track active groups for indentation
  private activeGroups: string[] = [];

  // Properties for child loggers
  private context?: string;
  private parentLogger?: LoggerService;
  // Style engine for formatting
  private styleEngine: LoggerStyleEngine;
  // Deduplicator for batching repeated messages
  private deduplicator?: LogDeduplicator;

  /**
   * Create a new LoggerService
   * @param config The logger configuration
   * @param styleEngine Optional style engine (will be created if not provided)
   * @param context Optional context for child logger
   * @param parent Optional parent logger for child logger
   */
  constructor(
    private config: LoggerConfig = {},
    styleEngine?: LoggerStyleEngine,
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
      this.styleEngine = parent.styleEngine; // Share style engine with parent
    } else {
      // Root logger setup
      if (typeof config.level === 'string' && !Object.keys(LogLevelEnum).includes(config.level)) {
        throw new LoggerError(`Invalid log level: ${config.level}`);
      }
      this.logLevel = this.castLoglevel(
        config.level || process.env['LOG_LEVEL'] || 'info'
      );
      this.name = config.name || 'analog-tools';
      this.setDisabledContexts(
        config.disabledContexts ??
          process.env['LOG_DISABLED_CONTEXTS']?.split(',') ??
          []
      );

      // Initialize style engine
      this.styleEngine = styleEngine || new LoggerStyleEngine({
        useColors: config.useColors,
        styles: { ...DEFAULT_STYLE_SCHEME, ...config.styles },
        icons: { ...DEFAULT_ICON_SCHEME, ...config.icons },
      });

      // Initialize deduplicator if enabled
      if (config.deduplication?.enabled) {
        const dedupeConfig: DeduplicationConfig = {
          enabled: true,
          windowMs: config.deduplication.windowMs ?? DEFAULT_DEDUPLICATION_CONFIG.windowMs,
          flushOnCritical: config.deduplication.flushOnCritical ?? DEFAULT_DEDUPLICATION_CONFIG.flushOnCritical,
        };

        // Create formatter function for deduplicator
        const formatter: MessageFormatter = (level, message, context) => {
          return this.styleEngine.formatMessage(level, message, this.name, context);
        };

        this.deduplicator = new LogDeduplicator(dedupeConfig, formatter);
      }
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
    // For root logger, update style engine
    const rootLogger = this.parentLogger || this;
    rootLogger.styleEngine.setUseColors(enabled);
  }

  /**
   * Check if colors are enabled
   * @returns Whether colors are enabled
   */
  getUseColors(): boolean {
    // For child loggers, get from root logger's style engine
    const rootLogger = this.parentLogger || this;
    return rootLogger.styleEngine.getUseColors();
  }

  /**
   * Create a child logger with a specific context
   * @param context The context for the child logger
   * @returns A new logger instance with the given context
   */
  forContext(context: string): LoggerService {
    if (!this.childLoggers[context]) {
      this.childLoggers[context] = new LoggerService({}, undefined, context, this);
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

    const formattedMessage = this.styleEngine.formatMessage(
      LogLevelEnum.info,
      `Group: ${groupName}`,
      this.name,
      this.context
    );
    console.group(`${formattedMessage} ▼`);
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
   * @param metadata Optional metadata for styling and icons
   */
  trace(message: string, ...data: unknown[]): void;
  trace(message: string, metadata: LogStyling, ...data: unknown[]): void;
  trace(
    message: string,
    metadataOrData?: LogStyling | unknown,
    ...data: unknown[]
  ): void {
    if (!this.isContextEnabled() || this.logLevel > LogLevelEnum.trace) return;

    const { metadata, restData } = this.styleEngine.parseMetadataParameter(
      metadataOrData,
      data
    );

    // Handle deduplication logic
    if (!this.handleDeduplication(LogLevelEnum.trace, message, metadata, restData)) {
      return; // Message was batched
    }

    if (metadata) {
      const formattedMessage = this.styleEngine.formatMessageWithMetadata(
        LogLevelEnum.trace,
        message,
        this.name,
        metadata,
        this.context
      );
      console.trace(formattedMessage, ...(restData || []));
    } else {
      const formattedMessage = this.styleEngine.formatMessage(
        LogLevelEnum.trace,
        message,
        this.name,
        this.context
      );
      console.trace(formattedMessage, ...(restData || []));
    }
  }

  /**
   * Log a debug message
   * @param message The message to log
   * @param data Additional data to log
   * @param metadata Optional metadata for styling and icons
   */
  debug(message: string, ...data: unknown[]): void;
  debug(message: string, metadata: LogStyling, ...data: unknown[]): void;
  debug(
    message: string,
    metadataOrData?: LogStyling | unknown,
    ...data: unknown[]
  ): void {
    if (!this.isContextEnabled() || this.logLevel > LogLevelEnum.debug) return;

    const { metadata, restData } = this.styleEngine.parseMetadataParameter(
      metadataOrData,
      data
    );

    // Only deduplicate simple messages (without styling metadata)
    if (!metadata && restData.length === 0) {
      if (!this.shouldLogImmediately(LogLevelEnum.debug, message)) {
        return; // Message was batched
      }
    }

    if (metadata) {
      const formattedMessage = this.styleEngine.formatMessageWithMetadata(
        LogLevelEnum.debug,
        message,
        this.name,
        metadata,
        this.context
      );
      console.debug(formattedMessage, ...(restData || []));
    } else {
      const formattedMessage = this.styleEngine.formatMessage(
        LogLevelEnum.debug,
        message,
        this.name,
        this.context
      );
      console.debug(formattedMessage, ...(restData || []));
    }
  }

  /**
   * Log an info message
   * @param message The message to log
   * @param data Additional data to log
   * @param metadata Optional metadata for styling and icons
   */
  info(message: string, ...data: unknown[]): void;
  info(message: string, metadata: LogStyling, ...data: unknown[]): void;
  info(
    message: string,
    metadataOrData?: LogStyling | unknown,
    ...data: unknown[]
  ): void {
    if (!this.isContextEnabled() || this.logLevel > LogLevelEnum.info) return;

    // Check deduplication first (only for simple messages without metadata)
    const { metadata, restData } = this.styleEngine.parseMetadataParameter(
      metadataOrData,
      data
    );

    // Only deduplicate simple messages (without styling metadata)
    if (!metadata && restData.length === 0) {
      if (!this.shouldLogImmediately(LogLevelEnum.info, message)) {
        return; // Message was batched
      }
    }

    if (metadata) {
      const formattedMessage = this.styleEngine.formatMessageWithMetadata(
        LogLevelEnum.info,
        message,
        this.name,
        metadata,
        this.context
      );
      console.info(formattedMessage, ...(restData || []));
    } else {
      const formattedMessage = this.styleEngine.formatMessage(
        LogLevelEnum.info,
        message,
        this.name,
        this.context
      );
      console.info(formattedMessage, ...(restData || []));
    }
  }

  /**
   * Log a warning message
   * @param message The message to log
   * @param data Additional data to log
   * @param metadata Optional metadata for styling and icons
   */
  warn(message: string, ...data: unknown[]): void;
  warn(message: string, metadata: LogStyling, ...data: unknown[]): void;
  warn(
    message: string,
    metadataOrData?: LogStyling | unknown,
    ...data: unknown[]
  ): void {
    if (!this.isContextEnabled() || this.logLevel > LogLevelEnum.warn) return;

    const { metadata, restData } = this.styleEngine.parseMetadataParameter(
      metadataOrData,
      data
    );

    // Only deduplicate simple messages (without styling metadata)
    if (!metadata && restData.length === 0) {
      if (!this.shouldLogImmediately(LogLevelEnum.warn, message)) {
        return; // Message was batched
      }
    }

    if (metadata) {
      const formattedMessage = this.styleEngine.formatMessageWithMetadata(
        LogLevelEnum.warn,
        message,
        this.name,
        metadata,
        this.context
      );
      console.warn(formattedMessage, ...(restData || []));
    } else {
      const formattedMessage = this.styleEngine.formatMessage(
        LogLevelEnum.warn,
        message,
        this.name,
        this.context
      );
      console.warn(formattedMessage, ...(restData || []));
    }
  }

  /**
   * Log an error message with enhanced error handling and type safety
   *
   * Supports multiple overloads for flexibility:
   * - error(message: string): Simple error message
   * - error(error: Error): Log an Error object
   * - error(message: string, error: Error): Message with Error object
   * - error(message: string, context: LogContext): Message with structured context
   * - error(message: string, error: Error, context: LogContext): Message with Error and context
   * - error(message: string, error?: ErrorParam, ...data: unknown[]): Backwards compatible overload
   * - error(message: string, ...data: unknown[], styling: LogStyling): With styling metadata
   *
   * @example
   * ```typescript
   * // Simple message
   * logger.error('Something went wrong');
   *
   * // With Error object
   * logger.error('Database connection failed', dbError);
   *
   * // With context
   * logger.error('User validation failed', { userId: '123', action: 'login' });
   *
   * // With Error and context
   * logger.error('Payment processing failed', paymentError, { orderId: 'order-123' });
   *
   * // With styling
   * logger.error('Critical error', { style: 'error', icon: '❌' });
   * ```
   */
  error(message: string): void;
  error(error: Error): void;
  error(message: string, error: Error): void;
  error(message: string, context: LogContext): void;
  error(message: string, error: Error, context: LogContext): void;
  error(message: string, error?: ErrorParam, ...data: unknown[]): void;
  error(
    messageOrError: string | Error,
    errorOrContext?: ErrorParam | LogContext,
    contextOrData?: LogContext | unknown,
    ...additionalData: unknown[]
  ): void {
    if (!this.isContextEnabled() || this.logLevel > LogLevelEnum.error) return;

    const { message, serializedError, context, data } =
      this.parseErrorParameters(
        messageOrError,
        errorOrContext,
        contextOrData,
        additionalData
      );

    // Check if last parameter is LogStyling for styling
    const allData = data || [];
    let styling: LogStyling | undefined;
    let actualData = allData;

    if (allData.length > 0) {
      const lastParam = allData[allData.length - 1];
      if (
        lastParam &&
        typeof lastParam === 'object' &&
        !Array.isArray(lastParam) &&
        ('style' in lastParam || 'icon' in lastParam)
      ) {
        styling = lastParam as LogStyling;
        actualData = allData.slice(0, -1);
      }
    }

    const formattedMessage = this.styleEngine.formatMessageWithMetadata(
      LogLevelEnum.error,
      message,
      this.name,
      styling,
      this.context
    );

    const errorParam: unknown[] = [formattedMessage];

    if (serializedError) {
      errorParam.push(serializedError);
    }

    if (context) {
      errorParam.push(context);
    }

    console.error(...errorParam, ...actualData);
  }

  /**
   * Log a fatal error message with enhanced error handling and type safety
   *
   * Supports multiple overloads for flexibility:
   * - fatal(message: string): Simple fatal message
   * - fatal(error: Error): Log a fatal Error object
   * - fatal(message: string, error: Error): Message with Error object
   * - fatal(message: string, context: LogContext): Message with structured context
   * - fatal(message: string, error: Error, context: LogContext): Message with Error and context
   * - fatal(message: string, error?: ErrorParam, ...data: unknown[]): Backwards compatible overload
   * - fatal(message: string, ...data: unknown[], styling: LogStyling): With styling metadata
   *
   * @example
   * ```typescript
   * // Simple fatal message
   * logger.fatal('Application crashed');
   *
   * // With Error object
   * logger.fatal('Critical system failure', systemError);
   *
   * // With context
   * logger.fatal('Out of memory', { heapUsed: '2GB', maxHeap: '1.5GB' });
   *
   * // With Error and context
   * logger.fatal('Database corruption detected', dbError, { tableName: 'users' });
   *
   * // With styling
   * logger.fatal('Critical error', { style: 'error', icon: '💀' });
   * ```
   */
  fatal(message: string): void;
  fatal(error: Error): void;
  fatal(message: string, error: Error): void;
  fatal(message: string, context: LogContext): void;
  fatal(message: string, error: Error, context: LogContext): void;
  fatal(message: string, error?: ErrorParam, ...data: unknown[]): void;
  fatal(
    messageOrError: string | Error,
    errorOrContext?: ErrorParam | LogContext,
    contextOrData?: LogContext | unknown,
    ...additionalData: unknown[]
  ): void {
    if (!this.isContextEnabled() || this.logLevel > LogLevelEnum.fatal) return;

    // Special handling for when second parameter is LogStyling (for styling)
    if (
      typeof messageOrError === 'string' &&
      errorOrContext &&
      typeof errorOrContext === 'object' &&
      !Array.isArray(errorOrContext) &&
      ('style' in errorOrContext || 'icon' in errorOrContext)
    ) {
      // This is the case: fatal(message, LogStyling)
      const styling = errorOrContext as LogStyling;
      const formattedMessage = this.styleEngine.formatMessageWithMetadata(
        LogLevelEnum.fatal,
        `FATAL: ${messageOrError}`,
        this.name,
        styling,
        this.context
      );
      console.error(formattedMessage);
      return;
    }

    const { message, serializedError, context, data } =
      this.parseErrorParameters(
        messageOrError,
        errorOrContext,
        contextOrData,
        additionalData
      );

    // Check if last parameter is LogStyling for styling
    const allData = data || [];
    let styling: LogStyling | undefined;
    let actualData = allData;

    if (allData.length > 0) {
      const lastParam = allData[allData.length - 1];
      if (
        lastParam &&
        typeof lastParam === 'object' &&
        !Array.isArray(lastParam) &&
        ('style' in lastParam || 'icon' in lastParam)
      ) {
        styling = lastParam as LogStyling;
        actualData = allData.slice(0, -1);
      }
    }

    const formattedMessage = this.styleEngine.formatMessageWithMetadata(
      LogLevelEnum.fatal,
      `FATAL: ${message}`,
      this.name,
      styling,
      this.context
    );

    const errorParam: unknown[] = [formattedMessage];

    if (serializedError) {
      errorParam.push(serializedError);
    }

    if (context) {
      errorParam.push(context);
    }

    console.error(...errorParam, ...actualData);
  }

  /**
   * Parse and normalize error method parameters to support multiple overloads
   *
   * Handles various parameter combinations:
   * - error(Error) -> extracts message and serializes error
   * - error(message) -> uses message as-is
   * - error(message, Error) -> uses message and serializes error
   * - error(message, LogContext) -> uses message and context
   * - error(message, Error, LogContext) -> uses all three with proper typing
   * - error(message, ...data) -> backwards compatibility mode
   *
   * @private
   * @param messageOrError - String message or Error object
   * @param errorOrContext - Error object, LogContext, or additional data
   * @param contextOrData - LogContext or additional data
   * @param additionalData - Extra data for backwards compatibility
   * @returns Parsed parameters with normalized structure
   */
  private parseErrorParameters(
    messageOrError: string | Error,
    errorOrContext?: ErrorParam | LogContext,
    contextOrData?: LogContext | unknown,
    additionalData: unknown[] = []
  ): {
    message: string;
    serializedError?: StructuredError | string;
    context?: LogContext;
    data: unknown[];
  } {
    // Case 1: error(error: Error)
    if (messageOrError instanceof Error && errorOrContext === undefined) {
      return {
        message: messageOrError.message,
        serializedError: ErrorSerializer.serialize(messageOrError),
        data: [],
      };
    }

    // Case 2: error(message: string)
    if (typeof messageOrError === 'string' && errorOrContext === undefined) {
      return {
        message: messageOrError,
        data: [],
      };
    }

    // Case 3: error(message: string, error: Error)
    if (
      typeof messageOrError === 'string' &&
      errorOrContext instanceof Error &&
      contextOrData === undefined
    ) {
      return {
        message: messageOrError,
        serializedError: ErrorSerializer.serialize(errorOrContext),
        data: [],
      };
    }

    // Case 4: error(message: string, context: LogContext)
    if (
      typeof messageOrError === 'string' &&
      this.isLogContext(errorOrContext) &&
      contextOrData === undefined
    ) {
      return {
        message: messageOrError,
        context: errorOrContext,
        data: [],
      };
    }

    // Case 5: error(message: string, error: Error, context: LogContext)
    if (
      typeof messageOrError === 'string' &&
      errorOrContext instanceof Error &&
      this.isLogContext(contextOrData)
    ) {
      return {
        message: messageOrError,
        serializedError: ErrorSerializer.serialize(errorOrContext),
        context: contextOrData,
        data: additionalData,
      };
    }

    // Backwards compatibility: error(message: string, error?: ErrorParam, ...data: unknown[])
    const message =
      typeof messageOrError === 'string' ? messageOrError : 'Unknown error';
    const serializedError = errorOrContext
      ? ErrorSerializer.serialize(errorOrContext)
      : undefined;
    const data =
      contextOrData !== undefined
        ? [contextOrData, ...additionalData]
        : additionalData;

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
  private isLogContext(obj: unknown): obj is LogContext {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      !Array.isArray(obj) &&
      !(obj instanceof Error) &&
      !(obj instanceof Date) &&
      !(obj instanceof RegExp) &&
      typeof obj !== 'function'
    );
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
      throw new LoggerError(
        `Invalid log level: ${level}. Log levels are case-sensitive. Valid levels: trace, debug, info, warn, error, fatal, silent.`
      );
    }

    throw new LoggerError(
      `Invalid log level: ${level}. Valid levels: trace, debug, info, warn, error, fatal, silent.`
    );
  }

  /**
   * Safely format a message using the style engine
   * Catches and logs any errors from the style engine
   * @param args Arguments for the style engine formatMessage method
   * @returns The formatted message
   * @private
   */
  private safeFormatMessage(
    level: LogLevelEnum,
    message: string,
    name: string,
    context = '',
    extra = ''
  ): string {
    try {
      return this.styleEngine.formatMessage(level, message, name, context, extra);
    } catch (err) {
      this.error('Style engine failure', err as Error);
      throw new LoggerError('Style engine failure');
    }
  }

  /**
   * Handle deduplication for a log message
   * @param level Log level
   * @param message Message text
   * @returns True if message should be logged immediately, false if batched
   * @private
   */
  private shouldLogImmediately(level: LogLevelEnum, message: string): boolean {
    // Get the root logger's deduplicator (child loggers share with parent)
    const rootLogger = this.parentLogger || this;
    const deduplicator = rootLogger.deduplicator;

    if (!deduplicator) {
      return true; // No deduplication, log immediately
    }

    try {
      return deduplicator.addMessage(level, message, this.context);
    } catch (error) {
      // If deduplication fails for any reason, log immediately to ensure messages aren't lost
      console.error('Logger deduplication error:', error);
      return true;
    }
  }
}
