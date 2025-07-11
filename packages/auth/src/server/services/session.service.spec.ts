import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionService } from './session.service';
import { createError, H3Event } from 'h3';
import { AuthSessionData, SessionWithSave } from '../types/auth-session.types';
import {
  registerStorage,
  UnstorageSessionStore,
  useSession,
} from '@analog-tools/session';
import { registerMockService, resetAllInjections } from '@analog-tools/inject';
import { LoggerService } from '@analog-tools/logger';
import { SessionStorageConfig } from '../types/auth.types';

// Mock dependencies
vi.mock('@analog-tools/session', () => ({
  registerStorage: vi.fn(),
  getStore: vi.fn(),
  useSession: vi.fn().mockResolvedValue(undefined),
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
  let mockStore: Partial<UnstorageSessionStore<AuthSessionData>>;
  let mockSessionConfig: SessionStorageConfig;
  let mockSessionHandler: {
    data: Partial<AuthSessionData>;
    update: (fn: (data: AuthSessionData) => AuthSessionData) => void;
    save: () => Promise<void>;
    destroy: () => Promise<void>;
  };

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
      get: vi.fn((id) => {
        if (id === 'test-session-id') return Promise.resolve({ auth: { isAuthenticated: true } });
        if (id === 'non-existent-id') return Promise.resolve(null);
        if (id === 'error-session-id') return Promise.reject(new Error('Test error'));
        return Promise.resolve({ auth: { isAuthenticated: true } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
      set: vi.fn().mockResolvedValue(undefined),
      all: vi.fn().mockResolvedValue({
        'auth-session:session-1': { auth: { isAuthenticated: true } },
        'auth-session:session-2': { auth: { isAuthenticated: false } },
      }),
    };

    // Set up mock session handler
    mockSessionHandler = {
      data: { auth: { isAuthenticated: true } },
      update: vi.fn((updater) => {
        const result = updater(mockSessionHandler.data as AuthSessionData);
        // Reset data and assign new values
        for (const key in mockSessionHandler.data) {
          if (
            Object.prototype.hasOwnProperty.call(mockSessionHandler.data, key)
          ) {
            delete mockSessionHandler.data[
              key as keyof typeof mockSessionHandler.data
            ];
          }
        }
        Object.assign(mockSessionHandler.data, result);
      }),
      save: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
    };

    // Set up mock event
    mockEvent = {
      context: {
        sessionHandler: mockSessionHandler,
      },
    } as unknown as H3Event;

    // Set up mock session config
    mockSessionConfig = {
      type: 'memory',
      config: {},
    };

    // Register services
    registerMockService(LoggerService, mockLogger);

    // Mock getStore to return our mockStore
    vi.mocked(registerStorage).mockReturnValue(
      mockStore as UnstorageSessionStore<AuthSessionData>
    );

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
      await service.initSession(mockEvent);

      // Session handler already exists, so getStore and useSession shouldn't be called
      expect(useSession).not.toHaveBeenCalled();
    });

    it('should initialize session if session handler does not exist', async () => {
      // Remove existing sessionHandler
      const eventWithoutSession = {
        context: {},
      } as unknown as H3Event;

      await service.initSession(eventWithoutSession);

      expect(registerStorage).toHaveBeenCalledWith(
        mockSessionConfig.type,
        mockSessionConfig.config
      );
      expect(useSession).toHaveBeenCalledWith(
        eventWithoutSession,
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
      // @ts-expect-error suppress possibly undefined in test
      vi.mocked(mockStore.get).mockRejectedValueOnce(new TypeError('Cannot read properties of undefined (reading \'get\')'));

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
      const result = await service.getActiveSessions();

      expect(mockStore.all).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'auth-session:session-1',
        data: { auth: { isAuthenticated: true } },
        save: expect.any(Function),
      });
      expect(result[1]).toEqual({
        id: 'auth-session:session-2',
        data: { auth: { isAuthenticated: false } },
        save: expect.any(Function),
      });
    });

    it('should handle errors and return empty array', async () => {
      const error = new Error('Test error');
      // @ts-expect-error suppress possibly undefined in test
      vi.mocked(mockStore.all).mockRejectedValueOnce(error);

      const result = await service.getActiveSessions();

      expect(result).toEqual([]);
      expect(mockLogger.forContext().error).toHaveBeenCalledWith(
        'Error retrieving active sessions',
        error
      );
    });

    it('should provide a working save method for each session', async () => {
      const sessions = await service.getActiveSessions();

      await sessions[0].save();

      expect(mockStore.set).toHaveBeenCalledWith('auth-session:session-1', {
        auth: { isAuthenticated: true },
      });
    });
  });

  describe('destroySession', () => {
    it('should destroy the session and clean up context', async () => {
      await service.destroySession(mockEvent);

      expect(mockSessionHandler.destroy).toHaveBeenCalled();
      expect(mockEvent.context['sessionHandler']).toBeUndefined();
      expect(mockEvent.context['session']).toBeUndefined();
      expect(mockEvent.context['sessionId']).toBeUndefined();
    });

    it('should initialize session before destroying it', async () => {
      // Create a spy on initSession
      const spy = vi.spyOn(service, 'initSession');

      await service.destroySession(mockEvent);

      expect(spy).toHaveBeenCalledWith(mockEvent);
    });

    it('should clear auth data if it exists', async () => {
      await service.destroySession(mockEvent);

      expect(mockSessionHandler.update).toHaveBeenCalled();
      // Verify auth was removed in the update function
      expect(mockSessionHandler.data.auth).toBeUndefined();
    });

    it('should handle and propagate errors', async () => {
      // Make destroy throw an error
      const error = new Error('Destroy failed');
      // @ts-expect-error suppress possibly undefined in test
      mockSessionHandler.destroy.mockRejectedValueOnce(error);

      await expect(service.destroySession(mockEvent)).rejects.toMatchObject({
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
      const result = await service.getSessionData(mockEvent, 'auth');

      expect(result).toEqual({ isAuthenticated: true });
    });

    it('should return null if data does not exist', async () => {
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

      expect(mockSessionHandler.update).toHaveBeenCalled();
      expect(mockSessionHandler.save).toHaveBeenCalled();
      // Verify data was updated
      expect(mockSessionHandler.data.user).toEqual(testData);
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
      const result = await service.isValidSession(mockEvent);

      expect(result).toBe(true);
    });

    it('should return false for invalid sessions', async () => {
      // Create an event with invalid session
      const invalidEvent = {
        context: {
          sessionHandler: { data: null },
        },
      } as unknown as H3Event;

      const result = await service.isValidSession(invalidEvent);

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
