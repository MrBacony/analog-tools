import { getCookie, H3Event, setCookie } from 'h3';
import { defu } from 'defu';
import { randomUUID } from 'uncrypto';
import { H3SessionOptions, SessionDataT, SessionCookie } from '../types';
import { signCookie, unsignCookie } from '../utils/crypto-utils';
import { 
  SessionState, 
  createSessionState,
  getSessionData,
  updateSessionData,
  setSessionData,
  saveSession,
  reloadSession,
  destroySession,
  regenerateSession
} from './session-functions';

/**
 * Validate the configuration object
 * @param config The session configuration to validate
 * @throws Error if required configuration is missing
 */
export function validateConfig<T extends SessionDataT = SessionDataT>(config: H3SessionOptions<T>): void {
  if (!config.store) {
    throw new Error('[h3-session] Session store is required!');
  }
  if (!config.secret) {
    throw new Error('[h3-session] Session secret is required!');
  }
}

/**
 * Attach a session to an H3Event
 * @param event
 * @param config
 */
export async function useSession<T extends SessionDataT = SessionDataT>(
  event: H3Event, 
  config: H3SessionOptions<T>
): Promise<void> {
  if (event.context['session']) {
    return;
  }
  validateConfig<T>(config);

  const sessionConfig = defu(config, {
    name: 'connect.sid',
    genid: () => randomUUID(),
    generate: () => ({} as T),
    cookie: { path: '/', httpOnly: true, secure: true, maxAge: null },
    saveUninitialized: false,
  });
  const { store } = sessionConfig;
  const generator = async () => {
    return await Promise.resolve({
      id: sessionConfig.genid(event),
      data: sessionConfig.generate() as T,
    });
  };
  const normalizedSecrets = Array.isArray(sessionConfig.secret) ? sessionConfig.secret : [sessionConfig.secret];
  const createSessionCookie = async (sid: string) => {
    let signedCookie: string;
    const cookie = {
      ...sessionConfig.cookie,
      // Default to a max age of one day
      maxAge: sessionConfig.cookie.maxAge || 60 * 60 * 24,
      setSessionId: async (sid2: string) => {
        signedCookie = await signCookie(sid2, normalizedSecrets[normalizedSecrets.length - 1]);
        setCookie(event, sessionConfig.name, signedCookie, cookie);
      },
    };
    await cookie.setSessionId(sid);
    return new Proxy(cookie, {
      set<K extends keyof typeof cookie>(target: typeof cookie, property: K, value: typeof cookie[K]) {
        target[property] = value;
        setCookie(event, sessionConfig.name, signedCookie, cookie);
        return true;
      },
    });
  };
  const rawCookie = getCookie(event, sessionConfig.name);
  const unsignResult = rawCookie ? await unsignCookie(rawCookie, normalizedSecrets) : null;
  let sessionData: T | undefined;
  let sessionId = null;
  if (unsignResult?.success) {
    sessionId = unsignResult.value; 
    sessionData = await store.get(unsignResult.value) as T | undefined;
  }
  async function createNewSession(): Promise<void> {
    const { id, data } = await generator();
    const cookie = await createSessionCookie(id);
    const sessionState = createSessionState<T>(id, data, store, generator, cookie);
    event.context['session'] = sessionState;
    
    // Create the session handler API that mimics the original Session class interface
    attachSessionHandlerToEvent<T>(event, sessionState);
    
    if (sessionConfig.saveUninitialized) {
      await event.context['sessionHandler'].save();
    }
    event.context['sessionId'] = id;
  }
  async function createExistingSession(id: string, data?: T): Promise<void> {
    const cookie = await createSessionCookie(id);
    if (store.touch && data) {
      await store.touch(id, data);
    }
    const sessionState = createSessionState<T>(id, data ?? sessionConfig.generate() as T, store, generator, cookie);
    event.context['session'] = sessionState;
    event.context['sessionId'] = id;
    
    // Create the session handler API that mimics the original Session class interface
    attachSessionHandlerToEvent<T>(event, sessionState);
  }
  if (!sessionId) {
    await createNewSession();
  } else if (!sessionData) {
    await createExistingSession(sessionId);
  } else {
    await createExistingSession(sessionId, sessionData);
  }
  event.context['sessionStore'] = store;
}

/**
 * Type definition for the session handler API that mimics the original Session class
 */
export interface SessionHandler<T extends SessionDataT = SessionDataT> {
  readonly id: string;
  cookie: SessionCookie;
  readonly data: Readonly<T>;
  update(updater: (data: Readonly<T>) => T | Partial<T>): SessionHandler<T>;
  set(newData: T): SessionHandler<T>;
  save(): Promise<void>;
  reload(): Promise<void>;
  destroy(): Promise<void>;
  regenerate(): Promise<void>;
}

/**
 * Attaches a session handler to the event context that provides the same API
 * as the original Session class for backward compatibility
 */
function attachSessionHandlerToEvent<T extends SessionDataT = SessionDataT>(
  event: H3Event, 
  sessionState: SessionState<T>
): void {
  // Create a strongly-typed session handler with the same API as the original Session class
  const sessionHandler: SessionHandler<T> = {
    get id() {
      return sessionState.id;
    },
    
    get cookie() {
      return sessionState.cookie;
    },
    
    set cookie(value) {
      sessionState.cookie = value;
    },
    
    get data() {
      return getSessionData(sessionState);
    },
    
    update(updater) {
      event.context['session'] = sessionState = updateSessionData<T>(sessionState, updater);
      return sessionHandler;
    },
    
    set(newData) {
      event.context['session'] = sessionState = setSessionData<T>(sessionState, newData);
      return sessionHandler;
    },
    
    async save() {
      await saveSession(sessionState);
    },
    
    async reload() {
      event.context['session'] = sessionState = await reloadSession<T>(sessionState);
    },
    
    async destroy() {
      await destroySession(sessionState);
    },
    
    async regenerate() {
      event.context['session'] = sessionState = await regenerateSession<T>(sessionState);
    }
  };
  
  event.context['sessionHandler'] = sessionHandler;
}