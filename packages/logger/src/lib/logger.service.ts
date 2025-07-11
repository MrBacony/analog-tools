/**
 * Logger service using standard console for logging
 * Designed to be used with the @analog-tools/inject package
 */

import {
  ColorEnum,
  Icon,
  isValidLogLevel,
  LoggerConfig,
  LogStyling,
  LogContext,
  SemanticStyleName,
} from './logger.types';
import {
  ErrorParam,
  ErrorSerializer,
  StructuredError,
} from './error-serialization';
import { DEFAULT_ICON_SCHEME, DEFAULT_STYLE_SCHEME } from './logger.config';

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
  // Global style and icon configuration
  private globalStyles: Partial<
    Record<
      SemanticStyleName,
      { color: ColorEnum; bold?: boolean; underline?: boolean }
    >
  > = {};
  private globalIcons: Partial<
    Record<'success' | 'warning' | 'error' | 'info' | 'debug', Icon>
  > = {};

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
      this.globalStyles = parent.globalStyles;
      this.globalIcons = parent.globalIcons;
    } else {
      // Root logger setup
      this.logLevel = this.castLoglevel(
        config.level || process.env['LOG_LEVEL'] || 'info'
      );
      this.name = config.name || 'analog-tools';
      // Detect test environment and disable colors in tests unless explicitly enabled
      const isTestEnvironment =
        process.env['NODE_ENV'] === 'test' || process.env['VITEST'] === 'true';
      this.useColors =
        config.useColors !== undefined ? config.useColors : !isTestEnvironment;
      this.setDisabledContexts(
        config.disabledContexts ??
          process.env['LOG_DISABLED_CONTEXTS']?.split(',') ??
          []
      );

      // Initialize global styles and icons
      this.globalStyles = { ...DEFAULT_STYLE_SCHEME, ...config.styles };
      this.globalIcons = { ...DEFAULT_ICON_SCHEME, ...config.icons };
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

    const { metadata, restData } = this.parseMetadataParameter(
      metadataOrData,
      data
    );

    if (metadata) {
      const formattedMessage = this.formatMessageWithMetadata(
        LogLevelEnum.trace,
        message,
        metadata
      );
      console.trace(formattedMessage, ...(restData || []));
    } else {
      const formattedMessage = this.formatMessage(LogLevelEnum.trace, message);
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

    const { metadata, restData } = this.parseMetadataParameter(
      metadataOrData,
      data
    );

    if (metadata) {
      const formattedMessage = this.formatMessageWithMetadata(
        LogLevelEnum.debug,
        message,
        metadata
      );
      console.debug(formattedMessage, ...(restData || []));
    } else {
      const formattedMessage = this.formatMessage(LogLevelEnum.debug, message);
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

    const { metadata, restData } = this.parseMetadataParameter(
      metadataOrData,
      data
    );

    if (metadata) {
      const formattedMessage = this.formatMessageWithMetadata(
        LogLevelEnum.info,
        message,
        metadata
      );
      console.info(formattedMessage, ...(restData || []));
    } else {
      const formattedMessage = this.formatMessage(LogLevelEnum.info, message);
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

    const { metadata, restData } = this.parseMetadataParameter(
      metadataOrData,
      data
    );

    if (metadata) {
      const formattedMessage = this.formatMessageWithMetadata(
        LogLevelEnum.warn,
        message,
        metadata
      );
      console.warn(formattedMessage, ...(restData || []));
    } else {
      const formattedMessage = this.formatMessage(LogLevelEnum.warn, message);
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

    const formattedMessage = this.formatMessageWithMetadata(
      LogLevelEnum.error,
      message,
      styling
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
      const formattedMessage = this.formatMessageWithMetadata(
        LogLevelEnum.fatal,
        `FATAL: ${messageOrError}`,
        styling
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

    const formattedMessage = this.formatMessageWithMetadata(
      LogLevelEnum.fatal,
      `FATAL: ${message}`,
      styling
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
      console.warn(
        `[LoggerService] Invalid log level "${level}". Log levels are case-sensitive. Falling back to "info". Valid levels: trace, debug, info, warn, error, fatal, silent`
      );
      return LogLevelEnum.info;
    }

    // Completely invalid level
    console.warn(
      `[LoggerService] Invalid log level "${level}". Falling back to "info". Valid levels: trace, debug, info, warn, error, fatal, silent`
    );
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

  /**
   * Parse metadata parameter to separate metadata from additional data
   * @param metadataOrData - Could be LogStyling or additional data
   * @param data - Additional data parameters
   * @returns Parsed metadata and remaining data
   * @private
   */
  private parseMetadataParameter(
    metadataOrData?: LogStyling | unknown,
    data: unknown[] = []
  ): { metadata?: LogStyling; restData: unknown[] } {
    // Build all parameters array
    const allParams =
      metadataOrData !== undefined ? [metadataOrData, ...data] : data;

    // Check if the last parameter is LogStyling
    if (allParams.length > 0) {
      const lastParam = allParams[allParams.length - 1];

      if (
        lastParam &&
        typeof lastParam === 'object' &&
        !Array.isArray(lastParam) &&
        ('style' in lastParam || 'icon' in lastParam)
      ) {
        return {
          metadata: lastParam as LogStyling,
          restData: allParams.slice(0, -1), // Return all but the last parameter
        };
      }
    }

    // If no metadata found, return all parameters as data
    return {
      metadata: undefined,
      restData: allParams,
    };
  }

  /**
   * Format message with metadata-based styling and icons
   * @param level - Log level
   * @param message - Message to format
   * @param metadata - Optional metadata for styling
   * @returns Formatted message with styling and icons
   * @private
   */
  private formatMessageWithMetadata(
    level: LogLevelEnum,
    message: string,
    styling?: LogStyling
  ): string {
    let formattedMessage = message;
    let color = this.getColorForLevel(level);

    // Apply styling if provided
    if (styling?.style) {
      const appliedColor = this.applyStyle(styling.style);
      if (appliedColor) {
        color = appliedColor;
      }
    }

    // Add icon if provided
    if (styling?.icon) {
      const icon = this.resolveIcon(styling.icon);
      formattedMessage = `${icon} ${message}`;
    }

    // Use existing formatMessage with override color
    return this.formatMessage(level, formattedMessage, color);
  }

  /**
   * Apply style configuration and return ANSI color code
   * @param style - Style configuration (semantic name or custom config)
   * @returns ANSI color code or undefined if invalid
   * @private
   */
  private applyStyle(
    style:
      | SemanticStyleName
      | { color: ColorEnum; bold?: boolean; underline?: boolean }
  ): string | undefined {
    if (typeof style === 'string') {
      // Handle semantic style names
      return this.getSemanticStyleColor(style);
    } else if (typeof style === 'object' && style.color) {
      // Validate color is a member of ColorEnum
      const color = style.color;
      const isValidColor = Object.values(ColorEnum).includes(color);
      if (!isValidColor) {
        // Silently ignore invalid/malicious color values for security
        return undefined;
      }
      let styleCode = color;
      if (style.bold === true) {
        styleCode += '\x1b[1m'; // Add bold modifier
      }
      if (style.underline === true) {
        styleCode += '\x1b[4m'; // Add underline modifier
      }
      return styleCode;
    }

    // Log warning for unknown style and fallback
    console.warn(
      `[${
        this.context ? `${this.name}:${this.context}` : this.name
      }] Unknown style provided: ${JSON.stringify(
        style
      )}. Falling back to default.`
    );
    return undefined;
  }

  /**
   * Get ANSI color code for semantic style names
   * @param styleName - Semantic style name
   * @returns ANSI color code or undefined if unknown
   * @private
   */
  private getSemanticStyleColor(
    styleName: SemanticStyleName
  ): string | undefined {
    // Get style from global configuration or fall back to defaults
    const rootLogger = this.parentLogger || this;
    const styleConfig = rootLogger.globalStyles[styleName];

    if (styleConfig) {
      let styleCode = styleConfig.color.toString();
      if (styleConfig.bold) {
        styleCode += '\x1b[1m';
      }
      if (styleConfig.underline) {
        styleCode += '\x1b[4m';
      }
      return styleCode;
    }

    // Log warning for unknown semantic style and fallback
    console.warn(
      `[${
        this.context ? `${this.name}:${this.context}` : this.name
      }] Unknown semantic style: ${styleName}. Falling back to default.`
    );
    return undefined;
  }

  /**
   * Resolve icon to emoji character
   * @param icon - Icon name or custom string
   * @returns Emoji character
   * @private
   */
  private resolveIcon(icon: Icon | string): string {
    // If it's already an emoji (Icon type), return as-is
    if (this.isEmojiIcon(icon)) {
      return icon;
    }

    // Check if it's a semantic icon name in our global configuration
    const rootLogger = this.parentLogger || this;
    const semanticIconKeys = [
      'success',
      'warning',
      'error',
      'info',
      'debug',
    ] as const;
    const semanticIcon = semanticIconKeys.find((key) => key === icon);

    if (semanticIcon && rootLogger.globalIcons[semanticIcon]) {
      return rootLogger.globalIcons[semanticIcon] as string;
    }

    // Differentiate between unknown semantic icons and invalid icons
    if (
      semanticIconKeys.includes(
        icon as 'success' | 'warning' | 'error' | 'info' | 'debug'
      )
    ) {
      console.warn(
        `[${
          this.context ? `${this.name}:${this.context}` : this.name
        }] Unknown icon: ${icon}. Expected a valid emoji or semantic icon name.`
      );
    } else {
      console.warn(
        `[${
          this.context ? `${this.name}:${this.context}` : this.name
        }] Invalid icon: ${icon}. Expected a valid emoji or semantic icon name.`
      );
    }

    return icon;
  }

  /**
   * Check if the provided icon is a valid emoji from our Icon type
   * @param icon - Icon to check
   * @returns True if it's a valid emoji icon
   * @private
   */
  private isEmojiIcon(icon: string): icon is Icon {
    const validEmojis: Icon[] = [
      '✅',
      '⚠️',
      '❌',
      'ℹ️',
      '🐞',
      '⭐️',
      '🚀',
      '🔥',
      '✔️',
      '✖️',
      '❓',
      '🔒',
      '🔓',
      '⏳',
      '🕒',
      '⬆️',
      '⬇️',
      '➡️',
      '⬅️',
      '📁',
      '📄',
      '👤',
      '👥',
      '✏️',
      '➕',
      '➖',
      '🔔',
      '⚡️',
      '🎁',
      '🐛',
      '🌟',
      '❤️',
      '👀',
      '⚙️',
      '🔧',
      '🔨',
      '🔑',
      '🎉',
      '📝',
      '🚨',
      '📅',
      '💡',
      '🔍',
      '🔗',
      '🔖',
      '📌',
      '📎',
      '✉️',
      '📞',
      '🌍',
      '☁️',
      '🌈',
      '🌙',
      '☀️',
      '❄️',
      '✨',
      '🎵',
      '📷',
      '🎥',
      '🎤',
      '🔊',
      '🔋',
      '🗑️',
      '💰',
      '💳',
      '🎂',
      '🏅',
      '🏆',
      '👑',
      '🛸',
      '🛡️',
      '🛑',
      '▶️',
      '⏸️',
      '⏺️',
      '⏪',
      '⏩',
      '🔁',
      '🔀',
      '🎲',
      '🎈',
      '🍪',
      '☕️',
      '🍵',
      '🍺',
      '🍷',
      '🍕',
      '🍔',
      '🍟',
      '🍎',
      '🍌',
      '🍒',
      '🍋',
      '🥕',
      '🌽',
      '🥦',
      '🥚',
      '🧀',
      '🍞',
      '🍰',
      '🍦',
      '🍫',
      '🍿',
      '🥓',
      '🍤',
      '🐟',
      '🦀',
      '🐙',
      '🐋',
      '🐬',
      '🐧',
      '🐸',
      '🐢',
      '🐍',
      '🐉',
      '🦄',
      '🐱',
      '🐶',
      '🐭',
      '🐰',
      '🐻',
      '🐼',
      '🐨',
      '🐯',
      '🦁',
      '🐒',
      '🐘',
      '🐎',
      '🐄',
      '🐖',
      '🐑',
      '🐔',
      '🦆',
      '🦢',
      '🦉',
      '🦅',
      '🦜',
      '🦚',
      '🦩',
      '🦋',
      '🐝',
      '🐜',
      '🐞',
      '🕷️',
      '🦂',
      '🐌',
      '🪱',
      '🐛',
      '🦗',
      '🦟',
      '🪰',
      '🪳',
      '🪲',
    ];

    return validEmojis.includes(icon as Icon);
  }
}
