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
  }
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
  silent: Colors.reset
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
  private disabledContexts: string[] = process.env['LOG_DISABLED_CONTEXTS']?.split(',') || [] ;
  private useColors: boolean;
  /**
   * Create a new LoggerService
   * @param config The logger configuration
   */
  constructor(private config: LoggerConfig = {}) {
    this.logLevel = this.castLoglevel(config.level || process.env['LOG_LEVEL'] || 'info');
    this.name = config.name || 'analog-tools';
    // Detect test environment and disable colors in tests
    const isTestEnvironment = process.env['NODE_ENV'] === 'test' || process.env['VITEST'] === 'true';
    this.useColors = isTestEnvironment ? false : (config.useColors !== false);
    if(config.disabledContexts) {
      this.setDisabledContexts(config.disabledContexts);
    }
  }

  setDisabledContexts(contexts: string[]): void {
    this.disabledContexts = contexts;
  }

  getLogLevel(): LogLevel {
    return this.logLevel;
  }

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
  forContext(context: string): ILogger {
    if(!this.childLogger[context]) {
      this.childLogger[context] = new ChildLoggerService(this.name, context, this);
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
      console.trace(this.formatMessage(LogLevel.trace, message), ...(data || []));
    }
  }

  /**
   * Log a debug message
   * @param message The message to log
   * @param data Additional data to log
   */
  debug(message: string, ...data: unknown[]): void {
    if (this.logLevel <= LogLevel.debug) {
      console.debug(this.formatMessage(LogLevel.debug, message), ...(data || []));
    }
  }

  /**
   * Log an info message
   * @param message The message to log
   * @param data Additional data to log
   */
  info(message: string, ...data: unknown[]): void {
    if (this.logLevel <= LogLevel.info) {
      console.info(this.formatMessage(LogLevel.info, message), ...(data || []));
    }
  }

  /**
   * Log a warning message
   * @param message The message to log
   * @param data Additional data to log
   */
  warn(message: string, ...data: unknown[]): void {
    if (this.logLevel <= LogLevel.warn) {
      console.warn(this.formatMessage(LogLevel.warn, message), ...(data || []));
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
      console.error(this.formatMessage(LogLevel.error, message), error, ...(data || []));
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
      console.error(this.formatMessage(LogLevel.fatal, `FATAL: ${message}`), error, ...(data || []));
    }
  }

  /**
   * Convert string log level to numeric LogLevel
   * @param level String log level
   * @returns Numeric LogLevel
   * @private
   */
  private castLoglevel(level: string): LogLevel {
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
  
  /**
   * Get color for a specific log level
   * @param level The log level
   * @returns ANSI color code for the log level
   * @private
   */
  private getColorForLevel(level: LogLevel): string {
    switch (level) {
      case LogLevel.trace: return LogLevelColors.trace;
      case LogLevel.debug: return LogLevelColors.debug;
      case LogLevel.info: return LogLevelColors.info;
      case LogLevel.warn: return LogLevelColors.warn;
      case LogLevel.error: return LogLevelColors.error;
      case LogLevel.fatal: return LogLevelColors.fatal;
      default: return Colors.reset;
    }
  }
  
  /**
   * Format a log message with color and proper prefix
   * @param level Log level for the message
   * @param message The message to format
   * @returns Formatted message with color
   * @private
   */
  private formatMessage(level: LogLevel, message: string): string {
    if (this.useColors) {
      const color = this.getColorForLevel(level);
      return `${color}[${this.name}] ${message}${Colors.reset}`;
    } else {
      return `[${this.name}] ${message}`;
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
    private parentLogger: LoggerService
  ) {}

  isEnabled() {
    return !this.parentLogger.getDisabledContexts().includes(this.context) ;
  }
  
  /**
   * Format a log message with color and proper prefix for child logger
   * @param level Log level for the message
   * @param message The message to format
   * @returns Formatted message with color
   * @private
   */
  private formatMessage(level: LogLevel, message: string): string {
    if (this.parentLogger.getUseColors()) {
      const color = this.getColorForLevel(level);
      return `${color}[${this.name}:${this.context}] ${message}${Colors.reset}`;
    } else {
      return `[${this.name}:${this.context}] ${message}`;
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
      case LogLevel.trace: return LogLevelColors.trace;
      case LogLevel.debug: return LogLevelColors.debug;
      case LogLevel.info: return LogLevelColors.info;
      case LogLevel.warn: return LogLevelColors.warn;
      case LogLevel.error: return LogLevelColors.error;
      case LogLevel.fatal: return LogLevelColors.fatal;
      default: return Colors.reset;
    }
  }

  trace(message: string, ...data: unknown[]): void {
    if (!this.isEnabled() || this.parentLogger.getLogLevel() > LogLevel.trace) return;
    console.trace(this.formatMessage(LogLevel.trace, message), ...(data || []));
  }

  debug(message: string, ...data: unknown[]): void {
    if (!this.isEnabled() || this.parentLogger.getLogLevel() > LogLevel.debug) return;
    console.debug(this.formatMessage(LogLevel.debug, message), ...(data || []));
  }

  info(message: string, ...data: unknown[]): void {
    if (!this.isEnabled() || this.parentLogger.getLogLevel() > LogLevel.info) return;
    console.info(this.formatMessage(LogLevel.info, message), ...(data || []));
  }

  warn(message: string, ...data: unknown[]): void {
    if (!this.isEnabled() || this.parentLogger.getLogLevel() > LogLevel.warn) return;
    console.warn(this.formatMessage(LogLevel.warn, message), ...(data || []));
  }

  error(
    message: string,
    error?: Error | unknown,
    ...data: unknown[]
  ): void {
    if (!this.isEnabled() || this.parentLogger.getLogLevel() > LogLevel.error) return;
    console.error(this.formatMessage(LogLevel.error, message), error, ...(data || []));
  }

  fatal(
    message: string,
    error?: Error | unknown,
    ...data: unknown[]
  ): void {
    if (!this.isEnabled() || this.parentLogger.getLogLevel() > LogLevel.fatal) return;
    console.error(this.formatMessage(LogLevel.fatal, `FATAL: ${message}`), error, ...(data || []));
  }
}
