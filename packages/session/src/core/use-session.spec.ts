import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSession, validateConfig, SessionHandler } from './use-session';
import { H3SessionOptions, SessionCookie, SessionDataT } from '../types';
import { randomUUID } from 'uncrypto';
import { CookieErrorReason, signCookie, unsignCookie } from '../utils/crypto-utils';

// Mock H3 related modules
vi.mock('h3', () => ({
  getCookie: vi.fn(),
  setCookie: vi.fn(),
  H3Event: class {}
}));

import { getCookie, setCookie, H3Event } from 'h3';

// Import the crypto utils for mocking
vi.mock('../utils/crypto-utils', () => ({
  signCookie: vi.fn(),
  unsignCookie: vi.fn()
}));

describe('use-session', () => {
  // Test session data type
  interface TestSessionData extends SessionDataT {
    userId?: string;
    isLoggedIn?: boolean;
  }

  // Mock event with context for H3
  const createMockEvent = () => {
    return {
      context: {} as Record<string, any>
    };
  };

  // Mock session store
  const createMockStore = () => ({
    get: vi.fn(),
    set: vi.fn(),
    touch: vi.fn(),
    destroy: vi.fn()
  });

  // Mock session options
  const createMockOptions = <T extends SessionDataT>(store: any): H3SessionOptions<T> => ({
    store,
    secret: 'test-secret',
    name: 'test-session',
    genid: vi.fn().mockReturnValue('generated-id'),
    generate: vi.fn().mockReturnValue({ userId: 'default', isLoggedIn: false }),
    cookie: {
      path: '/',
      httpOnly: true,
      secure: true,
      maxAge: 3600
    },
    saveUninitialized: false
  });

  let mockEvent: ReturnType<typeof createMockEvent>;
  let mockStore: ReturnType<typeof createMockStore>;
  let mockOptions: H3SessionOptions<TestSessionData>;

  beforeEach(() => {
    mockEvent = createMockEvent();
    mockStore = createMockStore();
    mockOptions = createMockOptions<TestSessionData>(mockStore);

    // Reset mocks
    vi.mocked(getCookie).mockReset();
    vi.mocked(setCookie).mockReset();
    vi.mocked(signCookie).mockReset();
    vi.mocked(unsignCookie).mockReset();
    vi.mocked(randomUUID).mockReset().mockReturnValue('00000000-0000-0000-0000-000000000000');

    // Default implementations
    vi.mocked(signCookie).mockResolvedValue('s:signed-cookie-value');
  });

  describe('validateConfig', () => {
    it('should throw error if store is missing', () => {
      expect(() => validateConfig({ secret: 'test' } as H3SessionOptions)).toThrow('Session store is required');
    });

    it('should throw error if secret is missing', () => {
      expect(() => validateConfig({ store: {} as any } as H3SessionOptions)).toThrow('Session secret is required');
    });

    it('should not throw error if config is valid', () => {
      expect(() => validateConfig({ store: {} as any, secret: 'test' } as H3SessionOptions)).not.toThrow();
    });
  });

  describe('useSession', () => {
    it('should return early if session already exists in context', async () => {
      mockEvent.context['session'] = 'existing-session';

      await useSession(mockEvent as unknown as H3Event, mockOptions);

      // Should not do anything if session already exists
      expect(getCookie).not.toHaveBeenCalled();
    });

    describe('with no existing cookie', () => {
      beforeEach(() => {
        vi.mocked(getCookie).mockReturnValue(null); // No cookie
      });

      it('should create a new session with generated ID', async () => {
        await useSession(mockEvent as unknown as H3Event, mockOptions);

        // Should generate a new ID
        expect(mockOptions.genid).toHaveBeenCalled();

        // Should create a new session in the context
        expect(mockEvent.context['session']).toBeDefined();
        expect(mockEvent.context['sessionId']).toBeDefined();

        // Should create the session handler
        const sessionHandler = mockEvent.context['sessionHandler'] as SessionHandler;
        expect(sessionHandler).toBeDefined();
        expect(sessionHandler.id).toBeDefined();
        expect(sessionHandler.data).toEqual({ userId: 'default', isLoggedIn: false });
      });

      it('should save uninitialized session if configured', async () => {
        mockOptions.saveUninitialized = true;

        await useSession(mockEvent as unknown as H3Event, mockOptions);

        // Should save the session
        expect(mockStore.set).toHaveBeenCalled();
      });

      it('should not save uninitialized session by default', async () => {
        mockOptions.saveUninitialized = false;

        await useSession(mockEvent as unknown as H3Event, mockOptions);

        // Should not save the session
        expect(mockStore.set).not.toHaveBeenCalled();
      });
    });

    describe('with existing valid cookie', () => {
      beforeEach(() => {
        vi.mocked(getCookie).mockReturnValue('s:existing-session-id');
        vi.mocked(unsignCookie).mockResolvedValue({
          success: true,
          value: 'existing-session-id'
        });
      });

      it('should load existing session data', async () => {
        // Mock store to return session data
        mockStore.get.mockResolvedValue({
          userId: 'existing-user',
          isLoggedIn: true
        });

        await useSession(mockEvent as unknown as H3Event, mockOptions);

        // Should get cookie and unsign it
        expect(getCookie).toHaveBeenCalledWith(mockEvent, 'test-session');
        expect(unsignCookie).toHaveBeenCalledWith('s:existing-session-id', ['test-secret']);

        // Should load session data from store
        expect(mockStore.get).toHaveBeenCalledWith('existing-session-id');

        // Should touch the session to update TTL
        expect(mockStore.touch).toHaveBeenCalledWith('existing-session-id', {
          userId: 'existing-user',
          isLoggedIn: true
        });

        // Should set the session in context
        expect(mockEvent.context['session']).toBeDefined();
        expect(mockEvent.context['sessionId']).toBe('existing-session-id');

        // Should create the session handler with correct data
        const sessionHandler = mockEvent.context['sessionHandler'] as SessionHandler;
        expect(sessionHandler).toBeDefined();
        expect(sessionHandler.id).toBe('existing-session-id');
        expect(sessionHandler.data).toEqual({ userId: 'existing-user', isLoggedIn: true });
      });

      it('should create new session data if ID exists but store has no data', async () => {
        // Mock store to return no session data
        mockStore.get.mockResolvedValue(undefined);

        await useSession(mockEvent as unknown as H3Event, mockOptions);

        // Should get cookie and unsign it
        expect(getCookie).toHaveBeenCalledWith(mockEvent, 'test-session');
        expect(unsignCookie).toHaveBeenCalledWith('s:existing-session-id', ['test-secret']);

        // Should try to load session data from store
        expect(mockStore.get).toHaveBeenCalledWith('existing-session-id');

        // Should not touch the session since there's no data
        expect(mockStore.touch).not.toHaveBeenCalled();

        // Should create new session data
        expect(mockEvent.context['session']).toBeDefined();
        expect(mockEvent.context['sessionId']).toBe('existing-session-id');

        // Should create the session handler with default data
        const sessionHandler = mockEvent.context['sessionHandler'] as SessionHandler;
        expect(sessionHandler).toBeDefined();
        expect(sessionHandler.id).toBe('existing-session-id');
        expect(sessionHandler.data).toEqual({ userId: 'default', isLoggedIn: false });
      });
    });

    describe('with invalid cookie', () => {
      beforeEach(() => {
        vi.mocked(getCookie).mockReturnValue('invalid-cookie');
        vi.mocked(unsignCookie).mockResolvedValue({
          success: false,
          // @ts-expect-error Mocking error
          reason: 'verification_failed'
        });
      });

      it('should create a new session if cookie is invalid', async () => {
        await useSession(mockEvent as unknown as H3Event, mockOptions);

        // Should try to get and unsign cookie
        expect(getCookie).toHaveBeenCalledWith(mockEvent, 'test-session');
        expect(unsignCookie).toHaveBeenCalledWith('invalid-cookie', ['test-secret']);

        // Should generate a new ID
        expect(mockOptions.genid).toHaveBeenCalled();

        // Should create a new session in the context
        expect(mockEvent.context['session']).toBeDefined();
        expect(mockEvent.context['sessionId']).toBeDefined();
      });
    });

    describe('session handler API', () => {
      let sessionHandler: SessionHandler<TestSessionData>;

      beforeEach(async () => {
        vi.mocked(getCookie).mockReturnValue(null); // No cookie
        await useSession(mockEvent as unknown as H3Event, mockOptions);
        sessionHandler = mockEvent.context['sessionHandler'];
      });

      it('should expose data through getter', () => {
        expect(sessionHandler.data).toEqual({ userId: 'default', isLoggedIn: false });
      });

      it('should update data immutably', () => {
        sessionHandler.update(data => ({ ...data, isLoggedIn: true }));

        expect(sessionHandler.data).toEqual({ userId: 'default', isLoggedIn: true });
        expect(mockEvent.context['session'].data).toEqual({ userId: 'default', isLoggedIn: true });
      });

      it('should set new data immutably', () => {
        sessionHandler.set({ userId: 'new-user', isLoggedIn: true });

        expect(sessionHandler.data).toEqual({ userId: 'new-user', isLoggedIn: true });
        expect(mockEvent.context['session'].data).toEqual({ userId: 'new-user', isLoggedIn: true });
      });

      it('should save data to store', async () => {
        await sessionHandler.save();

        expect(mockStore.set).toHaveBeenCalledWith(
          expect.any(String),
          { userId: 'default', isLoggedIn: false }
        );
      });

      it('should reload data from store', async () => {
        mockStore.get.mockResolvedValue({ userId: 'reloaded', isLoggedIn: true });

        await sessionHandler.reload();

        expect(mockStore.get).toHaveBeenCalled();
        expect(sessionHandler.data).toEqual({ userId: 'reloaded', isLoggedIn: true });
      });

      it('should destroy session', async () => {
        await sessionHandler.destroy();

        expect(mockStore.destroy).toHaveBeenCalled();
        expect(sessionHandler.cookie.maxAge).toBe(0);
      });

      it('should regenerate session with new ID', async () => {
        const originalId = sessionHandler.id;

        // @ts-expect-error mock
        mockOptions.genid.mockReturnValue('regenerated-id');
        // @ts-expect-error mock
        mockOptions.generate.mockReturnValue({ userId: 'regenerated', isLoggedIn: false });

        await sessionHandler.regenerate();

        // Should destroy old session
        expect(mockStore.destroy).toHaveBeenCalledWith(originalId);

        // Should create new session
        expect(sessionHandler.id).not.toBe(originalId);

        // Should save new session
        expect(mockStore.set).toHaveBeenCalled();
      });
    });

    describe('with array of secrets for key rotation', () => {
      it('should use an array of secrets for verification', async () => {
        mockOptions.secret = ['old-secret', 'current-secret', 'new-secret'];
        vi.mocked(getCookie).mockReturnValue('s:existing-session-id');

        await useSession(mockEvent as unknown as H3Event, mockOptions);

        // Should verify using all secrets
        expect(unsignCookie).toHaveBeenCalledWith(
          's:existing-session-id',
          ['old-secret', 'current-secret', 'new-secret']
        );
      });

      it('should sign with the newest secret', async () => {
        mockOptions.secret = ['old-secret', 'current-secret', 'new-secret'];
        vi.mocked(getCookie).mockReturnValue(null);

        await useSession(mockEvent as unknown as H3Event, mockOptions);

        // Should sign using the newest secret (last in array)
        expect(signCookie).toHaveBeenCalledWith(expect.any(String), 'new-secret');
      });
    });
  });
});
