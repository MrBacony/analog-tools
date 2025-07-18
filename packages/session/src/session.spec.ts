/**
 * Tests for core session functions
 * Comprehensive testing of the simplified session API
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  useSession, 
  getSession, 
  updateSession, 
  destroySession, 
  regenerateSession 
} from './session';
import { createMemoryStore } from './storage';
import type { SessionData, SessionConfig } from './types';

// Mock H3 functions
vi.mock('h3', () => ({
  getCookie: vi.fn(),
  setCookie: vi.fn(),
}));

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'test-session-id-' + Math.random().toString(36).substr(2, 9)),
}));

import { getCookie, setCookie } from 'h3';
const mockGetCookie = vi.mocked(getCookie);
const mockSetCookie = vi.mocked(setCookie);

interface TestSessionData extends SessionData {
  userId?: string;
  username?: string;
  lastAccess?: number;
}

describe('Core Session Functions', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockEvent: any; // Using any for testing purposes
  let store: ReturnType<typeof createMemoryStore>;
  let config: SessionConfig<TestSessionData>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create mock H3Event
    mockEvent = {
      node: { 
        req: {}, 
        res: {} 
      },
      context: {},
    };

    // Create test storage
    store = createMemoryStore<TestSessionData>();
    
    // Create test configuration
    config = {
      store,
      secret: 'test-secret-key',
      name: 'test-session',
      maxAge: 3600,
      cookie: {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
      },
      generate: () => ({ userId: 'new-user', lastAccess: Date.now() }),
    };
  });

  describe('useSession', () => {
    it('should initialize new session when no cookie exists', async () => {
      mockGetCookie.mockReturnValue(undefined);

      await useSession(mockEvent, config);

      // Should have session data in context
      const sessionData = getSession<TestSessionData>(mockEvent);
      expect(sessionData).toEqual({
        userId: 'new-user',
        lastAccess: expect.any(Number),
      });

      // Should set cookie
      expect(mockSetCookie).toHaveBeenCalledWith(
        mockEvent,
        'test-session',
        expect.stringMatching(/^s:test-session-id-.*\./),
        expect.objectContaining({
          maxAge: 3600,
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          path: '/',
        })
      );
    });

    it('should load existing session when valid cookie exists', async () => {
      // Set up existing session in store
      const existingData = { userId: 'existing-user', username: 'testuser' };
      await store.setItem('existing-session-id', existingData);

      // Mock signed cookie
      const { signCookie } = await import('./crypto');
      const signedCookie = await signCookie('existing-session-id', 'test-secret-key');
      mockGetCookie.mockReturnValue(signedCookie);

      await useSession(mockEvent, config);

      const sessionData = getSession<TestSessionData>(mockEvent);
      expect(sessionData).toEqual(existingData);
    });

    it('should create new session when cookie exists but no data in store', async () => {
      // Mock signed cookie for non-existent session
      const { signCookie } = await import('./crypto');
      const signedCookie = await signCookie('non-existent-session', 'test-secret-key');
      mockGetCookie.mockReturnValue(signedCookie);

      await useSession(mockEvent, config);

      const sessionData = getSession<TestSessionData>(mockEvent);
      expect(sessionData).toEqual({
        userId: 'new-user',
        lastAccess: expect.any(Number),
      });
    });

    it('should handle invalid signed cookies', async () => {
      mockGetCookie.mockReturnValue('invalid-cookie');

      await useSession(mockEvent, config);

      // Should create new session
      const sessionData = getSession<TestSessionData>(mockEvent);
      expect(sessionData).toEqual({
        userId: 'new-user',
        lastAccess: expect.any(Number),
      });
    });

    it('should support multiple secrets for rotation', async () => {
      const configWithRotation = {
        ...config,
        secret: ['new-secret', 'old-secret'],
      };

      // Create cookie signed with old secret
      const { signCookie } = await import('./crypto');
      const signedWithOld = await signCookie('test-session', 'old-secret');
      mockGetCookie.mockReturnValue(signedWithOld);

      // Set up session data
      const sessionData = { userId: 'test-user' };
      await store.setItem('test-session', sessionData);

      await useSession(mockEvent, configWithRotation);

      const retrieved = getSession<TestSessionData>(mockEvent);
      expect(retrieved).toEqual(sessionData);
    });
  });

  describe('getSession', () => {
    it('should return session data when session exists', async () => {
      await useSession(mockEvent, config);
      
      const sessionData = getSession<TestSessionData>(mockEvent);
      expect(sessionData).toBeDefined();
      expect(sessionData?.userId).toBe('new-user');
    });

    it('should return null when no session exists', () => {
      const sessionData = getSession<TestSessionData>(mockEvent);
      expect(sessionData).toBeNull();
    });
  });

  describe('updateSession', () => {
    it('should update session data immutably', async () => {
      await useSession(mockEvent, config);
      
      await updateSession<TestSessionData>(mockEvent, (data) => ({
        username: 'updated-user',
        lastAccess: (data.lastAccess || 0) + 1000,
      }));

      const updatedData = getSession<TestSessionData>(mockEvent);
      expect(updatedData).toEqual({
        userId: 'new-user',
        username: 'updated-user',
        lastAccess: expect.any(Number),
      });
    });

    it('should persist updates to storage', async () => {
      await useSession(mockEvent, config);
      const sessionId = mockEvent.context.__session_id__;
      
      await updateSession<TestSessionData>(mockEvent, () => ({
        username: 'persistent-user',
      }));

      // Verify data is in storage
      const storedData = await store.getItem(sessionId);
      expect(storedData).toEqual(expect.objectContaining({
        username: 'persistent-user',
      }));
    });

    it('should throw error when no session exists', async () => {
      await expect(updateSession<TestSessionData>(mockEvent, () => ({}))).rejects.toThrow(
        'No active session found'
      );
    });
  });

  describe('destroySession', () => {
    it('should destroy session and clear context', async () => {
      await useSession(mockEvent, config);
      const sessionId = mockEvent.context.__session_id__;
      
      await destroySession(mockEvent);

      // Context should be cleared
      expect(getSession(mockEvent)).toBeNull();
      expect(mockEvent.context.__session_id__).toBeUndefined();

      // Storage should be cleared
      const storedData = await store.getItem(sessionId);
      expect(storedData).toBeNull();

      // Cookie should be cleared
      expect(mockSetCookie).toHaveBeenCalledWith(
        mockEvent,
        'test-session',
        '',
        expect.objectContaining({
          maxAge: 0,
          httpOnly: true,
          path: '/',
        })
      );
    });

    it('should handle destroying non-existent session gracefully', async () => {
      // Should not throw error
      await expect(destroySession(mockEvent)).resolves.toBeUndefined();
    });
  });

  describe('regenerateSession', () => {
    it('should regenerate session ID while preserving data', async () => {
      await useSession(mockEvent, config);
      const originalId = mockEvent.context.__session_id__;
      const originalData = getSession<TestSessionData>(mockEvent);
      
      await regenerateSession<TestSessionData>(mockEvent);
      
      const newId = mockEvent.context.__session_id__;
      const newData = getSession<TestSessionData>(mockEvent);

      // ID should be different
      expect(newId).not.toBe(originalId);
      
      // Data should be preserved
      expect(newData).toEqual(originalData);

      // Old session should be removed from storage
      const oldStoredData = await store.getItem(originalId);
      expect(oldStoredData).toBeNull();

      // New session should be in storage
      const newStoredData = await store.getItem(newId);
      expect(newStoredData).toEqual(originalData);

      // New cookie should be set
      expect(mockSetCookie).toHaveBeenCalledWith(
        mockEvent,
        'test-session',
        expect.stringMatching(/^s:.*\./),
        expect.objectContaining({
          maxAge: 3600,
        })
      );
    });

    it('should throw error when no session exists', async () => {
      await expect(regenerateSession<TestSessionData>(mockEvent)).rejects.toThrow(
        'No active session to regenerate'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', async () => {
      const faultyStore = {
        ...store,
        setItem: vi.fn().mockRejectedValue(new Error('Storage error')),
      };

      const faultyConfig = { ...config, store: faultyStore };

      await expect(useSession(mockEvent, faultyConfig)).rejects.toThrow();
    });

    it('should handle crypto errors gracefully', async () => {
      // Test with invalid secret format
      const invalidConfig = { ...config, secret: '' };

      await expect(useSession(mockEvent, invalidConfig)).rejects.toThrow();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete session lifecycle', async () => {
      // Initialize session
      await useSession(mockEvent, config);
      expect(getSession(mockEvent)).toBeDefined();

      // Update session
      await updateSession<TestSessionData>(mockEvent, () => ({ username: 'lifecycle-test' }));
      expect(getSession(mockEvent)?.username).toBe('lifecycle-test');

      // Regenerate session
      const originalId = mockEvent.context.__session_id__;
      await regenerateSession<TestSessionData>(mockEvent);
      expect(mockEvent.context.__session_id__).not.toBe(originalId);
      expect(getSession(mockEvent)?.username).toBe('lifecycle-test');

      // Destroy session
      await destroySession(mockEvent);
      expect(getSession(mockEvent)).toBeNull();
    });

    it('should handle concurrent session operations', async () => {
      await useSession(mockEvent, config);

      // Simulate concurrent updates
      const updates = [
        updateSession<TestSessionData>(mockEvent, () => ({ username: 'user1' })),
        updateSession<TestSessionData>(mockEvent, () => ({ userId: 'updated-id' })),
      ];

      await Promise.all(updates);

      const finalData = getSession<TestSessionData>(mockEvent);
      expect(finalData).toEqual(expect.objectContaining({
        userId: 'updated-id',
        username: 'user1',
      }));
    });
  });
});
