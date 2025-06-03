import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RedisSessionStoreOptions, redisStore } from './redis-session-store';
import { createStorage } from 'unstorage';
import { UnstorageSessionStore } from '../unstorage-session-store';
import { SessionDataT } from '../../types';
import redisDriver from 'unstorage/drivers/redis';

// Mock dependencies
vi.mock('unstorage', () => ({
  createStorage: vi.fn().mockReturnValue({}),
}));

vi.mock('unstorage/drivers/redis', () => {
  return {
    default: vi.fn().mockReturnValue({
      /* Mock Redis driver */
    }),
  };
});

vi.mock('../unstorage-session-store', () => ({
  UnstorageSessionStore: vi.fn().mockImplementation(() => ({
    /* Mock UnstorageSessionStore instance */
    prefix: 'mock-sess',
    ttl: 3600,
  })),
}));

describe('RedisSessionStore', () => {
  let mockOptions: RedisSessionStoreOptions;

  beforeEach(() => {
    // Reset singleton state before each test
    vi.resetModules();

    // Default options for tests
    mockOptions = {
      prefix: 'redis-sess',
      ttl: 7200,
      host: 'test-redis-host',
      port: 6380,
      username: 'test-user',
      password: 'test-pass',
      db: 1,
      tls: { rejectUnauthorized: false },
    };
  });
  afterEach(() => {
    // Reset mocks
    vi.mocked(createStorage).mockClear();
    vi.mocked(UnstorageSessionStore).mockClear();
    vi.mocked(redisDriver).mockClear();
  });

  describe('redisStore', () => {
    beforeEach(() => {
      vi.mocked(createStorage).mockImplementation(() => ({} as any));

      vi.mocked(redisDriver).mockImplementation(() => {
        return {} as any;
      });
    });

    it('should create a new store instance with provided options', () => {
      const store = redisStore(mockOptions);

      // Verify Redis driver was configured correctly
      expect(createStorage).toHaveBeenCalledWith({
        driver: expect.any(Object),
      });

      // Verify UnstorageSessionStore was created with correct options
      expect(UnstorageSessionStore).toHaveBeenCalledWith(
        {},
        {
          prefix: 'redis-sess',
          ttl: 7200,
        }
      );

      expect(store).toBeDefined();
    });

    it('should use URL if provided', () => {
      const urlOptions: RedisSessionStoreOptions = {
        ...mockOptions,
        url: 'redis://redis-server:6379',
      };

      redisStore(urlOptions);

      // Verify Redis driver was configured with URL
      expect(redisDriver).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'redis://redis-server:6379',
        })
      );
    });

    it('should use default values for missing options', () => {
      // Minimal options
      const minimalOptions: RedisSessionStoreOptions = {
        prefix: 'minimal-sess',
        ttl: 1800,
      };

      redisStore(minimalOptions);

      // Verify Redis driver was created with default values
      expect(redisDriver).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 6379,
          username: undefined,
          password: undefined,
          db: 0,
          tls: undefined,
        })
      );

      // Verify UnstorageSessionStore was created with provided options
      expect(UnstorageSessionStore).toHaveBeenCalledWith(
        {},
        {
          prefix: 'minimal-sess',
          ttl: 1800,
        }
      );
    });

    it('should use default TTL if not provided', () => {
      // Cast to proper type for testing default TTL implementation
      const optionsWithoutTTL = {
        prefix: 'test-sess',
      } as RedisSessionStoreOptions;

      redisStore(optionsWithoutTTL);

      // Verify UnstorageSessionStore was created with default TTL
      expect(UnstorageSessionStore).toHaveBeenCalledWith(
        {},
        {
          prefix: 'test-sess',
          ttl: 60 * 60 * 24, // Default to 1 day
        }
      );
    });

    it('should use default prefix if not provided', () => {
      // Cast to proper type for testing default prefix implementation
      const optionsWithoutPrefix = {
        ttl: 3600,
      } as RedisSessionStoreOptions;

      redisStore(optionsWithoutPrefix);

      // Verify UnstorageSessionStore was created with default prefix
      expect(UnstorageSessionStore).toHaveBeenCalledWith(
        {},
        {
          prefix: 'sess', // Default prefix
          ttl: 3600,
        }
      );
    });
  });

  describe('RedisSessionStoreOptions interface', () => {
    it('should extend UnstorageSessionStoreOptions', () => {
      // This is more of a TypeScript check, but we can verify
      // the implementation respects the interface by testing with options
      const options: RedisSessionStoreOptions = {
        prefix: 'test',
        ttl: 3600,
        url: 'redis://example.com',
        host: 'localhost',
        port: 6379,
        username: 'user',
        password: 'pass',
        db: 0,
        tls: { rejectUnauthorized: false },
      };

      redisStore(options);

      // Verify options were passed to Redis driver
      expect(redisDriver).toHaveBeenCalledWith(
        expect.objectContaining({
          url: options.url,
          host: options.host,
          port: options.port,
          username: options.username,
          password: options.password,
          db: options.db,
          tls: options.tls,
        })
      );

      // Verify base options were passed to UnstorageSessionStore
      expect(UnstorageSessionStore).toHaveBeenCalledWith(undefined, {
        prefix: options.prefix,
        ttl: options.ttl,
      });
    });
  });

  describe('Type compatibility', () => {
    it('should support generic session data type', () => {
      // Define a custom session data type
      interface CustomSessionData extends SessionDataT {
        customField: string;
        visits: number;
      }

      // Creating store with custom session data type
      // This is primarily a TypeScript compilation check
      const options: RedisSessionStoreOptions<CustomSessionData> = {
        prefix: 'custom',
        // @ts-expect-error wrong type but for testing ok
        ttl: (data) => (data.visits > 10 ? 7200 : 3600),
      };

      const store = redisStore(options);

      // Verify store was created
      expect(store).toBeDefined();
    });

    it('should support TTL functions', () => {
      // Using TTL function
      const ttlFn = (data: SessionDataT) => {
        return data.userId ? 7200 : 3600;
      };

      const options: RedisSessionStoreOptions = {
        prefix: 'ttl-test',
        // @ts-expect-error wrong type but for testing ok
        ttl: ttlFn,
      };

      redisStore(options);

      // Verify TTL function was passed to UnstorageSessionStore
      expect(UnstorageSessionStore).toHaveBeenCalledWith(undefined, {
        prefix: 'ttl-test',
        ttl: ttlFn,
      });
    });
  });
});
