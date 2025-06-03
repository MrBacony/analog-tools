import { redisStore } from './redis/redis-session-store';
import { memoryStore } from './memory/memory-session-store';
import { SessionDataT } from '../types';
import { UnstorageSessionStore } from './unstorage-session-store';

/**
 * Factory function to get a session store based on type
 * @param type The type of store to create ('redis', 'memory', or 'cookie')
 * @param config Configuration options for the store
 * @returns A configured session store instance
 */
export function getStore<T extends SessionDataT = SessionDataT>(
  type: 'redis' | 'memory' | 'cookie',
  config: any
): UnstorageSessionStore<T> {
  switch (type) {
    case 'redis':
      return redisStore(config);
    case 'memory':
      return memoryStore(config);
    case 'cookie':
      //return cookieStore(config);
      throw new Error('Cookie store is not implemented yet.');
    default:
      throw new Error(`Unsupported session store type: ${type}`);
  }
}
