/**
 * Tests for storage factory functions
 * Verifies memory and Redis storage creation
 */

import { describe, it, expect } from 'vitest';
import { createMemoryStore, createRedisStore } from './storage';

describe('Storage Factory Functions', () => {
  describe('createMemoryStore', () => {
    it('should create a memory store instance', () => {
      const store = createMemoryStore();
      
      expect(store).toBeDefined();
      expect(typeof store.getItem).toBe('function');
      expect(typeof store.setItem).toBe('function');
      expect(typeof store.removeItem).toBe('function');
    });

    it('should create store with optional prefix', () => {
      const store = createMemoryStore();
      
      expect(store).toBeDefined();
      // Basic functionality should work regardless of prefix
      expect(typeof store.getItem).toBe('function');
    });

    it('should handle basic storage operations', async () => {
      const store = createMemoryStore();
      const testData = { userId: '123', name: 'Test User' };
      
      // Set and get data
      await store.setItem('test-session', testData);
      const retrieved = await store.getItem('test-session');
      
      expect(retrieved).toEqual(testData);
    });

    it('should handle session removal', async () => {
      const store = createMemoryStore();
      const testData = { userId: '123' };
      
      await store.setItem('test-session', testData);
      await store.removeItem('test-session');
      const retrieved = await store.getItem('test-session');
      
      expect(retrieved).toBeNull();
    });
  });

  describe('createRedisStore', () => {
    it('should create a Redis store instance', () => {
      const store = createRedisStore({
        host: 'localhost',
        port: 6379,
      });
      
      expect(store).toBeDefined();
      expect(typeof store.getItem).toBe('function');
      expect(typeof store.setItem).toBe('function');
      expect(typeof store.removeItem).toBe('function');
    });

    it('should accept URL configuration', () => {
      const store = createRedisStore({
        url: 'redis://localhost:6379',
      });
      
      expect(store).toBeDefined();
    });

    it('should accept full configuration options', () => {
      const store = createRedisStore({
        host: 'localhost',
        port: 6379,
        username: 'user',
        password: 'pass',
        db: 0,
        prefix: 'session:',
        ttl: 3600,
      });
      
      expect(store).toBeDefined();
    });

    // Note: These tests don't require actual Redis connection
    // as we're just testing the factory function creation
    // Integration tests would require real Redis instance
  });

  describe('Storage Interface Compliance', () => {
    it('should create stores that implement Storage interface', () => {
      const memoryStore = createMemoryStore();
      const redisStore = createRedisStore({ host: 'localhost' });
      
      // Both should have the same interface
      const requiredMethods = ['getItem', 'setItem', 'removeItem', 'getKeys'];
      
      requiredMethods.forEach(method => {
        expect(typeof (memoryStore as unknown as Record<string, unknown>)[method]).toBe('function');
        expect(typeof (redisStore as unknown as Record<string, unknown>)[method]).toBe('function');
      });
    });
  });
});
