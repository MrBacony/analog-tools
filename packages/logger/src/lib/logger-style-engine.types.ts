/**
 * Types and interfaces for the LoggerStyleEngine
 */

import { ColorEnum, LogStyling, SemanticStyleName } from './logger.types';
import { LogLevelEnum } from './logger.service';
import { StyleScheme, IconScheme } from './logger.config';

/**
 * Configuration interface for LoggerStyleEngine
 */
export interface LoggerStyleEngineConfig {
  useColors?: boolean;
  styles?: Partial<StyleScheme>;
  icons?: Partial<IconScheme>;
  loggerName?: string;
}

/**
 * Interface for the LoggerStyleEngine service
 */
export interface ILoggerStyleEngine {
  /**
   * Format a basic log message with colors and prefix
   */
  formatMessage(
    level: LogLevelEnum,
    message: string,
    loggerName: string,
    context?: string,
    overrideColor?: string
  ): string;

  /**
   * Format a message with metadata-based styling and icons
   */
  formatMessageWithMetadata(
    level: LogLevelEnum,
    message: string,
    loggerName: string,
    styling?: LogStyling,
    context?: string
  ): string;

  /**
   * Parse metadata parameter to separate styling from additional data
   */
  parseMetadataParameter(
    metadataOrData?: LogStyling | unknown,
    data?: unknown[]
  ): { metadata?: LogStyling; restData: unknown[] };

  /**
   * Enable or disable colored output
   */
  setUseColors(enabled: boolean): void;

  /**
   * Check if colors are enabled
   */
  getUseColors(): boolean;

  /**
   * Update style and icon configuration
   */
  updateStyleConfig(
    styles: Partial<StyleScheme>,
    icons: Partial<IconScheme>
  ): void;
}

/**
 * Internal metadata parsing result
 */
export interface MetadataParseResult {
  metadata?: LogStyling;
  restData: unknown[];
}

/**
 * Style application configuration
 */
export type StyleApplication =
  | SemanticStyleName
  | { color: ColorEnum; bold?: boolean; underline?: boolean };
