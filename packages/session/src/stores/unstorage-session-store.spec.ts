import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnstorageSessionStore } from './unstorage-session-store';
import type { TTL } from '../types';
import { inject } from '@analog-tools/inject';
import { LoggerService } from '@analog-tools/logger';

describe('UnstorageSessionStore', () => {
  const logger = inject(LoggerService).forContext('@analog-tools/session');

  // Mock storage implementation
  const createMockStorage = () => {
    const storage: Record<string, any> = {};

    return {
      getItem: vi.fn((key: string) => Promise.resolve(storage[key])),
      setItem: vi.fn((key: string, value: any, options?: any) => {
        storage[key] = value;
        return Promise.resolve();
      }),
      removeItem: vi.fn((key: string) => {
        delete storage[key];
        return Promise.resolve();
      }),
      getKeys: vi.fn((prefix?: string) => {
        return Promise.resolve(
          Object.keys(storage).filter(
            (key) => !prefix || key.startsWith(prefix)
          )
        );
      }),
      getItems: vi.fn((keys: string[]) => {
        return Promise.resolve(
          keys.map((key) => ({ key, value: storage[key] }))
        );
      }),
      _raw: storage, // For test inspection
    };
  };

  let mockStorage: ReturnType<typeof createMockStorage>;
  let sessionStore: UnstorageSessionStore;
  const testSessionData = { userId: 'user123', role: 'admin' };

  beforeEach(() => {
    mockStorage = createMockStorage();
    sessionStore = new UnstorageSessionStore(mockStorage as any, {
      prefix: 'test-sess',
      ttl: 3600, // 1 hour
    });
  });

  describe('constructor', () => {
    it('should initialize with default values if not provided', () => {
      const store = new UnstorageSessionStore(mockStorage as any, {});
      expect(store.prefix).toBe('sess');
      expect(typeof store.ttl).toBe('number');
    });

    it('should use provided configuration values', () => {
      const customTTL: TTL<any> = (data) => (data.userId ? 7200 : 3600);
      const store = new UnstorageSessionStore(mockStorage as any, {
        prefix: 'custom',
        ttl: customTTL,
      });

      expect(store.prefix).toBe('custom');
      expect(store.ttl).toBe(customTTL);
    });
  });

  describe('get', () => {
    it('should retrieve session data by ID', async () => {
      mockStorage.getItem.mockResolvedValue(testSessionData);

      const result = await sessionStore.get('session123');

      expect(mockStorage.getItem).toHaveBeenCalledWith('test-sess:session123');
      expect(result).toEqual(testSessionData);
    });

    it('should return undefined for non-existent session', async () => {
      mockStorage.getItem.mockResolvedValue(undefined);

      const result = await sessionStore.get('nonexistent');

      expect(result).toBeUndefined();
    });

    it('should handle storage errors', async () => {
      const consoleSpy = vi.spyOn(logger, 'error');

      mockStorage.getItem.mockRejectedValue(new Error('Storage error'));

      const result = await sessionStore.get('session123');

      expect(result).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('set', () => {
    it('should store session data with TTL', async () => {
      await sessionStore.set('session123', testSessionData);

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'test-sess:session123',
        testSessionData,
        { ttl: 3600 }
      );
    });

    it('should use TTL function when provided', async () => {
      const customTTL: TTL<any> = (data) => (data.userId ? 7200 : 3600);
      sessionStore.ttl = customTTL;

      await sessionStore.set('session123', testSessionData);

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'test-sess:session123',
        testSessionData,
        { ttl: 7200 }
      );
    });

    it('should destroy session if TTL is zero or negative', async () => {
      sessionStore.ttl = 0;
      const destroySpy = vi.spyOn(sessionStore, 'destroy');

      await sessionStore.set('session123', testSessionData);

      expect(destroySpy).toHaveBeenCalledWith('session123');
      expect(mockStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should remove session data', async () => {
      await sessionStore.destroy('session123');

      expect(mockStorage.removeItem).toHaveBeenCalledWith(
        'test-sess:session123'
      );
    });
  });

  describe('touch', () => {
    it('should update session TTL by calling set', async () => {
      const setSpy = vi.spyOn(sessionStore, 'set');

      await sessionStore.touch('session123', testSessionData);

      expect(setSpy).toHaveBeenCalledWith('session123', testSessionData);
    });
  });

  describe('clear', () => {
    it('should remove all sessions', async () => {
      mockStorage.getKeys.mockResolvedValue([
        'test-sess:session1',
        'test-sess:session2',
      ]);

      await sessionStore.clear();

      expect(mockStorage.getKeys).toHaveBeenCalled();
      expect(mockStorage.removeItem).toHaveBeenCalledTimes(2);
      expect(mockStorage.removeItem).toHaveBeenCalledWith('test-sess:session1');
      expect(mockStorage.removeItem).toHaveBeenCalledWith('test-sess:session2');
    });
  });

  describe('all', () => {
    it('should return all sessions', async () => {
      const session1 = { userId: 'user1' };
      const session2 = { userId: 'user2' };

      mockStorage.getKeys.mockResolvedValue([
        'test-sess:session1',
        'test-sess:session2',
      ]);

      mockStorage.getItems.mockResolvedValue([
        { key: 'test-sess:session1', value: session1 },
        { key: 'test-sess:session2', value: session2 },
      ]);

      const result = await sessionStore.all();

      expect(mockStorage.getKeys).toHaveBeenCalled();
      expect(mockStorage.getItems).toHaveBeenCalledWith([
        'test-sess:session1',
        'test-sess:session2',
      ]);
      expect(result).toEqual({
        'test-sess:session1': session1,
        'test-sess:session2': session2,
      });
    });

    it('should handle errors when getting individual session data', async () => {
      const consoleSpy = vi.spyOn(logger, 'error');

      mockStorage.getKeys.mockRejectedValueOnce(
        new Error('Failed to get session')
      );

      const result = await sessionStore.all();
      expect(mockStorage.getKeys).toHaveBeenCalled();

      // When any promise in Promise.all rejects, the catch block returns an empty object
      expect(result).toEqual({});

      // Check that the error was caught and logged
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error retrieving all sessions:',
        expect.any(Error)
      );
    });

    it('should return empty object when no sessions exist', async () => {
      mockStorage.getKeys.mockResolvedValue([]);

      const result = await sessionStore.all();

      expect(mockStorage.getKeys).toHaveBeenCalled();
      expect(mockStorage.getItem).not.toHaveBeenCalled();
      expect(result).toEqual({});
    });

    it('should handle errors when retrieving sessions', async () => {
      const consoleSpy = vi.spyOn(logger, 'error');

      mockStorage.getKeys.mockRejectedValue(new Error('connection error'));

      const result = await sessionStore.all();

      expect(mockStorage.getKeys).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error retrieving all sessions:',
        expect.any(Error)
      );
      expect(result).toEqual({});
    });
  });

  describe('length', () => {
    it('should return the number of sessions', async () => {
      mockStorage.getKeys.mockResolvedValue([
        'test-sess:session1',
        'test-sess:session2',
      ]);

      const result = await sessionStore.length();

      expect(mockStorage.getKeys).toHaveBeenCalled();
      expect(result).toBe(2);
    });
  });

  describe('protected methods', () => {
    describe('getKey', () => {
      it('should format key with prefix', () => {
        // Access protected method via any type
        const result = (sessionStore as any).getKey('session123');
        expect(result).toBe('test-sess:session123');
      });
    });

    describe('getTTL', () => {
      it('should return fixed TTL value if ttl is a number', () => {
        sessionStore.ttl = 3600;

        // Access protected method via any type
        const result = (sessionStore as any).getTTL(testSessionData);

        expect(result).toBe(3600);
      });

      it('should calculate TTL if ttl is a function', () => {
        sessionStore.ttl = (data: any) => (data.userId ? 7200 : 3600);

        // Access protected method via any type
        const result = (sessionStore as any).getTTL(testSessionData);

        expect(result).toBe(7200);
      });
    });
  });
});
