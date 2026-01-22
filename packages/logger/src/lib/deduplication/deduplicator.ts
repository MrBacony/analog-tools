/**
 * Simple log deduplicator implementation
 * Following YAGNI principle - minimal, focused functionality
 */

import { LogLevelEnum } from '../logger.types';
import { ILogFormatter, LogEntry as FormatterLogEntry } from '../formatters/formatter.interface';
import {
  DeduplicationConfig,
  LogEntry,
  CRITICAL_LEVELS,
  ILogDeduplicator,
} from './deduplication.types';

/**
 * Simple log deduplicator that batches identical messages
 */
export class LogDeduplicator implements ILogDeduplicator {
  private entries = new Map<string, LogEntry>();
  private flushTimer?: NodeJS.Timeout;

  constructor(
    private config: DeduplicationConfig,
    private formatter: ILogFormatter,
    private loggerName: string
  ) {}

  /**
   * Add a message to the deduplicator
   */
  addMessage(level: LogLevelEnum, message: string, context = ''): boolean {
    // If deduplication is disabled, log immediately
    if (!this.config.enabled) {
      return true;
    }

    // Critical levels bypass deduplication
    if (this.config.flushOnCritical && CRITICAL_LEVELS.includes(level)) {
      return true;
    }

    // Generate fingerprint for the message
    const fingerprint = this.generateFingerprint(message, level, context);
    const existing = this.entries.get(fingerprint);

    if (existing) {
      // Update existing entry
      existing.count++;
    } else {
      // Create new entry
      this.entries.set(fingerprint, {
        message,
        level,
        context,
        firstSeen: Date.now(),
        count: 1,
      });
    }

    // Schedule flush if not already scheduled
    this.scheduleFlush();

    // Return false to indicate message was batched
    return false;
  }

  /**
   * Flush all pending messages immediately
   */
  flush(): void {
    if (this.entries.size === 0) {
      return;
    }

    // Clear any pending timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Output all batched messages
    for (const entry of this.entries.values()) {
      this.outputMessage(entry);
    }

    // Clear entries after flushing
    this.entries.clear();
  }

  /**
   * Destroy the deduplicator and clean up resources
   */
  destroy(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
    this.entries.clear();
  }

  /**
   * Generate a fingerprint for message deduplication
   */
  private generateFingerprint(
    message: string,
    level: LogLevelEnum,
    context: string
  ): string {
    // Simple concatenation - sufficient for exact matching
    return `${level}:${context}:${message}`;
  }

  /**
   * Schedule a flush after the configured window
   */
  private scheduleFlush(): void {
    if (this.flushTimer) {
      return; // Already scheduled
    }

    this.flushTimer = setTimeout(() => {
      this.flush();
    }, this.config.windowMs);
  }

  /**
   * Output a batched message with count if needed
   */
  private outputMessage(entry: LogEntry): void {
    let message = entry.message;
    
    // Add count suffix if message occurred multiple times
    if (entry.count > 1) {
      message = `${message} (×${entry.count})`;
    }

    // Format and output the message
    const formattedMessage = this.formatter.format({
      level: entry.level,
      message,
      logger: this.loggerName,
      timestamp: new Date(entry.firstSeen),
      context: entry.context || undefined,
    });

    // Use appropriate console method based on level
    switch (entry.level) {
      case LogLevelEnum.trace:
        console.trace(formattedMessage);
        break;
      case LogLevelEnum.debug:
        console.debug(formattedMessage);
        break;
      case LogLevelEnum.info:
        console.info(formattedMessage);
        break;
      case LogLevelEnum.warn:
        console.warn(formattedMessage);
        break;
      case LogLevelEnum.error:
        console.error(formattedMessage);
        break;
      case LogLevelEnum.fatal:
        console.error(formattedMessage);
        break;
    }
  }
}
