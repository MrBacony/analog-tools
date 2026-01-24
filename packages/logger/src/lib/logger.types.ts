import { ILogFormatter } from './formatters/formatter.interface';
import { SanitizationConfig } from './sanitization';

/**
 * Enum for dreamy color names with ANSI codes for terminal
 * Each color has 3 shades and a background variant
 */
export enum ColorEnum {
  // Blue shades
  SkyBlue = '\x1b[94m',         // Bright blue
  OceanBlue = '\x1b[34m',       // Standard blue
  MidnightBlue = '\x1b[38;5;17m', // Deep blue (unique)
  SkyBlueBg = '\x1b[104m',
  OceanBlueBg = '\x1b[44m',
  MidnightBlueBg = '\x1b[48;5;17m',

  // Green shades
  MintGreen = '\x1b[92m',         // Bright green
  ForestGreen = '\x1b[32m',       // Standard green
  EmeraldGreen = '\x1b[38;5;28m', // Deep green (unique)
  MintGreenBg = '\x1b[102m',
  ForestGreenBg = '\x1b[42m',
  EmeraldGreenBg = '\x1b[48;5;28m',

  // Yellow shades
  LemonYellow = '\x1b[93m',         // Bright yellow
  SunflowerYellow = '\x1b[33m',     // Standard yellow
  GoldYellow = '\x1b[38;5;220m',    // Gold (unique)
  LemonYellowBg = '\x1b[103m',
  SunflowerYellowBg = '\x1b[43m',
  GoldYellowBg = '\x1b[48;5;220m',

  // Red shades
  RoseRed = '\x1b[91m',         // Bright red
  FireRed = '\x1b[31m',         // Standard red
  BurgundyRed = '\x1b[38;5;88m',// Deep red (unique)
  RoseRedBg = '\x1b[101m',
  FireRedBg = '\x1b[41m',
  BurgundyRedBg = '\x1b[48;5;88m',

  // Purple shades
  LavenderPurple = '\x1b[95m',         // Bright purple
  RoyalPurple = '\x1b[38;5;93m',       // Medium purple (unique)
  DeepPurple = '\x1b[38;5;54m',        // Deep purple (unique)
  LavenderPurpleBg = '\x1b[105m',
  RoyalPurpleBg = '\x1b[48;5;93m',
  DeepPurpleBg = '\x1b[48;5;54m',

  // Orange shades
  PeachOrange = '\x1b[38;5;215m',      // Light orange
  TangerineOrange = '\x1b[38;5;208m',  // Standard orange
  AmberOrange = '\x1b[38;5;214m',      // Deep orange
  PeachOrangeBg = '\x1b[48;5;215m',
  TangerineOrangeBg = '\x1b[48;5;208m',
  AmberOrangeBg = '\x1b[48;5;214m',

  // Gray shades
  SilverGray = '\x1b[37m',         // Light gray
  SlateGray = '\x1b[90m',          // Medium gray
  CharcoalGray = '\x1b[38;5;238m', // Dark gray (unique)
  SilverGrayBg = '\x1b[47m',
  SlateGrayBg = '\x1b[100m',
  CharcoalGrayBg = '\x1b[48;5;238m',

  // Black and White for completeness
  PureBlack = '\x1b[30m',
  PureWhite = '\x1b[97m',
  PureBlackBg = '\x1b[40m',
  PureWhiteBg = '\x1b[107m',

  // Cyan shade
  Cyan = '\x1b[36m',

  // Formatting codes
  Reset = '\x1b[0m',
  Bold = '\x1b[1m',
  Dim = '\x1b[2m',
  Underline = '\x1b[4m',
  Blink = '\x1b[5m',
  Reverse = '\x1b[7m',
  Hidden = '\x1b[8m',
}

/**
 * Semantic style names for logger styling
 */
export type SemanticStyleName =
  | 'highlight'
  | 'accent'
  | 'attention'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'debug';


/**
 * Icon type for logger styling (all available emojis as string literals)
 */
