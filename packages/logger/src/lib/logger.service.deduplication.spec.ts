/**
 * Integration tests for LoggerService deduplication functionality
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LoggerService } from './logger.service';
import { LoggerConfig } from './logger.types';

describe('LoggerService Deduplication Integration', () => {
  let originalConsole: Console;
  let consoleOutput: { method: string; args: unknown[] }[];

  beforeEach(() => {
    // Mock console methods to capture output
    originalConsole = global.console;
    consoleOutput = [];

    global.console = {
      ...originalConsole,
      info: (...args: unknown[]) => {
        consoleOutput.push({ method: 'info', args });
      },
      debug: (...args: unknown[]) => {
        consoleOutput.push({ method: 'debug', args });
      },
      trace: (...args: unknown[]) => {
        consoleOutput.push({ method: 'trace', args });
      },
      warn: (...args: unknown[]) => {
        consoleOutput.push({ method: 'warn', args });
      },
      error: (...args: unknown[]) => {
        consoleOutput.push({ method: 'error', args });
      },
    } as Console;
  });

  afterEach(() => {
    global.console = originalConsole;
    vi.clearAllTimers();
  });

  describe('deduplication disabled (default)', () => {
    it('should log all messages immediately when deduplication is disabled', () => {
      const config: LoggerConfig = {
        level: 'debug',
        useColors: false,
      };
      
      const logger = new LoggerService(config);
      
      logger.info('Test message');
      logger.info('Test message');
      logger.info('Test message');
      
      expect(consoleOutput).toHaveLength(3);
      expect(consoleOutput.every(output => output.method === 'info')).toBe(true);
    });
  });

  describe('deduplication enabled', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('should batch identical simple messages', () => {
      const config: LoggerConfig = {
        level: 'debug',
        useColors: false,
        deduplication: {
          enabled: true,
          windowMs: 1000,
        },
      };
      
      const logger = new LoggerService(config);
      
      // Send identical messages
      logger.info('Test message');
      logger.info('Test message');
      logger.info('Test message');
      
      // Should not log anything yet (batched)
      expect(consoleOutput).toHaveLength(0);
      
      // Fast-forward time to trigger flush
      vi.advanceTimersByTime(1000);
      
      // Should have one message with count
      expect(consoleOutput).toHaveLength(1);
      expect(consoleOutput[0].method).toBe('info');
      expect(consoleOutput[0].args[0]).toContain('Test message');
      expect(consoleOutput[0].args[0]).toContain('(×3)');
    });

    it('should flush immediately for critical levels (error/fatal)', () => {
      const config: LoggerConfig = {
        level: 'debug',
        useColors: false,
        deduplication: {
          enabled: true,
          windowMs: 1000,
          flushOnCritical: true,
        },
      };
      
      const logger = new LoggerService(config);
      
      // Send some info messages (will be batched)
      logger.info('Regular message');
      logger.info('Regular message');
      
      // Send an error (should flush immediately and log error)
      logger.error('Critical error');
      
      // Should have logged the batched messages plus the error
      expect(consoleOutput.length).toBeGreaterThan(0);
      expect(consoleOutput.some(output => output.method === 'error')).toBe(true);
    });

    it('should not batch messages with metadata or additional data', () => {
      const config: LoggerConfig = {
        level: 'debug',
        useColors: false,
        deduplication: {
          enabled: true,
          windowMs: 1000,
        },
      };
      
      const logger = new LoggerService(config);
      
      // Send message with metadata (should not be batched)
      logger.info('Test message', { style: 'info' });
      logger.info('Test message', { some: 'data' });
      
      // Should log immediately (not batched)
      expect(consoleOutput).toHaveLength(2);
      expect(consoleOutput.every(output => output.method === 'info')).toBe(true);
    });

    it('should handle different log levels separately', () => {
      const config: LoggerConfig = {
        level: 'debug',
        useColors: false,
        deduplication: {
          enabled: true,
          windowMs: 1000,
        },
      };
      
      const logger = new LoggerService(config);
      
      // Send same message at different levels
      logger.debug('Same message');
      logger.info('Same message');
      logger.warn('Same message');
      
      // No output yet (all batched)
      expect(consoleOutput).toHaveLength(0);
      
      // Fast-forward time
      vi.advanceTimersByTime(1000);
      
      // Should have three separate outputs (different levels)
      expect(consoleOutput).toHaveLength(3);
      expect(consoleOutput.map(o => o.method).sort()).toEqual(['debug', 'info', 'warn']);
    });

    it('should work with child loggers', () => {
      const config: LoggerConfig = {
        level: 'debug',
        useColors: false,
        deduplication: {
          enabled: true,
          windowMs: 1000,
        },
      };
      
      const rootLogger = new LoggerService(config);
      const childLogger = rootLogger.forContext('test-context');
      
      // Send messages from both loggers
      rootLogger.info('Test message');
      childLogger.info('Test message');
      
      // Should batch both (same message, different contexts are considered different)
      expect(consoleOutput).toHaveLength(0);
      
      // Fast-forward time
      vi.advanceTimersByTime(1000);
      
      // Should have two outputs (different contexts)
      expect(consoleOutput).toHaveLength(2);
      expect(consoleOutput.every(output => output.method === 'info')).toBe(true);
    });

    it('should handle window expiration and restart batching', () => {
      const config: LoggerConfig = {
        level: 'debug',
        useColors: false,
        deduplication: {
          enabled: true,
          windowMs: 500,
        },
      };
      
      const logger = new LoggerService(config);
      
      // First batch
      logger.info('Test message');
      logger.info('Test message');
      
      // Fast-forward to flush first batch
      vi.advanceTimersByTime(500);
      expect(consoleOutput).toHaveLength(1);
      expect(consoleOutput[0].args[0]).toContain('(×2)');
      
      // Second batch (should restart)
      logger.info('Test message');
      logger.info('Test message');
      logger.info('Test message');
      
      // Fast-forward to flush second batch
      vi.advanceTimersByTime(500);
      expect(consoleOutput).toHaveLength(2);
      expect(consoleOutput[1].args[0]).toContain('(×3)');
    });
  });

  describe('error handling', () => {
    it('should handle deduplicator errors gracefully', () => {
      const config: LoggerConfig = {
        level: 'debug',
        useColors: false,
        deduplication: {
          enabled: true,
          windowMs: 1000,
        },
      };
      
      const logger = new LoggerService(config);
      
      // Force an error by accessing private deduplicator
      const rootLogger = logger;
      const deduplicator = (rootLogger as unknown as { deduplicator?: unknown }).deduplicator;
      
      // Mock the addMessage method to throw an error
      if (deduplicator && typeof deduplicator === 'object' && 'addMessage' in deduplicator) {
        const originalAddMessage = deduplicator.addMessage;
        deduplicator.addMessage = vi.fn().mockImplementation(() => {
          throw new Error('Deduplicator error');
        });
        
        // Should not throw, but log the message anyway
        expect(() => logger.info('Test message')).not.toThrow();
        
        // Restore original method
        deduplicator.addMessage = originalAddMessage;
      }
    });
  });
});
