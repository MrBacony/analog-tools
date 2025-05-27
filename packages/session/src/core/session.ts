import { inject } from '@analog-tools/inject';
import { SessionCookie, SessionDataT, SessionStore } from '../types';
import { LoggerService } from '@analog-tools/logger';

/**
 * Core Session class that manages session data and operations
 */
export class Session {
  #id: string;
  #store: SessionStore;
  #data: Readonly<SessionDataT>;
  #generate: () => Promise<{ data: SessionDataT; id: string }>;
  #cookie: SessionCookie;
  #logger = inject(LoggerService).forContext('@analog-tools/session');

  constructor(
    id: string,
    data: SessionDataT,
    store: SessionStore,
    generate: () => Promise<{ data: SessionDataT; id: string }>,
    cookie: SessionCookie
  ) {
    this.#data = Object.freeze({ ...data });
    this.#id = id;
    this.#store = store;
    this.#generate = generate;
    this.#cookie = cookie;
  }

  get id() {
    return this.#id;
  }

  get cookie(): SessionCookie {
    return this.#cookie;
  }

  set cookie(value: SessionCookie) {
    this.#cookie = value;
  }

  /**
   * Get the immutable session data
   * @returns A readonly copy of the session data
   */
  get data(): Readonly<SessionDataT> {
    return this.#data;
  }

  /**
   * Update session data immutably
   * @param updater Function that returns the updated data or partial data to merge
   * @returns The updated session instance (for method chaining)
   */
  update(
    updater: (
      data: Readonly<SessionDataT>
    ) => SessionDataT | Partial<SessionDataT>
  ): Session {
    const updatedData = updater(this.#data);
    this.#data = Object.freeze({
      ...this.#data,
      ...(updatedData as SessionDataT),
    });
    return this;
  }

  /**
   * Replace the entire session data immutably
   * @param newData New session data
   * @returns The updated session instance (for method chaining)
   */
  set(newData: SessionDataT): Session {
    this.#data = Object.freeze({ ...newData });
    return this;
  }

  /**
   * Save the current session data to the store
   */
  async save() {
    await this.#store.set(this.#id, { ...this.#data });
  }

  /**
   * Reload the session data from the store
   */
  async reload() {
    const freshData =
      (await this.#store.get(this.#id)) ?? (await this.#generate()).data;
    this.#data = Object.freeze({ ...freshData });
  }

  /**
   * Destroy the current session
   */
  async destroy() {
    this.#cookie.maxAge = 0;
    this.#logger.info(`Destroying session ${this.#id}`);
    await this.#store.destroy(this.#id);
  }

  /**
   * Regenerate the session with a new ID
   */
  async regenerate() {
    await this.#store.destroy(this.#id);
    const { data, id } = await this.#generate();
    this.#data = Object.freeze({ ...data });
    this.#id = id;
    await Promise.all([this.#cookie.setSessionId(id), this.save()]);
  }
}