export type Icon =
  | '✅' | '⚠️' | '❌' | 'ℹ️' | '🐞' | '⭐️' | '🚀' | '🔥' | '✔️' | '✖️' | '❓' | '🔒' | '🔓' | '⏳' | '🕒' | '⬆️' | '⬇️' | '➡️' | '⬅️' | '📁' | '📄' | '👤' | '👥' | '✏️' | '➕' | '➖' | '🔔' | '⚡️' | '🎁' | '🐛' | '🌟' | '❤️' | '👀' | '⚙️' | '🔧' | '🔨' | '🔑' | '🎉' | '📝' | '🚨' | '📅' | '💡' | '🔍' | '🔗' | '🔖' | '📌' | '📎' | '✉️' | '📞' | '🌍' | '☁️' | '🌈' | '🌙' | '☀️' | '❄️' | '✨' | '🎵' | '📷' | '🎥' | '🎤' | '🔊' | '🔋' | '🗑️' | '💰' | '💳' | '🎂' | '🏅' | '🏆' | '👑' | '🛸' | '🛡️' | '🛑' | '▶️' | '⏸️' | '⏺️' | '⏪' | '⏩' | '🔁' | '🔀' | '🎲' | '🎈' | '🍪' | '☕️' | '🍵' | '🍺' | '🍷' | '🍕' | '🍔' | '🍟' | '🍎' | '🍌' | '🍒' | '🍋' | '🥕' | '🌽' | '🥦' | '🥚' | '🧀' | '🍞' | '🍰' | '🍦' | '🍫' | '🍿' | '🥓' | '🍤' | '🐟' | '🦀' | '🐙' | '🐋' | '🐬' | '🐧' | '🐸' | '🐢' | '🐍' | '🐉' | '🦄' | '🐱' | '🐶' | '🐭' | '🐰' | '🐻' | '🐼' | '🐨' | '🐯' | '🦁' | '🐒' | '🐘' | '🐎' | '🐄' | '🐖' | '🐑' | '🐔' | '🦆' | '🦢' | '🦉' | '🦅' | '🦜' | '🦚' | '🦩' | '🦋' | '🐝' | '🐜' | '🐞' | '🕷️' | '🦂' | '🐌' | '🪱' | '🐛' | '🦗' | '🦟' | '🪰' | '🪳' | '🪲';

/**
 * LogStyling for visual styling and icons in log output
 */
export interface LogStyling {
  style?: SemanticStyleName | { color: ColorEnum; bold?: boolean; underline?: boolean };
  icon?: Icon | string;
}
/**
 * Valid log level strings
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';

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
 * Contextual data for structured logging
 * 
 * A plain object containing key-value pairs that provide
 * additional context for log entries. Used to attach
 * structured data to log messages for better debugging
 * and monitoring.
 * 
 * @example
 * ```typescript
 * const context: LogContext = {
 *   userId: '12345',
 *   operation: 'login',
 *   duration: 150,
 *   success: true
 * };
 * 
 * logger.error('Login failed', context);
 * ```
 */
export interface LogContext {
  [key: string]: unknown;
  correlationId?: string;
  userId?: string;
  requestId?: string;
  context?: Record<string, unknown>;
}

/**
 * LogMessage supports either a plain string (fast path) or a function that
 * returns a string. The function is only evaluated when the logger actually
 * decides to emit the message (based on level, context, deduplication, etc.)
 */
export type LogMessage = string | (() => string);

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

  /**
   * Global style configuration for semantic styles
   */
  styles?: Partial<Record<SemanticStyleName, { color: ColorEnum; bold?: boolean; underline?: boolean }>>;

  /**
   * Global icon configuration for semantic icons
   */
  icons?: Partial<Record<'success' | 'warning' | 'error' | 'info' | 'debug', Icon>>;

  /**
   * Log deduplication configuration
   */
  deduplication?: {
    /** Whether deduplication is enabled (default: false) */
    enabled: boolean;
    /** Time window in milliseconds for batching messages (default: 5000) */
    windowMs?: number;
    /** Whether to flush immediately on critical levels (default: true) */
    flushOnCritical?: boolean;
  };

  /**
   * The output formatter to use
   */
  formatter?: ILogFormatter;

  /**
   * The correlation ID for tracking requests
   */
  correlationId?: string;

  /**
   * Log sanitization configuration
   * Enabled by default with secure patterns for sensitive data
   */
  sanitization?: SanitizationConfig;
}
