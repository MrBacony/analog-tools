import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RedisSessionStore } from './redis-session-store';
import { createStorage } from 'unstorage';
import redisDriver from 'unstorage/drivers/redis';
import { LoggerService } from '@analog-tools/logger';
import { inject } from '@analog-tools/inject';

// Mock dependencies
vi.mock('unstorage', () => ({
  createStorage: vi.fn(),
}));

vi.mock('unstorage/drivers/redis', () => ({
  default: vi.fn(),
}));

describe('RedisSessionStore', () => {
  // Mock storage instance
  const mockStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    getKeys: vi.fn(),
    getItems: vi.fn(),
  };

  const logger = inject(LoggerService).forContext('@analog-tools/session');

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
        tls: undefined,
      });

      // Verify storage was created with Redis driver
      expect(createStorage).toHaveBeenCalledWith({
        driver: 'redis-driver',
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
        ttl: 7200,
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
        tls: { rejectUnauthorized: false },
      });

      // Verify storage was created with Redis driver
      expect(createStorage).toHaveBeenCalledWith({
        driver: 'redis-driver',
      });
    });

    it('should use custom prefix and ttl', () => {
      // Using a spy to check if super() is called with the right options
      const options = {
        prefix: 'custom-prefix',
        ttl: 7200,
      };

      // We can't spy on the constructor or super() call directly in JavaScript
      // So instead we'll confirm the store is created with the right options
      const store = new RedisSessionStore(options);

      // Verify the prefix and ttl were set correctly
      expect((store as any).prefix).toBe('custom-prefix');
      expect((store as any).ttl).toBe(7200);
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
