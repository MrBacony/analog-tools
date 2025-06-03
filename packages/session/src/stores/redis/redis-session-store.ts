import { createStorage } from 'unstorage';
import redisDriver, { RedisOptions } from 'unstorage/drivers/redis';
import { SessionDataT, UnstorageSessionStoreOptions } from '../../types';
import { UnstorageSessionStore } from '../unstorage-session-store';

export function redisStore<T extends SessionDataT = SessionDataT>(
  config: RedisSessionStoreOptions<T>
) {
  const storage = createStorage<T>({
    driver: redisDriver({
      url: config.url,
      host: config.host || 'localhost',
      port: config.port || 6379,
      username: config.username,
      password: config.password,
      db: config.db || 0,
      tls: config.tls || undefined,
    }),
  });
  return new UnstorageSessionStore(storage, {
    prefix: config.prefix || 'sess',
    ttl: config.ttl || 60 * 60 * 24, // Default to 1 day
  });
}

/**
 * Options for Redis session store
 */
export type RedisSessionStoreOptions<T extends SessionDataT = SessionDataT> =
  UnstorageSessionStoreOptions<T> & RedisOptions;

/**
 * Redis session store implementation using unstorage/redis driver
 */
export type RedisSessionStore<T extends SessionDataT = SessionDataT> =
  UnstorageSessionStore<T>;
