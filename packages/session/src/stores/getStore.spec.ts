import { describe, expect, it, vi } from 'vitest';
import { getStore } from './getStore';
import { redisStore } from './redis/redis-session-store';
import { memoryStore } from './memory/memory-session-store';

// Mock dependencies
vi.mock('./redis/redis-session-store', () => {
  return {
    redisStore: vi.fn(() => ({ type: 'redis-store' })),
  };
});

vi.mock('./memory/memory-session-store', () => {
  return {
    memoryStore: vi.fn(() => ({ type: 'memory-store' })),
  };
});

describe('getStore', () => {
  it('should return redis store when type is redis', () => {
    const config = { prefix: 'test-prefix' };
    const store = getStore('redis', config);

    expect(redisStore).toHaveBeenCalledWith(config);
    expect(store).toEqual({ type: 'redis-store' });
  });

  it('should return memory store when type is memory', () => {
    const config = { prefix: 'test-prefix' };
    const store = getStore('memory', config);

    expect(memoryStore).toHaveBeenCalledWith(config);
    expect(store).toEqual({ type: 'memory-store' });
  });

  it('should throw error for cookie store', () => {
    const config = { prefix: 'test-prefix' };

    expect(() => getStore('cookie', config)).toThrow(
      'Cookie store is not implemented yet.'
    );
  });

  it('should throw error for unsupported store type', () => {
    const config = { prefix: 'test-prefix' };
    // @ts-expect-error - Testing invalid store type
    expect(() => getStore('invalid', config)).toThrow(
      'Unsupported session store type: invalid'
    );
  });
});
