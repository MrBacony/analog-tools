import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LogDeduplicator } from './deduplicator';
import { LogLevelEnum } from '../logger.types';
import { DEFAULT_DEDUPLICATION_CONFIG } from './deduplication.types';
import { ILogFormatter, LogEntry } from '../formatters/formatter.interface';

// Mock console methods
const mockConsole = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
};

// Mock formatter that implements ILogFormatter
class MockFormatter implements ILogFormatter {
  format(entry: LogEntry): string {
    const prefix = entry.context ? `[test:${entry.context}]` : '[test]';
    return `${prefix} ${entry.message}`;
  }
}

const mockFormatter = new MockFormatter();

describe('LogDeduplicator', () => {
  let deduplicator: LogDeduplicator;

  beforeEach(() => {
    // Reset console mocks
    vi.clearAllMocks();
    
    // Replace console methods
    console.info = mockConsole.info;
    console.warn = mockConsole.warn;
    console.error = mockConsole.error;
    console.debug = mockConsole.debug;
    console.trace = mockConsole.trace;

    // Create deduplicator with test configuration
    deduplicator = new LogDeduplicator(
      DEFAULT_DEDUPLICATION_CONFIG,
      mockFormatter,
      'test'
    );
  });

  afterEach(() => {
    if (deduplicator) {
      deduplicator.destroy();
    }
  });

  describe('Disabled deduplication', () => {
    it('should return true for immediate logging when disabled', () => {
      const config = { ...DEFAULT_DEDUPLICATION_CONFIG, enabled: false };
      const dedupe = new LogDeduplicator(config, mockFormatter, 'test');
      
      const result = dedupe.addMessage(LogLevelEnum.info, 'test message');
      
      expect(result).toBe(true);
      dedupe.destroy();
    });
  });

  describe('Basic deduplication', () => {
    beforeEach(() => {
      // Enable deduplication for these tests
      const config = { ...DEFAULT_DEDUPLICATION_CONFIG, enabled: true };
      deduplicator.destroy();
      deduplicator = new LogDeduplicator(config, mockFormatter, 'test');
    });

    it('should batch identical messages', () => {
      const result1 = deduplicator.addMessage(LogLevelEnum.info, 'test message');
      const result2 = deduplicator.addMessage(LogLevelEnum.info, 'test message');
      
      expect(result1).toBe(false); // First message is batched
      expect(result2).toBe(false); // Second message is batched
    });

    it('should return true for critical levels', () => {
      const errorResult = deduplicator.addMessage(LogLevelEnum.error, 'error message');
      const fatalResult = deduplicator.addMessage(LogLevelEnum.fatal, 'fatal message');
      
      expect(errorResult).toBe(true);
      expect(fatalResult).toBe(true);
    });

    it('should treat different contexts as separate', () => {
      const result1 = deduplicator.addMessage(LogLevelEnum.info, 'test message', 'context1');
      const result2 = deduplicator.addMessage(LogLevelEnum.info, 'test message', 'context2');
      
      expect(result1).toBe(false);
      expect(result2).toBe(false);
      
      // Both should be tracked separately
      deduplicator.flush();
      
      expect(mockConsole.info).toHaveBeenCalledTimes(2);
    });
  });

  describe('Flush behavior', () => {
    beforeEach(() => {
      const config = { ...DEFAULT_DEDUPLICATION_CONFIG, enabled: true };
      deduplicator.destroy();
      deduplicator = new LogDeduplicator(config, mockFormatter, 'test');
    });

    it('should flush batched messages with count', () => {
      // Add same message multiple times
      deduplicator.addMessage(LogLevelEnum.info, 'repeated message');
      deduplicator.addMessage(LogLevelEnum.info, 'repeated message');
      deduplicator.addMessage(LogLevelEnum.info, 'repeated message');
      
      deduplicator.flush();
      
      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const call = mockConsole.info.mock.calls[0][0];
      expect(call).toContain('repeated message');
      expect(call).toContain('(×3)');
    });

    it('should not add count for single occurrence', () => {
      deduplicator.addMessage(LogLevelEnum.info, 'single message');
      
      deduplicator.flush();
      
      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const call = mockConsole.info.mock.calls[0][0];
      expect(call).toContain('single message');
      expect(call).not.toContain('×');
    });
  });

  describe('Timer-based flushing', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      const config = { ...DEFAULT_DEDUPLICATION_CONFIG, enabled: true, windowMs: 1000 };
      deduplicator.destroy();
      deduplicator = new LogDeduplicator(config, mockFormatter, 'test');
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should flush messages after time window', () => {
      deduplicator.addMessage(LogLevelEnum.info, 'timed message');
      
      expect(mockConsole.info).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(1000);
      
      expect(mockConsole.info).toHaveBeenCalledTimes(1);
    });
  });

  describe('Memory management', () => {
    beforeEach(() => {
      const config = { ...DEFAULT_DEDUPLICATION_CONFIG, enabled: true };
      deduplicator.destroy();
      deduplicator = new LogDeduplicator(config, mockFormatter, 'test');
    });

    it('should clear entries after flush', () => {
      deduplicator.addMessage(LogLevelEnum.info, 'test message');
      deduplicator.flush();
      
      // Add same message again - should be treated as new
      const result = deduplicator.addMessage(LogLevelEnum.info, 'test message');
      expect(result).toBe(false);
      
      deduplicator.flush();
      expect(mockConsole.info).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge cases', () => {
    beforeEach(() => {
      const config = { ...DEFAULT_DEDUPLICATION_CONFIG, enabled: true };
      deduplicator.destroy();
      deduplicator = new LogDeduplicator(config, mockFormatter, 'test');
    });

    it('should handle empty messages', () => {
      const result = deduplicator.addMessage(LogLevelEnum.info, '');
      expect(result).toBe(false);
      
      deduplicator.flush();
      expect(mockConsole.info).toHaveBeenCalledTimes(1);
    });

    it('should handle very long messages', () => {
      const longMessage = 'A'.repeat(10000);
      const result = deduplicator.addMessage(LogLevelEnum.info, longMessage);
      expect(result).toBe(false);
      
      deduplicator.flush();
      expect(mockConsole.info).toHaveBeenCalledTimes(1);
    });

    it('should handle undefined context', () => {
      const result = deduplicator.addMessage(LogLevelEnum.info, 'test', undefined);
      expect(result).toBe(false);
      
      deduplicator.flush();
      expect(mockConsole.info).toHaveBeenCalledTimes(1);
    });
  });
});
