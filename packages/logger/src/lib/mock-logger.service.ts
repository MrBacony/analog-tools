/**
 * Mock implementation of the LoggerService for testing
 */

import { ILogger } from './logger.types';

/**
 * Mock logger service for testing
 * This implementation just logs to console but can be easily spied upon in tests
 */
export class MockLoggerService implements ILogger {
  /** Mark as injectable for @analog-tools/inject */
  static INJECTABLE = true;

  private context = 'root';

  constructor() {
    console.log('Mock logger initialized');
  }

  forContext(context: string): ILogger {
    const childLogger = new MockLoggerService();
    childLogger.context = context;
    return childLogger;
  }

  trace(message: string, data?: Record<string, unknown>): void {
    console.log(`[TRACE] [${this.context}] ${message}`, data || '');
  }

  debug(message: string, data?: Record<string, unknown>): void {
    console.log(`[DEBUG] [${this.context}] ${message}`, data || '');
  }

  info(message: string, data?: Record<string, unknown>): void {
    console.log(`[INFO] [${this.context}] ${message}`, data || '');
  }

  warn(message: string, data?: Record<string, unknown>): void {
    console.warn(`[WARN] [${this.context}] ${message}`, data || '');
  }

  error(
    message: string,
    error?: Error | unknown,
    data?: Record<string, unknown>
  ): void {
    console.error(`[ERROR] [${this.context}] ${message}`, error, data || '');
  }

  fatal(
    message: string,
    error?: Error | unknown,
    data?: Record<string, unknown>
  ): void {
    console.error(`[FATAL] [${this.context}] ${message}`, error, data || '');
  }
}
