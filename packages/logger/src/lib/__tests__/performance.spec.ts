import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoggerService } from '../logger.service';
import { ErrorSerializer } from '../error-serialization/error-serializer';

describe('Performance Tests', () => {
  let logger: LoggerService;

  beforeEach(() => {
    // Mock console to prevent actual output during performance tests
    vi.spyOn(console, 'error').mockImplementation(() => {
      // Intentionally empty to suppress output
    });
    vi.spyOn(console, 'info').mockImplementation(() => {
      // Intentionally empty to suppress output
    });
    
    logger = new LoggerService({ level: 'trace', name: 'perf-test' });
  });

  describe('Error serialization performance', () => {
    it('should serialize errors efficiently', () => {
      const error = new Error('Performance test error');
      error.stack = 'Error: Performance test error\n    at test:1:1\n    at test:2:2';
      
      const startTime = performance.now();
      
      // Serialize the same error multiple times (should hit cache)
      for (let i = 0; i < 1000; i++) {
        ErrorSerializer.serialize(error);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete 1000 serializations in reasonable time
      expect(duration).toBeLessThan(100); // Less than 100ms
    });

    it('should handle circular references without performance degradation', () => {
      const obj: Record<string, unknown> = { name: 'test' };
      obj['self'] = obj; // Create circular reference
      
      const startTime = performance.now();
      
      for (let i = 0; i < 100; i++) {
        ErrorSerializer.serialize(obj);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should handle circular references efficiently
      expect(duration).toBeLessThan(50); // Less than 50ms
    });

    it('should handle deep objects efficiently', () => {
      // Create a deep nested object
      let deepObj: Record<string, unknown> = { value: 'deep' };
      for (let i = 0; i < 8; i++) {
        deepObj = { level: i, next: deepObj };
      }
      
      const startTime = performance.now();
      
      for (let i = 0; i < 100; i++) {
        ErrorSerializer.serialize(deepObj);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should handle deep objects efficiently
      expect(duration).toBeLessThan(100); // Less than 100ms
    });
  });

  describe('Logger method overload performance', () => {
    it('should not significantly impact logging performance', () => {
      const error = new Error('Test error');
      const metadata = { userId: '123', operation: 'test' };
      
      const startTime = performance.now();
      
      // Test all overload types
      for (let i = 0; i < 1000; i++) {
        logger.error('Simple message');
        logger.error(error);
        logger.error('Message with error', error);
        logger.error('Message with metadata', metadata);
        logger.error('Message with error and metadata', error, metadata);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete all logging operations efficiently
      expect(duration).toBeLessThan(300); // Less than 300ms for 5000 log calls
    });
  });

  describe('Memory usage', () => {
    it('should not leak memory during repeated error serialization', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create many different errors and serialize them
      for (let i = 0; i < 1000; i++) {
        const error = new Error(`Error ${i}`);
        error.stack = `Error: Error ${i}\n    at test:${i}:1`;
        ErrorSerializer.serialize(error);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});
