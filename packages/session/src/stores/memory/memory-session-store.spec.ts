import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemorySessionStoreOptions, memoryStore } from './memory-session-store';
import { createStorage } from 'unstorage';
import { UnstorageSessionStore } from '../unstorage-session-store';
import { SessionDataT } from '../../types';
import memoryDriver from 'unstorage/drivers/memory';

// Mock dependencies
vi.mock('unstorage', () => ({
  createStorage: vi.fn().mockReturnValue({}),
}));

vi.mock('unstorage/drivers/memory', () => {
  return {
    default: vi.fn().mockReturnValue({
      /* Mock Memory driver */
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

describe('MemorySessionStore', () => {
  let mockOptions: MemorySessionStoreOptions;

  beforeEach(() => {
    // Reset singleton state before each test
    vi.resetModules();

    // Default options for tests
    mockOptions = {
      prefix: 'memory-sess',
      ttl: 3600,
    };
  });
  
  afterEach(() => {
    // Reset mocks
    vi.mocked(createStorage).mockClear();
    vi.mocked(UnstorageSessionStore).mockClear();
    vi.mocked(memoryDriver).mockClear();
  });

  describe('memoryStore', () => {
    beforeEach(() => {
      vi.mocked(createStorage).mockImplementation(() => ({} as any));

      vi.mocked(memoryDriver).mockImplementation(() => {
        return {} as any;
      });
    });

    it('should create a new store instance with provided options', () => {
      const store = memoryStore(mockOptions);

      // Verify Memory driver was configured correctly
      expect(createStorage).toHaveBeenCalledWith({
        driver: expect.any(Object),
      });

      // Verify UnstorageSessionStore was created with correct options
      expect(UnstorageSessionStore).toHaveBeenCalledWith(
        {},
        {
          prefix: 'memory-sess',
          ttl: 3600,
        }
      );

      expect(store).toBeDefined();
    });

    it('should use default values for missing options', () => {
      // No options provided
      const store = memoryStore();

      // Verify Memory driver was configured correctly
      expect(createStorage).toHaveBeenCalledWith({
        driver: expect.any(Object),
      });

      // Verify UnstorageSessionStore was created with default values
      expect(UnstorageSessionStore).toHaveBeenCalledWith(
        {},
        {
          prefix: 'sess',
          ttl: 60 * 60, // Default to 1 hour
        }
      );

      expect(store).toBeDefined();
    });

    it('should use default prefix if not provided', () => {
      // Only TTL provided
      const optionsWithoutPrefix: MemorySessionStoreOptions = {
        ttl: 7200,
      };

      memoryStore(optionsWithoutPrefix);

      // Verify UnstorageSessionStore was created with default prefix
      expect(UnstorageSessionStore).toHaveBeenCalledWith(
        {},
        {
          prefix: 'sess', // Default prefix
          ttl: 7200,
        }
      );
    });

    it('should use default TTL if not provided', () => {
      // Only prefix provided
      const optionsWithoutTTL: MemorySessionStoreOptions = {
        prefix: 'test-sess',
      };

      memoryStore(optionsWithoutTTL);

      // Verify UnstorageSessionStore was created with default TTL
      expect(UnstorageSessionStore).toHaveBeenCalledWith(
        {},
        {
          prefix: 'test-sess',
          ttl: 60 * 60, // Default to 1 hour
        }
      );
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
      const options: MemorySessionStoreOptions<CustomSessionData> = {
        prefix: 'custom',
        ttl: (data) => (data.visits > 10 ? 7200 : 3600),
      };

      const store = memoryStore(options);

      // Verify store was created
      expect(store).toBeDefined();
    });

    it('should support TTL functions', () => {
      // Using TTL function
      const ttlFn = (data: SessionDataT) => {
        return data.userId ? 7200 : 3600;
      };

      const options: MemorySessionStoreOptions = {
        prefix: 'ttl-test',
        ttl: ttlFn,
      };

      // Reset mock to ensure it returns the expected value
      vi.mocked(createStorage).mockReturnValue({} as any);
      
      memoryStore(options);

      // Verify TTL function was passed to UnstorageSessionStore
      expect(UnstorageSessionStore).toHaveBeenCalledWith(
        {},
        {
          prefix: 'ttl-test',
          ttl: ttlFn,
        }
      );
    });
  });
});
