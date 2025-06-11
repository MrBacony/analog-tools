import { inject } from '@analog-tools/inject';
import { LoggerService } from '@analog-tools/logger';
import { SessionCookie, SessionDataT, SessionStore } from '../types';

// Get a logger instance for the session module
const getLogger = () => {
  try {
    return inject(LoggerService).forContext('@analog-tools/session');
  } catch (error) {
    // Fallback if logger service is not available
    return {
      debug: (...args: unknown[]) => console.debug('[Session]', ...args),
      info: (...args: unknown[]) => console.info('[Session]', ...args),
      warn: (...args: unknown[]) => console.warn('[Session]', ...args),
      error: (...args: unknown[]) => console.error('[Session]', ...args),
    };
  }
};

/**
 * Session metadata interface to represent internal session state
 */
export interface SessionState<T extends SessionDataT = SessionDataT> {
  /** The unique session identifier */
  id: string;
  /** Immutable session data */
  data: Readonly<T>;
  /** Session store implementation */
  store: SessionStore<T>;
  /** Session cookie configuration and setter */
  cookie: SessionCookie;
  /** Function to generate a new session */
  generator: () => Promise<{ data: T; id: string }>;
}

/**
 * Get the immutable session data
 * @param state The session state
 * @returns A readonly copy of the session data
 */
export function getSessionData<T extends SessionDataT = SessionDataT>(
  state: SessionState<T>
): Readonly<T> {
  return state.data;
}

/**
 * Update session data immutably
 * @param state The session state
 * @param updater Function that returns the updated data or partial data to merge
 * @returns The updated session state
 */
export function updateSessionData<T extends SessionDataT = SessionDataT>(
  state: SessionState<T>,
  updater: (data: Readonly<T>) => T | Partial<T>
): SessionState<T> {
  const logger = getLogger();
  const updatedData = updater(state.data);

  logger.debug(`Updating session ${state.id} data`, {
    sessionId: state.id,
  });

  return {
    ...state,
    data: Object.freeze({
      ...state.data,
      ...(updatedData as T),
    }),
  };
}

/**
 * Replace the entire session data immutably
 * @param state The session state
 * @param newData New session data
 * @returns The updated session state
 */
export function setSessionData<T extends SessionDataT = SessionDataT>(
  state: SessionState<T>,
  newData: T
): SessionState<T> {
  const logger = getLogger();

  logger.debug(`Setting new data for session ${state.id}`, {
    sessionId: state.id,
  });

  return {
    ...state,
    data: Object.freeze({ ...newData }),
  };
}

/**
 * Save the current session data to the store
 * @param state The session state
 */
export async function saveSession<T extends SessionDataT = SessionDataT>(
  state: SessionState<T>
): Promise<void> {
  const logger = getLogger();
  try {
    logger.debug(`Saving session ${state.id} with data`);
    await state.store.set(state.id, { ...state.data });
    logger.debug(`Session ${state.id} saved successfully`, {
      sessionId: state.id,
    });
  } catch (error) {
    logger.error(`Error saving session ${state.id}`, error, {
      sessionId: state.id,
    });
    throw error;
  }
}

/**
 * Reload the session data from the store
 * @param state The session state
 * @returns The updated session state
 */
export async function reloadSession<T extends SessionDataT = SessionDataT>(
  state: SessionState<T>
): Promise<SessionState<T>> {
  const logger = getLogger();
  logger.debug(`Reloading session ${state.id}`, { sessionId: state.id });

  const freshData =
    (await state.store.get(state.id)) ?? (await state.generator()).data;

  logger.debug(`Session ${state.id} reloaded`, {
    sessionId: state.id,
    hasData: !!freshData,
  });

  return {
    ...state,
    data: Object.freeze({ ...freshData }),
  };
}

/**
 * Destroy the current session
 * @param state The session state
 */
export async function destroySession<T extends SessionDataT = SessionDataT>(
  state: SessionState<T>
): Promise<void> {
  const logger = getLogger();
  state.cookie.maxAge = 0;
  logger.debug(`Destroying session ${state.id}`, { sessionId: state.id });
  await state.store.destroy(state.id);
}

/**
 * Regenerate the session with a new ID
 * @param state The session state
 * @returns The updated session state
 */
export async function regenerateSession<T extends SessionDataT = SessionDataT>(
  state: SessionState<T>
): Promise<SessionState<T>> {
  const logger = getLogger();
  logger.debug(`Regenerating session ${state.id}`, { sessionId: state.id });

  await state.store.destroy(state.id);
  const { data, id } = await state.generator();
  const newState = {
    ...state,
    data: Object.freeze({ ...data }),
    id,
  };

  logger.debug(`Created new session ${id} to replace ${state.id}`, {
    oldSessionId: state.id,
    newSessionId: id,
  });

  await Promise.all([state.cookie.setSessionId(id), saveSession(newState)]);
  return newState;
}

/**
 * Create a new session state object
 * @param id Session ID
 * @param data Session data
 * @param store Session store
 * @param generator Function to generate a new session
 * @param cookie Session cookie
 * @returns A new session state object
 */
export function createSessionState<T extends SessionDataT = SessionDataT>(
  id: string,
  data: T,
  store: SessionStore<T>,
  generator: () => Promise<{ data: T; id: string }>,
  cookie: SessionCookie
): SessionState<T> {
  const logger = getLogger();
  logger.debug(`Creating new session state with ID ${id}`, { sessionId: id });

  return {
    id,
    data: Object.freeze({ ...data }),
    store,
    generator,
    cookie,
  };
}
