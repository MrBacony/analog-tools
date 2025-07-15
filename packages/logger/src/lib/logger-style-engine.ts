/**
 * LoggerStyleEngine - Dedicated service for styling and formatting log messages
 * Extracted from LoggerService to follow Single Responsibility Principle
 */

import { LogLevelEnum, ColorEnum, Icon, LogStyling, SemanticStyleName } from './logger.types';
import { DEFAULT_ICON_SCHEME, DEFAULT_STYLE_SCHEME, StyleScheme, IconScheme } from './logger.config';
import {
  ILoggerStyleEngine,
  LoggerStyleEngineConfig,
  MetadataParseResult,
  StyleApplication,
} from './logger-style-engine.types';

/**
 * Color mapping for different log levels using ColorEnum values
 */
const LogLevelColors: Record<keyof typeof LogLevelEnum, ColorEnum> = {
  trace: ColorEnum.SlateGray,        // Gray for trace (lowest level)
  debug: ColorEnum.Cyan,             // Cyan for debug info
  info: ColorEnum.ForestGreen,       // Green for general info
  warn: ColorEnum.SunflowerYellow,   // Standard yellow for warnings
  error: ColorEnum.FireRed,          // Red for errors
  fatal: ColorEnum.FireRed,          // Bold + standard red for fatal errors
  silent: ColorEnum.Reset,           // Reset for silent
};

/**
 * LoggerStyleEngine - Handles all styling, formatting, and color management for logger output
 * 
 * This service is responsible for:
 * - ANSI color code management
 * - Message formatting with colors and prefixes
 * - Metadata-based styling application
 * - Icon resolution and validation
 * - Semantic style management
 * - Color application for log levels
 */
export class LoggerStyleEngine implements ILoggerStyleEngine {
  /**
   * Public method to resolve a style definition and return the ANSI color code (with caching)
   * @param style Style definition (semantic name or custom config)
   * @returns ANSI color code or undefined if invalid
   */
  public resolveStyle(style: StyleApplication, loggerName = 'test', context?: string): string | undefined {
    return this.applyStyle(style, loggerName, context);
  }
  /**
   * Cache for resolved style definitions (memoization)
   * Key: string for semantic style, object reference for custom style
   */
  private styleCache: Map<string | object, string | undefined> = new Map();
  /**
   * Mark this service as injectable for @analog-tools/inject
   */
  static INJECTABLE = true;

  private useColors: boolean;
  private globalStyles: Partial<StyleScheme>;
  private globalIcons: Partial<IconScheme>;

