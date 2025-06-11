/**
 * Logger service using standard console for logging
 * Designed to be used with the @analog-tools/inject package
 */

import { LoggerConfig } from './logger.types';

// Log level enumeration to match standard console methods
enum LogLevel {
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
const LogLevelColors: Record<keyof typeof LogLevel, string> = {
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

  private logLevel: LogLevel;
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
      this.disabledContexts = parent.getDisabledContexts();
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
    return this.context ? !this.disabledContexts.includes(this.context) : true;
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
  getLogLevel(): LogLevel {
    return this.logLevel;
  }

  /**
   * Get disabled contexts
   * @returns Array of disabled context names
   */
  getDisabledContexts(): string[] {
    return this.disabledContexts || [];
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
      `${this.formatMessage(LogLevel.info, `Group: ${groupName}`)} ▼`
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
    if (!this.isContextEnabled() || this.logLevel > LogLevel.trace) return;
    console.trace(this.formatMessage(LogLevel.trace, message), ...(data || []));
  }

  /**
   * Log a debug message
   * @param message The message to log
   * @param data Additional data to log
   */
  debug(message: string, ...data: unknown[]): void {
    if (!this.isContextEnabled() || this.logLevel > LogLevel.debug) return;
    console.debug(this.formatMessage(LogLevel.debug, message), ...(data || []));
  }

  /**
   * Log an info message
   * @param message The message to log
   * @param data Additional data to log
   */
  info(message: string, ...data: unknown[]): void {
    if (!this.isContextEnabled() || this.logLevel > LogLevel.info) return;
    console.info(this.formatMessage(LogLevel.info, message), ...(data || []));
  }

  /**
   * Log an alternative info message (with magenta color)
   * @param message The message to log
   * @param data Additional data to log
   */
  info2(message: string, ...data: unknown[]): void {
    if (!this.isContextEnabled() || this.logLevel > LogLevel.info) return;
    console.info(
      this.formatMessage(LogLevel.info, message, Colors.fg.magenta),
      ...(data || [])
    );
  }

  /**
   * Log a warning message
   * @param message The message to log
   * @param data Additional data to log
   */
  warn(message: string, ...data: unknown[]): void {
    if (!this.isContextEnabled() || this.logLevel > LogLevel.warn) return;
    console.warn(this.formatMessage(LogLevel.warn, message), ...(data || []));
  }

  /**
   * Log an error message
   * @param message The message to log
   * @param error The error that occurred
   * @param data Additional data to log
   */
  error(message: string, error?: Error | unknown, ...data: unknown[]): void {
    if (!this.isContextEnabled() || this.logLevel > LogLevel.error) return;
    console.error(
      this.formatMessage(LogLevel.error, message),
      error,
      ...(data || [])
    );
  }

  /**
   * Log a fatal message
   * @param message The message to log
   * @param error The error that occurred
   * @param data Additional data to log
   */
  fatal(message: string, error?: Error | unknown, ...data: unknown[]): void {
    if (!this.isContextEnabled() || this.logLevel > LogLevel.fatal) return;
    console.error(
      this.formatMessage(LogLevel.fatal, `FATAL: ${message}`),
      error,
      ...(data || [])
    );
  }

  /**
   * Convert string log level to numeric LogLevel
   * @param level String log level
   * @returns Numeric LogLevel
   * @private
   */
  private castLoglevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'trace':
        return LogLevel.trace;
      case 'debug':
        return LogLevel.debug;
      case 'info':
        return LogLevel.info;
      case 'warn':
        return LogLevel.warn;
      case 'error':
        return LogLevel.error;
      case 'fatal':
        return LogLevel.fatal;
      case 'silent':
        return LogLevel.silent;
      default:
        return LogLevel.info;
    }
  }

  /**
   * Get color for a specific log level
   * @param level The log level
   * @returns ANSI color code for the log level
   * @private
   */
  private getColorForLevel(level: LogLevel): string {
    switch (level) {
      case LogLevel.trace:
        return LogLevelColors.trace;
      case LogLevel.debug:
        return LogLevelColors.debug;
      case LogLevel.info:
        return LogLevelColors.info;
      case LogLevel.warn:
        return LogLevelColors.warn;
      case LogLevel.error:
        return LogLevelColors.error;
      case LogLevel.fatal:
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
    level: LogLevel,
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
