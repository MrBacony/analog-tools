import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Session } from './session';
import { SessionCookie, SessionDataT, SessionStore } from '../types';
import { inject } from '@analog-tools/inject';
import { LoggerService } from '@analog-tools/logger';

describe('Session', () => {
  // Test session data type
  interface TestSessionData extends SessionDataT {
    userId?: string;
    role?: string;
    isLoggedIn?: boolean;
  }

  // Mock session store
  const createMockStore = () => ({
    get: vi.fn(),
    set: vi.fn(),
    touch: vi.fn(),
    destroy: vi.fn()
  });

  // Mock session cookie
  const createMockCookie = () => ({
    path: '/',
    httpOnly: true,
    secure: true,
    maxAge: 86400,
    setSessionId: vi.fn()
  });

  // Mock generator function
  const createMockGenerator = (id = 'new-id', data = { userId: 'new-user' }) => {
    return vi.fn().mockResolvedValue({ id, data });
  };

  let mockStore: ReturnType<typeof createMockStore>;
  let mockCookie: SessionCookie;
  let mockGenerator: ReturnType<typeof createMockGenerator>;
  let session: Session;
  let initialData: TestSessionData;

  beforeEach(() => {
    mockStore = createMockStore();
    mockCookie = createMockCookie();
    mockGenerator = createMockGenerator();
    initialData = { userId: 'user123', role: 'admin', isLoggedIn: true };

    session = new Session(
      'test-id',
      initialData,
      mockStore as unknown as SessionStore,
      mockGenerator,
      mockCookie
    );
  });

  describe('constructor', () => {
    it('should create a session with the provided properties', () => {
      expect(session).toBeDefined();
      expect(session.id).toBe('test-id');
      expect(session.data).toEqual(initialData);
      expect(session.cookie).toBe(mockCookie);
    });

    it('should freeze the initial data to make it immutable', () => {
      expect(Object.isFrozen(session.data)).toBe(true);
      
      // Verify that the data cannot be modified
      const data = session.data as Record<string, unknown>;
      expect(() => {
        data.userId = 'modified';
      }).toThrow();
    });
  });

  describe('getters and setters', () => {
    it('should provide access to the session id', () => {
      expect(session.id).toBe('test-id');
    });

    it('should provide access to the session data', () => {
      expect(session.data).toEqual(initialData);
    });

    it('should allow getting the cookie object', () => {
      expect(session.cookie).toBe(mockCookie);
    });

    it('should allow setting the cookie object', () => {
      const newCookie = createMockCookie();
      session.cookie = newCookie;
      expect(session.cookie).toBe(newCookie);
    });
  });

  describe('update', () => {
    it('should update session data immutably', () => {
      const originalData = session.data;
      const updatedSession = session.update(data => ({ ...data, isLoggedIn: false }));
      
      // Should return the same session instance for chaining
      expect(updatedSession).toBe(session);
      
      // Data reference should have changed
      expect(session.data).not.toBe(originalData);
      
      // Data should be correctly updated
      expect(session.data).toEqual({
        userId: 'user123',
        role: 'admin',
        isLoggedIn: false
      });
      
      // Updated data should also be frozen
      expect(Object.isFrozen(session.data)).toBe(true);
    });

    it('should support partial updates', () => {
      session.update(() => ({ status: 'active' }));
      expect(session.data).toEqual({
        userId: 'user123',
        role: 'admin',
        isLoggedIn: true,
        status: 'active'
      });
    });
  });

  describe('set', () => {
    it('should replace the entire session data immutably', () => {
      const originalData = session.data;
      const newData = { userId: 'new-user', role: 'user', isLoggedIn: false };
      const updatedSession = session.set(newData);
      
      // Should return the same session instance for chaining
      expect(updatedSession).toBe(session);
      
      // Data reference should have changed
      expect(session.data).not.toBe(originalData);
      
      // New data should be set correctly
      expect(session.data).toEqual(newData);
      
      // New data should be frozen
      expect(Object.isFrozen(session.data)).toBe(true);
    });
  });

  describe('save', () => {
    it('should save session data to the store', async () => {
      await session.save();
      
      expect(mockStore.set).toHaveBeenCalledWith('test-id', initialData);
    });

    it('should save the current data after updates', async () => {
      session.update(data => ({ ...data, role: 'superadmin' }));
      await session.save();
      
      expect(mockStore.set).toHaveBeenCalledWith(
        'test-id', 
        {
          userId: 'user123',
          role: 'superadmin',
          isLoggedIn: true
        }
      );
    });
  });

  describe('reload', () => {
    it('should reload session data from the store', async () => {
      const refreshedData = { 
        userId: 'user123',
        role: 'member', // Changed role
        isLoggedIn: true 
      };
      mockStore.get.mockResolvedValue(refreshedData);
      
      await session.reload();
      
      expect(mockStore.get).toHaveBeenCalledWith('test-id');
      expect(session.data).toEqual(refreshedData);
      expect(Object.isFrozen(session.data)).toBe(true);
    });

    it('should use generator for data if store returns nothing', async () => {
      mockStore.get.mockResolvedValue(undefined);
      mockGenerator.mockResolvedValue({
        id: 'test-id',
        data: { userId: 'fresh', isLoggedIn: false }
      });
      
      await session.reload();
      
      expect(mockStore.get).toHaveBeenCalledWith('test-id');
      expect(mockGenerator).toHaveBeenCalled();
      expect(session.data).toEqual({ userId: 'fresh', isLoggedIn: false });
    });
  });

  describe('destroy', () => {
    const logger = inject(LoggerService).forContext('@analog-tools/session');
    
    it('should destroy the session and set cookie maxAge to 0', async () => {
      const consoleSpy = vi.spyOn(logger, 'info');

      await session.destroy();
      
      expect(mockStore.destroy).toHaveBeenCalledWith('test-id');
      expect(mockCookie.maxAge).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith('Destroying session test-id');
    });
  });

  describe('regenerate', () => {
    it('should destroy old session and create new one with new ID', async () => {
      mockGenerator.mockResolvedValue({
        id: 'regenerated-id',
        data: { userId: 'regenerated-user', isLoggedIn: false }
      });
      
      await session.regenerate();
      
      // Should destroy old session
      expect(mockStore.destroy).toHaveBeenCalledWith('test-id');
      
      // Should generate new session
      expect(mockGenerator).toHaveBeenCalled();
      
      // Should update the session ID
      expect(session.id).toBe('regenerated-id');
      
      // Should update the session data
      expect(session.data).toEqual({ userId: 'regenerated-user', isLoggedIn: false });
      
      // Should update cookie with new session ID
      expect(mockCookie.setSessionId).toHaveBeenCalledWith('regenerated-id');
      
      // Should save the new session
      expect(mockStore.set).toHaveBeenCalled();
    });
  });
});
