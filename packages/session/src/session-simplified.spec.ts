/**
 * Basic tests for session package
 * Tests the simplified API functionality
 */

import { describe, it, expect } from 'vitest';
import { signCookie, unsignCookie } from './crypto';
import { createUnstorageStore } from './storage';

describe('Session Package - Simplified API', () => {
  describe('Crypto Functions', () => {
    it('should sign and unsign cookies correctly', async () => {
      const value = 'test-session-id';
      const secret = 'test-secret';
      
      const signed = await signCookie(value, secret);
      expect(signed).toMatch(/^s:test-session-id\./);
      
      const unsigned = await unsignCookie(signed, [secret]);
      expect(unsigned).toBe(value);
    });

    it('should return null for invalid signatures', async () => {
      const result = await unsignCookie('invalid-signature', ['secret']);
      expect(result).toBeNull();
    });
  });

  describe('Storage Factories', () => {
    it('should create memory store', async () => {
      const store = await createUnstorageStore({ type: 'memory' });
      expect(store).toBeDefined();
      expect(typeof store.getItem).toBe('function');
      expect(typeof store.setItem).toBe('function');
      expect(typeof store.removeItem).toBe('function');
    });

    it('should handle basic storage operations', async () => {
      const store = await createUnstorageStore({ type: 'memory' });
      const testData = { userId: '123', name: 'Test' };
      
      await store.setItem('test', testData);
      const retrieved = await store.getItem('test');
      expect(retrieved).toEqual(testData);
      
      await store.removeItem('test');
      const removed = await store.getItem('test');
      expect(removed).toBeNull();
    });
  });

  describe('Package Exports', () => {
    it('should export simplified API', async () => {
      const { 
        useSession, 
        getSession, 
        updateSession, 
        destroySession, 
        regenerateSession,
        createUnstorageStore,
        signCookie: sign,
        unsignCookie: unsign 
      } = await import('./index');
      
      expect(typeof useSession).toBe('function');
      expect(typeof getSession).toBe('function');
      expect(typeof updateSession).toBe('function');
      expect(typeof destroySession).toBe('function');
      expect(typeof regenerateSession).toBe('function');
      expect(typeof createUnstorageStore).toBe('function');
      expect(typeof sign).toBe('function');
      expect(typeof unsign).toBe('function');
    });
  });
});
