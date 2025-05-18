import { createStorage } from 'unstorage';
import redisDriver from 'unstorage/drivers/redis';
import { SessionDataT, UnstorageSessionStoreOptions } from '../types';
import { UnstorageSessionStore } from './unstorage-session-store';


/**
 * Options for Redis session store
 */
export interface RedisSessionStoreOptions<T extends SessionDataT = SessionDataT> extends UnstorageSessionStoreOptions<T> {
  /** Redis connection URL */
  url?: string;
  /** Redis host */
  host?: string;
  /** Redis port */
  port?: number;
  /** Redis username */
  username?: string;
  /** Redis password */
  password?: string;
  /** Redis database number */
  db?: number;
  /** TLS configuration */
  tls?: Record<string, unknown>;
}

/**
 * Redis session store implementation using unstorage/redis driver
 */
export class RedisSessionStore<T extends SessionDataT = SessionDataT> extends UnstorageSessionStore<T> {

  /**
   * Create a new Redis session store
   * @param options Redis and session store configuration options
   */
  constructor(options: Partial<RedisSessionStoreOptions<T>> = {}) {
    // Create Redis storage with provided options
    const storage = createStorage<T>({
      driver: redisDriver({
        url: options.url,
        host: options.host || 'localhost',
        port: options.port || 6379,
        username: options.username,
        password: options.password,
        db: options.db || 0,
        tls: options.tls || undefined,
      }),
    });

    // Initialize the UnstorageSessionStore with Redis storage
    super(storage, {
      prefix: options.prefix || 'sess',
      ttl: options.ttl || 60 * 60 * 24, // Default to 1 day
    });
  }

  /**
   * Get all sessions
   * @returns A promise that resolves to an object containing all sessions
   */
  async getAll(): Promise<Record<string, T>> {
    try {
      // Get all keys with the configured prefix
      const keys = await this.storage.getKeys();

      // Filter keys that match our session prefix
      const sessionKeys = keys.filter((key) => key.startsWith(this.prefix));

      // Get all session data in parallel
      const sessionEntries = await Promise.all(
        sessionKeys.map(async (key) => {
          const data = await this.storage.getItem(key);
          return [key, data];
        }),
      );

      // Convert to object
      return Object.fromEntries(sessionEntries);
    } catch (error) {
      this.logger.error('Error retrieving all sessions:', error);
      return {};
    }
  }
}
