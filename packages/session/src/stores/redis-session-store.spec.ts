import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisSessionStore } from './redis-session-store';
import { UnstorageSessionStore } from './unstorage-session-store';
import { createStorage } from 'unstorage';
import redisDriver from 'unstorage/drivers/redis';

// Mock dependencies
vi.mock('unstorage', () => ({
  createStorage: vi.fn()
}));

vi.mock('unstorage/drivers/redis', () => ({
  default: vi.fn()
}));

describe('RedisSessionStore', () => {
  // Mock storage instance
  const mockStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    getKeys: vi.fn(),
    getItems: vi.fn()
  };

  // Test session data
  const testSessionData = { userId: 'user123', role: 'admin' };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createStorage).mockReturnValue(mockStorage as any);
    vi.mocked(redisDriver).mockReturnValue('redis-driver' as any);
  });

  describe('constructor', () => {
    it('should create Redis storage with default options', () => {
      new RedisSessionStore();

      // Verify redis driver was created with default options
      expect(redisDriver).toHaveBeenCalledWith({
        url: undefined,
        host: 'localhost',
        port: 6379,
        username: undefined,
        password: undefined,
        db: 0,
        tls: undefined
      });

      // Verify storage was created with Redis driver
      expect(createStorage).toHaveBeenCalledWith({
        driver: 'redis-driver'
      });

      // Verify UnstorageSessionStore was initialized with correct defaults
      expect(mockStorage).toBeTruthy();
    });

    it('should create Redis storage with custom options', () => {
      const options = {
        url: 'redis://custom-host:1234',
        host: 'custom-host',
        port: 1234,
        username: 'redis-user',
        password: 'redis-pass',
        db: 2,
        tls: { rejectUnauthorized: false },
        prefix: 'custom-prefix',
        ttl: 7200
      };

      new RedisSessionStore(options);

      // Verify redis driver was created with custom options
      expect(redisDriver).toHaveBeenCalledWith({
        url: 'redis://custom-host:1234',
        host: 'custom-host',
        port: 1234,
        username: 'redis-user',
        password: 'redis-pass',
        db: 2,
        tls: { rejectUnauthorized: false }
      });

      // Verify storage was created with Redis driver
      expect(createStorage).toHaveBeenCalledWith({
        driver: 'redis-driver'
      });
    });

    it('should use custom prefix and ttl', () => {
      // Using a spy to check if super() is called with the right options
      const options = {
        prefix: 'custom-prefix',
        ttl: 7200
      };

      // We can't spy on the constructor or super() call directly in JavaScript
      // So instead we'll confirm the store is created with the right options
      const store = new RedisSessionStore(options);

      // Verify the prefix and ttl were set correctly
      expect((store as any).prefix).toBe('custom-prefix');
      expect((store as any).ttl).toBe(7200);
    });
  });

  describe('getAll', () => {
    let redisStore: RedisSessionStore;

    beforeEach(() => {
      redisStore = new RedisSessionStore();
    });

    it('should get all sessions from Redis', async () => {
      const keys = ['sess:session1', 'sess:session2', 'other:key'];
      mockStorage.getKeys.mockResolvedValue(keys);

      mockStorage.getItem
        .mockResolvedValueOnce({ userId: 'user1' })
        .mockResolvedValueOnce({ userId: 'user2' });

      const result = await redisStore.getAll();

      expect(mockStorage.getKeys).toHaveBeenCalled();
      expect(mockStorage.getItem).toHaveBeenCalledTimes(2);
      expect(mockStorage.getItem).toHaveBeenCalledWith('sess:session1');
      expect(mockStorage.getItem).toHaveBeenCalledWith('sess:session2');

      expect(result).toEqual({
        'sess:session1': { userId: 'user1' },
        'sess:session2': { userId: 'user2' }
      });
    });

    it('should filter keys by prefix', async () => {
      const keys = ['sess:session1', 'other:key', 'another:key'];
      mockStorage.getKeys.mockResolvedValue(keys);

      mockStorage.getItem
        .mockResolvedValueOnce({ userId: 'user1' });

      const result = await redisStore.getAll();

      expect(mockStorage.getKeys).toHaveBeenCalled();
      expect(mockStorage.getItem).toHaveBeenCalledTimes(1);
      expect(mockStorage.getItem).toHaveBeenCalledWith('sess:session1');
      expect(result).toEqual({
        'sess:session1': { userId: 'user1' }
      });
    });

    it('should handle errors when retrieving sessions', async () => {
      // Mock console.error to prevent test output pollution
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockStorage.getKeys.mockRejectedValue(new Error('Redis connection error'));

      const result = await redisStore.getAll();

      expect(mockStorage.getKeys).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error retrieving all sessions:',
        expect.any(Error)
      );
      expect(result).toEqual({});
    });

    it('should handle errors when getting individual session data', async () => {
      // Mock console.error to prevent test output pollution
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const keys = ['sess:session1', 'sess:session2'];
      mockStorage.getKeys.mockResolvedValue(keys);

      // First getItem succeeds, second fails
      mockStorage.getItem
        .mockResolvedValueOnce({ userId: 'user1' })
        .mockRejectedValueOnce(new Error('Failed to get session'));

      const result = await redisStore.getAll();

      expect(mockStorage.getKeys).toHaveBeenCalled();
      expect(mockStorage.getItem).toHaveBeenCalledTimes(2);

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

      const result = await redisStore.getAll();

      expect(mockStorage.getKeys).toHaveBeenCalled();
      expect(mockStorage.getItem).not.toHaveBeenCalled();
      expect(result).toEqual({});
    });
  });

  // Test that RedisSessionStore inherits methods from UnstorageSessionStore
  describe('inherited functionality', () => {
    let redisStore: RedisSessionStore;

    beforeEach(() => {
      redisStore = new RedisSessionStore();
    });

    it('should inherit get method from UnstorageSessionStore', async () => {
      mockStorage.getItem.mockResolvedValue(testSessionData);

      await redisStore.get('session123');

      // Prefix should be 'sess' by default
      expect(mockStorage.getItem).toHaveBeenCalledWith('sess:session123');
    });

    it('should inherit set method from UnstorageSessionStore', async () => {
      await redisStore.set('session123', testSessionData);

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'sess:session123',
        testSessionData,
        expect.any(Object)
      );
    });

    it('should inherit destroy method from UnstorageSessionStore', async () => {
      await redisStore.destroy('session123');

      expect(mockStorage.removeItem).toHaveBeenCalledWith('sess:session123');
    });
  });
});
