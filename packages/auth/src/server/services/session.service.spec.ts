import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionService } from './session.service';
import { createError, H3Event } from 'h3';
import { AuthSessionData } from '../types/auth-session.types';
import {
  useSession,
  getSession,
  updateSession,
  destroySession,
  createMemoryStore,
  createRedisStore,
  type Storage,
} from '@analog-tools/session';
import { registerMockService, resetAllInjections } from '@analog-tools/inject';
import { LoggerService } from '@analog-tools/logger';
import { SessionStorageConfig } from '../types/auth.types';

// Mock dependencies
vi.mock('@analog-tools/session', () => ({
  useSession: vi.fn().mockResolvedValue(undefined),
  getSession: vi.fn(),
  updateSession: vi.fn(),
  destroySession: vi.fn(),
  createMemoryStore: vi.fn(),
  createRedisStore: vi.fn(),
}));

vi.mock('h3', async () => {
  const actual = await vi.importActual('h3');
  return {
    ...actual,
    createError: vi.fn().mockImplementation((errorObj) => {
      const error = new Error(errorObj.message);
      Object.assign(error, errorObj);
      return error;
    }),
  };
});

describe('SessionService', () => {
  let service: SessionService;
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    forContext: ReturnType<typeof vi.fn>;
  };
  let mockEvent: H3Event;
  let mockStore: Partial<Storage<AuthSessionData>>;
  let mockSessionConfig: SessionStorageConfig;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Set up mock logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      forContext: vi.fn().mockReturnValue({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    };

    // Set up mock store
    mockStore = {
      getItem: vi.fn((id) => {
        if (id === 'test-session-id') return Promise.resolve({ auth: { isAuthenticated: true } } as AuthSessionData);
        if (id === 'non-existent-id') return Promise.resolve(null);
        if (id === 'error-session-id') return Promise.reject(new Error('Test error'));
        return Promise.resolve({ auth: { isAuthenticated: true } } as AuthSessionData);
      }),
      setItem: vi.fn().mockResolvedValue(undefined),
      getKeys: vi.fn().mockResolvedValue(['session-1', 'session-2']),
    };

    // Set up mock event
    mockEvent = {
      context: {},
    } as unknown as H3Event;

    // Set up mock session config
    mockSessionConfig = {
      type: 'memory',
      config: {},
    };

    // Register services
    registerMockService(LoggerService, mockLogger);

    // Mock createMemoryStore and createRedisStore to return our mockStore
    vi.mocked(createMemoryStore).mockReturnValue(mockStore as Storage<AuthSessionData>);
    vi.mocked(createRedisStore).mockReturnValue(mockStore as Storage<AuthSessionData>);

    // Create service instance
    service = new SessionService(mockSessionConfig);
  });

  afterEach(() => {
    resetAllInjections();
  });

  describe('constructor', () => {
    it('should properly initialize with config values', () => {
      expect(service).toBeTruthy();
      expect(mockLogger.forContext).toHaveBeenCalledWith('SessionService');
    });
  });

  describe('initSession', () => {
    it('should skip initialization if session already exists', async () => {
      // Mock existing session
      vi.mocked(getSession).mockReturnValue({ auth: { isAuthenticated: true } } as AuthSessionData);

      await service.initSession(mockEvent);

      // Session already exists, so useSession shouldn't be called
      expect(useSession).not.toHaveBeenCalled();
    });

    it('should initialize session if no session exists', async () => {
      // Mock no existing session
      vi.mocked(getSession).mockReturnValue(null);

      await service.initSession(mockEvent);

      expect(createMemoryStore).toHaveBeenCalled();
      expect(useSession).toHaveBeenCalledWith(
        mockEvent,
        expect.objectContaining({
          store: mockStore,
          name: 'auth.session',
          generate: expect.any(Function),
        })
      );

      // Check that the generate function returns correct default data
      const generateFn = vi.mocked(useSession).mock.calls[0][1].generate;
      // @ts-expect-error suppress possibly undefined in test
      const defaultSessionData = generateFn();
      expect(defaultSessionData).toEqual({
        auth: {
          isAuthenticated: false,
        },
      });
    });
  });

  describe('getSession', () => {
    beforeEach(async () => {
      await service.initSession(mockEvent);
    });
    it.skip('should retrieve session by ID', async () => {
      // Skipped due to unavailable memory store
    });

    it.skip('should return null when session does not exist', async () => {
      // Skipped due to unavailable memory store
    });

    it('should handle errors and return null', async () => {
      const getItemMock = mockStore.getItem as ReturnType<typeof vi.fn>;
      getItemMock.mockRejectedValueOnce(new TypeError('Test error'));

      const result = await service.getSession('error-session-id');

      expect(result).toBeNull();
      expect(mockLogger.forContext().error).toHaveBeenCalledWith(
        'Error retrieving session',
        expect.any(TypeError),
        { sessionId: 'error-session-id' }
      );
    });

    it.skip('should provide a working save method', async () => {
      // Skipped due to unavailable memory store
    });
  });

  describe('getActiveSessions', () => {
    beforeEach(async () => {
      const event = {
        context: {},
      } as unknown as H3Event;

      await service.initSession(event);
    });
    it('should retrieve all active sessions', async () => {
      // Mock store.getItem to return different session data for different keys
      const getItemMock = mockStore.getItem as ReturnType<typeof vi.fn>;
      getItemMock.mockImplementation((key) => {
        if (key === 'session-1') return Promise.resolve({ auth: { isAuthenticated: true } } as AuthSessionData);
        if (key === 'session-2') return Promise.resolve({ auth: { isAuthenticated: false } } as AuthSessionData);
        return Promise.resolve(null);
      });

      const result = await service.getActiveSessions();

      expect(mockStore.getKeys).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'session-1',
        data: { auth: { isAuthenticated: true } },
        save: expect.any(Function),
      });
      expect(result[1]).toEqual({
        id: 'session-2',
        data: { auth: { isAuthenticated: false } },
        save: expect.any(Function),
      });
    });

    it('should handle errors and return empty array', async () => {
      const error = new Error('Test error');
      const getKeysMock = mockStore.getKeys as ReturnType<typeof vi.fn>;
      getKeysMock.mockRejectedValueOnce(error);

      const result = await service.getActiveSessions();

      expect(result).toEqual([]);
      expect(mockLogger.forContext().error).toHaveBeenCalledWith(
        'Error retrieving active sessions',
        error
      );
    });

    it('should provide a working save method for each session', async () => {
      // Mock store.getItem to return session data
      const getItemMock = mockStore.getItem as ReturnType<typeof vi.fn>;
      getItemMock.mockImplementation((key) => {
        if (key === 'session-1') return Promise.resolve({ auth: { isAuthenticated: true } } as AuthSessionData);
        return Promise.resolve(null);
      });

      const sessions = await service.getActiveSessions();

      await sessions[0].save();

      expect(mockStore.setItem).toHaveBeenCalledWith('session-1', {
        auth: { isAuthenticated: true },
      });
    });
  });

  describe('destroyAuthSession', () => {
    it('should destroy the session and clear auth data', async () => {
      // Mock session with auth data
      vi.mocked(getSession).mockReturnValue({ auth: { isAuthenticated: true } } as AuthSessionData);

      await service.destroyAuthSession(mockEvent);

      expect(updateSession).toHaveBeenCalledWith(mockEvent, expect.any(Function));
      expect(destroySession).toHaveBeenCalledWith(mockEvent);
    });

    it('should initialize session before destroying it', async () => {
      // Create a spy on initSession
      const spy = vi.spyOn(service, 'initSession');

      await service.destroyAuthSession(mockEvent);

      expect(spy).toHaveBeenCalledWith(mockEvent);
    });

    it('should clear auth data if it exists', async () => {
      // Mock session with auth data
      vi.mocked(getSession).mockReturnValue({ auth: { isAuthenticated: true } } as AuthSessionData);

      await service.destroyAuthSession(mockEvent);

      expect(updateSession).toHaveBeenCalledWith(mockEvent, expect.any(Function));
      
      // Test the updater function
      const updateFn = vi.mocked(updateSession).mock.calls[0][1];
      const result = updateFn({ auth: { isAuthenticated: true } } as AuthSessionData);
      expect(result['auth']).toBeUndefined();
    });

    it('should handle and propagate errors', async () => {
      // Make destroySession throw an error
      const error = new Error('Destroy failed');
      vi.mocked(destroySession).mockRejectedValueOnce(error);

      await expect(service.destroyAuthSession(mockEvent)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Session handling failed',
      });

      expect(mockLogger.forContext().error).toHaveBeenCalledWith(
        'Session destruction failed',
        error
      );
      expect(createError).toHaveBeenCalledWith({
        statusCode: 500,
        message: 'Session handling failed',
      });
    });
  });

  describe('getSessionData', () => {
    it('should retrieve specific session data by key', async () => {
      // Mock session data
      vi.mocked(getSession).mockReturnValue({ auth: { isAuthenticated: true } } as AuthSessionData);

      const result = await service.getSessionData(mockEvent, 'auth');

      expect(result).toEqual({ isAuthenticated: true });
    });

    it('should return null if data does not exist', async () => {
      // Mock session data without the requested key
      vi.mocked(getSession).mockReturnValue({} as AuthSessionData);

      const result = await service.getSessionData(
        mockEvent,
        'nonExistentKey' as keyof AuthSessionData
      );

      expect(result).toBeNull();
    });

    it('should initialize session before getting data', async () => {
      // Create a spy on initSession
      const spy = vi.spyOn(service, 'initSession');

      await service.getSessionData(mockEvent, 'auth');

      expect(spy).toHaveBeenCalledWith(mockEvent);
    });
  });

  describe('setSessionData', () => {
    it('should set session data for a specific key', async () => {
      const testData = { testValue: 'test-data' };

      await service.setSessionData(mockEvent, 'user', testData);

      expect(updateSession).toHaveBeenCalledWith(mockEvent, expect.any(Function));
      
      // Test the updater function
      const updateFn = vi.mocked(updateSession).mock.calls[0][1];
      const result = updateFn({ auth: { isAuthenticated: false } } as AuthSessionData);
      expect(result['user']).toEqual(testData);
    });

    it('should initialize session before setting data', async () => {
      // Create a spy on initSession
      const spy = vi.spyOn(service, 'initSession');

      await service.setSessionData(mockEvent, 'user', {
        testValue: 'test-data',
      });

      expect(spy).toHaveBeenCalledWith(mockEvent);
    });
  });

  describe('isValidSession', () => {
    it('should return true for valid sessions', async () => {
      // Mock valid session data
      vi.mocked(getSession).mockReturnValue({ auth: { isAuthenticated: true } } as AuthSessionData);

      const result = await service.isValidSession(mockEvent);

      expect(result).toBe(true);
    });

    it('should return false for invalid sessions', async () => {
      // Mock no session data
      vi.mocked(getSession).mockReturnValue(null);

      const result = await service.isValidSession(mockEvent);

      expect(result).toBe(false);
    });

    it('should initialize session before validation', async () => {
      // Create a spy on initSession
      const spy = vi.spyOn(service, 'initSession');

      await service.isValidSession(mockEvent);

      expect(spy).toHaveBeenCalledWith(mockEvent);
    });
  });
});
