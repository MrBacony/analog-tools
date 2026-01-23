/**
 * Simple types for log deduplication functionality
 * Following YAGNI principle - minimal, focused implementation
 */

import { LogLevelEnum } from '../logger.types';

/**
 * Configuration for log deduplication
 */
export interface DeduplicationConfig {
  /** Whether deduplication is enabled */
  enabled: boolean;
  /** Time window in milliseconds for batching messages */
  windowMs: number;
  /** Whether to flush immediately on critical levels (error/fatal) */
  flushOnCritical: boolean;
}

/**
 * Default deduplication configuration
 */
export const DEFAULT_DEDUPLICATION_CONFIG: DeduplicationConfig = {
  enabled: false,
  windowMs: 5000, // 5 seconds
  flushOnCritical: true,
};

/**
 * Tracked log entry for deduplication
 */
export interface DeduplicatedLogEntry {
  /** Original message */
  message: string;
  /** Log level */
  level: LogLevelEnum;
  /** Logger context (if any) */
  context: string;
  /** When first seen */
  firstSeen: number;
  /** How many times seen */
  count: number;
}

/**
 * Critical levels that bypass deduplication
 */
export const CRITICAL_LEVELS = [LogLevelEnum.error, LogLevelEnum.fatal];

/**
 * Interface for the log deduplicator
 */
export interface ILogDeduplicator {
  /**
   * Add a message to the deduplicator
   * @param level Log level
   * @param message Message text
   * @param context Logger context
   * @returns True if message should be logged immediately, false if batched
   */
  addMessage(level: LogLevelEnum, message: string, context?: string): boolean;

  /**
   * Flush all pending messages immediately
   */
  flush(): void;

  /**
   * Destroy the deduplicator and clean up resources
   */
  destroy(): void;
}
