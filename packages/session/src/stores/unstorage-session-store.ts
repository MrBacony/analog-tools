import { Storage } from 'unstorage';
import {
  RawSession,
  SessionDataT,
  SessionStore,
  TTL,
  UnstorageSessionStoreOptions,
} from '../types';

/**
 * Session store implementation using unstorage
 */
export class UnstorageSessionStore<T extends SessionDataT = SessionDataT>
  implements SessionStore<T>
{
  storage: Storage<RawSession<T>>;
  prefix: string;
  ttl: TTL<T>;

  /**
   * Create a new unstorage session store
   * @param storage The unstorage storage instance
   * @param options Configuration options
   */
  constructor(
    storage: Storage<RawSession<T>>,
    options: Partial<UnstorageSessionStoreOptions<T>>
  ) {
    this.storage = storage;
    this.prefix = options?.prefix ?? 'sess';
    this.ttl = options?.ttl ?? 60 * 60 * 24; // Default: 1 day
  }

  /**
   * Destroy the session with the specified session ID
   * @param sid The un-prefixed session ID
   */
  async destroy(sid: string): Promise<void> {
    await this.storage.removeItem(this.getKey(sid));
  }

  /**
   * Get the session with the specified session ID
   * @param sid The un-prefixed session ID
   */
  async get(sid: string): Promise<RawSession<T> | undefined> {
    try {
      const item = await this.storage.getItem(this.getKey(sid));
      if (item) {
        console.log(
          `[@analog-tools/session] Retrieved session ${sid}:`,
          JSON.stringify(item)
        );
      } else {
        console.log(`[@analog-tools/session] No session found for ID ${sid}`);
      }
      return item as RawSession<T> | undefined;
    } catch (error) {
      console.error(`[@analog-tools/session] Error getting session: ${error}`);
      return undefined;
    }
  }

  /**
   * Save the session with the specified session ID
   * If the session has expired (has a TTL <= 0) it is deleted.
   * @param sid The un-prefixed session ID
   * @param data The session data
   */
  async set(sid: string, data: RawSession<T>): Promise<void> {
    const ttl = this.getTTL(data as T);
    if (ttl > 0) {
      console.log(
        `[@analog-tools/session] Saving session ${sid} with TTL ${ttl}:`,
        JSON.stringify(data)
      );
      await this.storage.setItem(this.getKey(sid), data, { ttl });
      console.log(`[@analog-tools/session] Session ${sid} saved successfully`);
    } else {
      console.log(
        `[@analog-tools/session] Session ${sid} has expired TTL, destroying`
      );
      await this.destroy(sid);
    }
  }

  /**
   * Update a session's TTL
   * @param sid The un-prefixed session ID
   * @param data The session data
   */
  async touch(sid: string, data: T): Promise<void> {
    await this.set(sid, data as RawSession<T>);
  }

  /**
   * Remove all saved sessions
   */
  async clear(): Promise<void> {
    const keys = await this.getAllKeys();
    await Promise.all(keys.map((k) => this.storage.removeItem(k)));
  }

  /**
   * Fetch all saved sessions.
   */
  async all(): Promise<RawSession<T>[]> {
    const keys = await this.getAllKeys();
    const values = await this.storage.getItems(keys);
    return values.map(({ value }) => {
      return value as RawSession<T>;
    });
  }

  /**
   * Returns the number of saved sessions
   */
  async length(): Promise<number> {
    const keys = await this.getAllKeys();
    return keys.length;
  }

  /**
   * Get all keys for sessions
   * @protected
   */
  protected async getAllKeys(): Promise<string[]> {
    return await this.storage.getKeys(this.prefix);
  }

  /**
   * Get the storage key for a session ID
   * @param key The session ID
   * @protected
   */
  protected getKey(key: string): string {
    return [this.prefix, key].join(':');
  }

  /**
   * Get the TTL for the session, either from the TTL function if it exists
   * or falling back to the default TTL value.
   * @param session The session data
   * @protected
   */
  protected getTTL(session: T): number {
    if (typeof this.ttl === 'function') {
      return this.ttl(session);
    }
    return this.ttl;
  }
}
