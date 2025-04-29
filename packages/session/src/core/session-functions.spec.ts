import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SessionState,
  createSessionState,
  getSessionData,
  updateSessionData,
  setSessionData,
  saveSession,
  reloadSession,
  destroySession,
  regenerateSession
} from './session-functions';
import { SessionCookie, SessionDataT, SessionStore } from '../types';

describe('session-functions', () => {
  // Test session data type
  interface TestSessionData extends SessionDataT {
    userId?: string;
    role?: string;
    isLoggedIn?: boolean;
    status?: string;
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
  let sessionState: SessionState<TestSessionData>;

  beforeEach(() => {
    mockStore = createMockStore();
    mockCookie = createMockCookie();
    mockGenerator = createMockGenerator();

    sessionState = createSessionState<TestSessionData>(
      'test-id',
      { userId: 'user123', role: 'admin' },
      mockStore as unknown as SessionStore<TestSessionData>,
      mockGenerator,
      mockCookie
    );
  });

  describe('createSessionState', () => {
    it('should create a session state object with frozen data', () => {
      const state = createSessionState(
        'session123',
        { userId: 'user123' },
        {} as SessionStore,
        () => Promise.resolve({ id: 'id', data: { userId: 'user' } }),
        {} as SessionCookie
      );

      expect(state).toEqual({
        id: 'session123',
        data: { userId: 'user123' },
        store: {},
        generator: expect.any(Function),
        cookie: {}
      });

      // Verify that data is frozen
      expect(Object.isFrozen(state.data)).toBe(true);
    });
  });

  describe('getSessionData', () => {
    it('should return the session data', () => {
      const data = getSessionData(sessionState);
      expect(data).toEqual({ userId: 'user123', role: 'admin' });
    });
  });

  describe('updateSessionData', () => {
    it('should update the session data immutably with new properties', () => {
      const updater = (data: TestSessionData) => ({ isLoggedIn: true });
      const newState = updateSessionData(sessionState, updater);

      expect(newState).not.toBe(sessionState);
      expect(newState.data).not.toBe(sessionState.data);
      expect(newState.data).toEqual({
        userId: 'user123',
        role: 'admin',
        isLoggedIn: true
      });
      expect(Object.isFrozen(newState.data)).toBe(true);
    });

    it('should merge the returned data with existing data', () => {
      const updater = () => ({ userId: 'new-user', status: 'active' });
      const newState = updateSessionData(sessionState, updater);

      // The implementation merges the returned object with the existing data
      expect(newState.data).toEqual({
        userId: 'new-user', // Updated
        role: 'admin',      // Preserved from original
        status: 'active'    // Added
      });
    });
  });

  describe('setSessionData', () => {
    it('should completely replace session data immutably', () => {
      const newData = { userId: 'new-user', isLoggedIn: true };
      const newState = setSessionData(sessionState, newData);

      expect(newState).not.toBe(sessionState);
      expect(newState.data).not.toBe(sessionState.data);
      expect(newState.data).toEqual(newData);
      expect(Object.isFrozen(newState.data)).toBe(true);

      // Original data should remain unchanged
      expect(sessionState.data).toEqual({
        userId: 'user123',
        role: 'admin'
      });
    });
  });

  describe('saveSession', () => {
    it('should save session data to the store', async () => {
      await saveSession(sessionState);

      expect(mockStore.set).toHaveBeenCalledWith(
        'test-id',
        { userId: 'user123', role: 'admin' }
      );
    });
  });

  describe('reloadSession', () => {
    it('should reload session data from the store', async () => {
      mockStore.get.mockResolvedValue({ userId: 'updated', role: 'user' });

      const newState = await reloadSession(sessionState);

      expect(mockStore.get).toHaveBeenCalledWith('test-id');
      expect(newState.data).toEqual({ userId: 'updated', role: 'user' });
      expect(Object.isFrozen(newState.data)).toBe(true);
    });

    it('should use generator for data if store returns nothing', async () => {
      mockStore.get.mockResolvedValue(undefined);
      mockGenerator.mockResolvedValue({
        id: 'test-id',
        data: { userId: 'fresh', isLoggedIn: false }
      });

      const newState = await reloadSession(sessionState);

      expect(mockStore.get).toHaveBeenCalledWith('test-id');
      expect(mockGenerator).toHaveBeenCalled();
      expect(newState.data).toEqual({ userId: 'fresh', isLoggedIn: false });
    });
  });

  describe('destroySession', () => {
    it('should destroy the session and set cookie maxAge to 0', async () => {
      await destroySession(sessionState);

      expect(mockStore.destroy).toHaveBeenCalledWith('test-id');
      expect(mockCookie.maxAge).toBe(0);
    });
  });

  describe('regenerateSession', () => {
    it('should destroy old session and create new one with new ID', async () => {
      mockGenerator.mockResolvedValue({
        id: 'new-session-id',
        data: { userId: 'new-user', isLoggedIn: true }
      });

      const newState = await regenerateSession(sessionState);

      // Should destroy old session
      expect(mockStore.destroy).toHaveBeenCalledWith('test-id');

      // Should generate new session
      expect(mockGenerator).toHaveBeenCalled();

      // Should update cookie with new session ID
      expect(mockCookie.setSessionId).toHaveBeenCalledWith('new-session-id');

      // Should save new session
      expect(mockStore.set).toHaveBeenCalledWith(
        'new-session-id',
        { userId: 'new-user', isLoggedIn: true }
      );

      // Should return new state
      expect(newState).toEqual({
        ...sessionState,
        id: 'new-session-id',
        data: { userId: 'new-user', isLoggedIn: true },
      });
      expect(Object.isFrozen(newState.data)).toBe(true);
    });
  });
});
