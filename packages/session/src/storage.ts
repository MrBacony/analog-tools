/**
 * Storage factory functions for session package
 * Simplified storage creation without wrapper abstractions
 */

import { createStorage } from 'unstorage';
import memoryDriver from 'unstorage/drivers/memory';
import redisDriver from 'unstorage/drivers/redis';
import type { Storage } from 'unstorage';
import type { SessionData } from './types';

/**
 * Create a memory storage instance for sessions
 * @param options Optional configuration for memory storage
 * @returns Storage instance for session data
 */
export function createMemoryStore<T extends SessionData = SessionData>(): Storage<T> {
  return createStorage({
    driver: memoryDriver(),
  });
}

/**
 * Create a Redis storage instance for sessions
 * @param options Redis connection and configuration options
 * @returns Storage instance for session data
 */
export function createRedisStore<T extends SessionData = SessionData>(
  options: {
    /** Redis connection URL or configuration */
    url?: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    db?: number;
    /** Optional prefix for keys */
    prefix?: string;
    /** Optional TTL in seconds */
    ttl?: number;
  }
): Storage<T> {
  return createStorage({
    driver: redisDriver({
      url: options.url,
      host: options.host,
      port: options.port,
      username: options.username,
      password: options.password,
      db: options.db,
      ttl: options.ttl,
    }),
  });
}
