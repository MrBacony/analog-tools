import { redisStore } from './redis/redis-session-store';
import { memoryStore } from './memory/memory-session-store';

/**
 * Factory function to get a session store based on type
 * @param type The type of store to create ('redis', 'memory', or 'cookie')
 * @param config Configuration options for the store
 * @returns A configured session store instance
 */
export function registerStorage(
  type: 'redis' | 'memory' | 'cookie',
  config: any
) {
  switch (type) {
    case 'redis':
      redisStore(config);
      break;
    case 'memory':
      memoryStore(config);
      break;
    case 'cookie':
      //return cookieStore(config);
      throw new Error('Cookie store is not implemented yet.');
    default:
      throw new Error(`Unsupported session store type: ${type}`);
  }
}