  /**
   * Create a new LoggerStyleEngine
   * @param config Configuration for the style engine
   */
  constructor(config: LoggerStyleEngineConfig = {}) {
    // Detect test environment and disable colors in tests unless explicitly enabled
    const isTestEnvironment =
      process.env['NODE_ENV'] === 'test' || process.env['VITEST'] === 'true';
    
    this.useColors = config.useColors !== undefined ? config.useColors : !isTestEnvironment;
    
    // Initialize global styles and icons
    this.globalStyles = { ...DEFAULT_STYLE_SCHEME, ...config.styles };
    this.globalIcons = { ...DEFAULT_ICON_SCHEME, ...config.icons };
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
   * Update style and icon configuration
   * @param styles Partial style configuration to merge
   * @param icons Partial icon configuration to merge
   */
  updateStyleConfig(
    styles: Partial<StyleScheme>,
    icons: Partial<IconScheme>
  ): void {
    this.globalStyles = { ...this.globalStyles, ...styles };
    this.globalIcons = { ...this.globalIcons, ...icons };
  }

  /**
   * Format a log message with color and proper prefix
   * @param level Log level for the message
   * @param message The message to format
   * @param loggerName The name of the logger
   * @param context Optional context for the logger
   * @param overrideColor Optional color override for the message
   * @returns Formatted message with color
   */
  formatMessage(
    level: LogLevelEnum,
    message: string,
    loggerName: string,
    context?: string,
    overrideColor?: string
  ): string {
    const prefix = context
      ? `[${loggerName}:${context}]`
      : `[${loggerName}]`;

    if (this.useColors) {
      let color = this.getColorForLevel(level);
      if (overrideColor) {
        color = overrideColor;
      }
      return `${color}${prefix} ${message}${ColorEnum.Reset}`;
    } else {
      return `${prefix} ${message}`;
    }
  }

  /**
   * Format message with metadata-based styling and icons
   * @param level Log level
   * @param message Message to format
   * @param loggerName The name of the logger
   * @param styling Optional metadata for styling
   * @param context Optional context for the logger
   * @returns Formatted message with styling and icons
   */
  formatMessageWithMetadata(
    level: LogLevelEnum,
    message: string,
    loggerName: string,
    styling?: LogStyling,
    context?: string
  ): string {
    let formattedMessage = message;
    let color = this.getColorForLevel(level);

    // Apply styling if provided
    if (styling?.style) {
      const appliedColor = this.applyStyle(styling.style, loggerName, context);
      if (appliedColor) {
        color = appliedColor;
      }
    }

    // Add icon if provided
    if (styling?.icon) {
      const icon = this.resolveIcon(styling.icon, loggerName, context);
      formattedMessage = `${icon} ${message}`;
    }

    // Use existing formatMessage with override color
    return this.formatMessage(level, formattedMessage, loggerName, context, color);
  }

  /**
   * Parse metadata parameter to separate metadata from additional data
   * @param metadataOrData Could be LogStyling or additional data
   * @param data Additional data parameters
   * @returns Parsed metadata and remaining data
   */
  parseMetadataParameter(
    metadataOrData?: LogStyling | unknown,
    data: unknown[] = []
  ): MetadataParseResult {
    // Check if the first parameter is LogStyling
    if (
      metadataOrData &&
      typeof metadataOrData === 'object' &&
      !Array.isArray(metadataOrData) &&
      ('style' in metadataOrData || 'icon' in metadataOrData)
    ) {
      return {
        metadata: metadataOrData as LogStyling,
        restData: data,
      };
    }

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
   * Get color for a specific log level
   * @param level The log level
   * @returns ANSI color code for the log level
   * @private
   */
  private getColorForLevel(level: LogLevelEnum): string {
    // Convert enum to string key
    const levelKey = LogLevelEnum[level] as keyof typeof LogLevelColors;
    const baseColor = LogLevelColors[levelKey];
    // For fatal errors, add bold formatting to make them stand out
    if (level === LogLevelEnum.fatal) {
      return `${ColorEnum.Bold}${baseColor}`;
    }
    // If baseColor is undefined (invalid log level), return reset
    if (!baseColor) {
      return ColorEnum.Reset;
    }
    return baseColor;
  }

  /**
   * Apply style configuration and return ANSI color code
   * @param style Style configuration (semantic name or custom config)
   * @param loggerName Logger name for error messages
   * @param context Optional context for error messages
   * @returns ANSI color code or undefined if invalid
   * @private
   */
  private applyStyle(
    style: StyleApplication,
    loggerName: string,
    context?: string
  ): string | undefined {
    // Memoization: cache by string or object reference
    const cached = this.getStyleCacheValue(style);
    if (cached !== undefined) return cached;
    
    if (typeof style === 'string') {
      const resolved = this.getSemanticStyleColor(style, loggerName, context);
      this.setStyleCache(style, resolved);
      return resolved;
    }
    if (typeof style === 'object' && 'color' in style) {
      if (!this.isValidColor(style.color)) {
        this.setStyleCache(style, undefined);
        this.logWarning(`Invalid color provided. Only predefined ColorEnum values are allowed.`, loggerName, context);
        return undefined;
      }
      const styleCode = this.constructStyleCode(style);
      this.setStyleCache(style, styleCode);
      return styleCode;
    }
    this.setStyleCache(style, undefined);
    this.logWarning(`Unknown style configuration provided. Only semantic style names or valid ColorEnum objects are allowed.`, loggerName, context);
    return undefined;
  }
  // Helper: Validate color
  private isValidColor(color: unknown): boolean {
    return Object.values(ColorEnum).includes(color as ColorEnum);
  }

  // Helper: Validate icon
  private isValidIcon(icon: unknown): boolean {
    return this.isEmojiIcon(icon as string);
  }

  // Helper: Memoization get/set
  private getStyleCacheValue(key: string | object): string | undefined {
    return this.styleCache.has(key) ? this.styleCache.get(key) : undefined;
  }
  private setStyleCache(key: string | object, value: string | undefined): void {
    this.styleCache.set(key, value);
  }

  // Helper: Error logging
  private logWarning(message: string, loggerName: string, context?: string): void {
    const loggerPrefix = context ? `${loggerName}:${context}` : loggerName;
    console.warn(`[${loggerPrefix}] ${message}`);
  }

  // Helper: Style code construction
  private constructStyleCode(style: { color: ColorEnum; bold?: boolean; underline?: boolean }): string {
    let code = style.color.toString();
    if (style.bold) code += ColorEnum.Bold;
    if (style.underline) code += ColorEnum.Underline;
    return code;
  }

  /**
   * Get ANSI color code for semantic style names
   * @param styleName Semantic style name
   * @param loggerName Logger name for error messages
   * @param context Optional context for error messages
   * @returns ANSI color code or undefined if unknown
   * @private
   */
  private getSemanticStyleColor(
    styleName: SemanticStyleName,
    loggerName: string,
    context?: string
  ): string | undefined {
    // Get style from global configuration
    // Memoization: cache by styleName string
    if (this.styleCache.has(styleName)) {
      return this.styleCache.get(styleName);
    }
    const styleConfig = this.globalStyles[styleName];

    if (styleConfig) {
      let styleCode = styleConfig.color.toString();
      if (styleConfig.bold) {
        styleCode += ColorEnum.Bold;
      }
      if (styleConfig.underline) {
        styleCode += ColorEnum.Underline;
      }
      this.styleCache.set(styleName, styleCode);
      return styleCode;
    }

    // Log warning for unknown semantic style and fallback
    const loggerPrefix = context ? `${loggerName}:${context}` : loggerName;
    console.warn(
      `[${loggerPrefix}] Unknown semantic style: ${styleName}. Falling back to default.`
    );
    this.styleCache.set(styleName, undefined);
    return undefined;
  }

  /**
   * Expose style cache for diagnostics/testing
   */
  getStyleCache(): Map<string | object, string | undefined> {
    return this.styleCache;
  }

  /**
   * Resolve icon to emoji character
   * @param icon Icon name or custom string
   * @param loggerName Logger name for error messages
   * @param context Optional context for error messages
   * @returns Emoji character
   * @private
   */
  private resolveIcon(
    icon: Icon | string,
    loggerName: string,
    context?: string
  ): string {
    if (this.isValidIcon(icon)) {
      return icon;
    }
    const semanticIconKeys = [
      'success', 'warning', 'error', 'info', 'debug',
    ] as const;
    const semanticIcon = semanticIconKeys.find((key) => key === icon);
    if (semanticIcon && this.globalIcons[semanticIcon]) {
      return this.globalIcons[semanticIcon] as string;
    }
    if (semanticIconKeys.includes(icon as typeof semanticIconKeys[number])) {
      this.logWarning(`Unknown icon: ${icon}. Expected a valid emoji or semantic icon name.`, loggerName, context);
    } else {
      this.logWarning(`Invalid icon: ${icon}. Expected a valid emoji or semantic icon name.`, loggerName, context);
    }
    return icon;
  }

  /**
   * Check if the provided icon is a valid emoji from our Icon type
   * @param icon Icon to check
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
