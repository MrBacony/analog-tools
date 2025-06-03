import { createStorage } from 'unstorage';
import memoryDriver from 'unstorage/drivers/memory';
import { SessionDataT, UnstorageSessionStoreOptions } from '../../types';
import { UnstorageSessionStore } from '../unstorage-session-store';

/**
 * Creates a new memory-backed session store
 * @param config Configuration options for the memory store
 * @returns A new memory session store instance
 */
export function memoryStore<T extends SessionDataT = SessionDataT>(
  config: MemorySessionStoreOptions<T> = {}
) {
  const storage = createStorage<T>({
    driver: memoryDriver(),
  });

  return new UnstorageSessionStore<T>(storage, {
    prefix: config.prefix || 'sess',
    ttl: config.ttl || 60 * 60, // Default: 1 hour
  });
}

/**
 * Options for Memory session store
 */
export type MemorySessionStoreOptions<T extends SessionDataT = SessionDataT> = Partial<
  UnstorageSessionStoreOptions<T>
>;

/**
 * Memory session store implementation using unstorage/memory driver
 */
export type MemorySessionStore<T extends SessionDataT = SessionDataT> =
  UnstorageSessionStore<T>;
