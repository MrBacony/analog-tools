/**
 * Tests for core session functions
 * Comprehensive testing of the simplified session API
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  useSession,
  getSession,
  refetchSession,
  updateSession,
  destroySession,
  regenerateSession
} from './session';
import { createUnstorageStore } from './storage';
import type { SessionData, SessionConfig } from './types';

vi.mock('h3', () => ({
  getCookie: vi.fn(),
  setCookie: vi.fn(),
}));

// A Proxy rather than a copy: `crypto.subtle` is a branded getter, so spreading
// `globalThis.crypto` would break cookie signing. A plain function rather than
// `vi.fn`: the global `resetAllMocks` in test-setup would strip the
// implementation and hand back `undefined` IDs.
const realCrypto = globalThis.crypto;
let generatedIdCount = 0;
vi.stubGlobal(
  'crypto',
  new Proxy(realCrypto, {
    get(target, prop) {
      if (prop === 'randomUUID') {
        return () => `test-session-id-${++generatedIdCount}`;
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  })
);

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
  let store: Awaited<ReturnType<typeof createUnstorageStore>>;
  let config: SessionConfig<TestSessionData>;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    mockEvent = {
      node: { 
        req: {}, 
        res: {} 
      },
      context: {},
    };

    store = await createUnstorageStore<TestSessionData>({ type: 'memory' });
    
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

      const sessionData = getSession<TestSessionData>(mockEvent);
      expect(sessionData).toEqual({
        userId: 'new-user',
        lastAccess: expect.any(Number),
      });

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

    it('defaults cookie.secure to true when not specified', async () => {
      mockGetCookie.mockReturnValue(undefined);

      await useSession(mockEvent, {
        ...config,
        cookie: { httpOnly: true, sameSite: 'lax' },
      });

      expect(mockSetCookie).toHaveBeenCalledWith(
        mockEvent,
        'test-session',
        expect.any(String),
        expect.objectContaining({ secure: true })
      );
    });

    it('should load existing session when valid cookie exists', async () => {
      const existingData = { userId: 'existing-user', username: 'testuser' };
      await store.setItem('existing-session-id', existingData);

      const { signCookie } = await import('./crypto');
      const signedCookie = await signCookie('existing-session-id', 'test-secret-key');
      mockGetCookie.mockReturnValue(signedCookie);

      await useSession(mockEvent, config);

      const sessionData = getSession<TestSessionData>(mockEvent);
      expect(sessionData).toEqual(existingData);
    });

    it('should create new session when cookie exists but no data in store', async () => {
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

      const { signCookie } = await import('./crypto');
      const signedWithOld = await signCookie('test-session', 'old-secret');
      mockGetCookie.mockReturnValue(signedWithOld);

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

  describe('refetchSession', () => {
    it('should read the latest data from storage, not the cached context copy', async () => {
      await useSession(mockEvent, config);

      const sessionId = mockEvent.context['__session_id__'];
      // Simulate a concurrent request writing a newer version directly to
      // storage, without going through this event's context.
      await store.setItem(sessionId, {
        userId: 'new-user',
        username: 'updated-by-another-request',
      });

      // The cached context copy is unaware of the concurrent write.
      expect(getSession<TestSessionData>(mockEvent)?.username).toBeUndefined();

      const refetched = await refetchSession<TestSessionData>(mockEvent);
      expect(refetched?.username).toBe('updated-by-another-request');
    });

    it('should return null when no session exists', async () => {
      const refetched = await refetchSession<TestSessionData>(mockEvent);
      expect(refetched).toBeNull();
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

      expect(getSession(mockEvent)).toBeNull();
      expect(mockEvent.context.__session_id__).toBeUndefined();

      const storedData = await store.getItem(sessionId);
      expect(storedData).toBeNull();

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

      expect(newId).not.toBe(originalId);
      
      expect(newData).toEqual(originalData);

      const oldStoredData = await store.getItem(originalId);
      expect(oldStoredData).toBeNull();

      const newStoredData = await store.getItem(newId);
      expect(newStoredData).toEqual(originalData);

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

    it('should report storage failures as STORAGE_ERROR', async () => {
      const faultyStore = {
        ...store,
        setItem: vi.fn().mockRejectedValue(new Error('Storage error')),
      };

      const faultyConfig = { ...config, store: faultyStore };

      await expect(useSession(mockEvent, faultyConfig)).rejects.toMatchObject({
        code: 'STORAGE_ERROR',
      });
    });

    it('should report cookie failures as COOKIE_ERROR', async () => {
      mockSetCookie.mockImplementationOnce(() => {
        throw new Error('Cookie error');
      });

      await expect(useSession(mockEvent, config)).rejects.toMatchObject({
        code: 'COOKIE_ERROR',
      });
    });

    it('should handle crypto errors gracefully', async () => {
      const invalidConfig = { ...config, secret: '' };

      await expect(useSession(mockEvent, invalidConfig)).rejects.toThrow();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete session lifecycle', async () => {
      await useSession(mockEvent, config);
      expect(getSession(mockEvent)).toBeDefined();

      await updateSession<TestSessionData>(mockEvent, () => ({ username: 'lifecycle-test' }));
      expect(getSession(mockEvent)?.username).toBe('lifecycle-test');

      const originalId = mockEvent.context.__session_id__;
      await regenerateSession<TestSessionData>(mockEvent);
      expect(mockEvent.context.__session_id__).not.toBe(originalId);
      expect(getSession(mockEvent)?.username).toBe('lifecycle-test');

      await destroySession(mockEvent);
      expect(getSession(mockEvent)).toBeNull();
    });

    it('should handle concurrent session operations', async () => {
      await useSession(mockEvent, config);

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
