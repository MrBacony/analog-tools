import { redisStore } from './redis/redis-session-store';

export function getStore<T>(
  type: 'redis' | 'memory' | 'cookie',
  config: any
): any {
  switch (type) {
    case 'redis':
      return redisStore(config);
    case 'memory':
      //return memoryStore(config);
      throw new Error('Memory store is not implemented yet.');
    case 'cookie':
      //return cookieStore(config);
      throw new Error('Cookie store is not implemented yet.');
    default:
      throw new Error(`Unsupported session store type: ${type}`);
  }
}
