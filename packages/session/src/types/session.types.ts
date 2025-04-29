import { H3Event } from 'h3';

/**
 * Time-to-live for session data
 * Can be a fixed number of seconds or a function that calculates TTL based on session data
 */
export type TTL<T extends Record<string, unknown> = Record<string, unknown>> = number | ((data: T) => number);

/**
 * Options for UnstorageSessionStore
 */
export interface UnstorageSessionStoreOptions<T extends Record<string, unknown> = Record<string, unknown>> {
  /** Prefix for storage keys */
  prefix: string;
  /** Time-to-live for session data */
  ttl: TTL<T>;
}

/** Cookie options for the session cookie */
export type SessionCookieOptions = {
  /** Cookie domain */
  domain?: string;
  /** Cookie expiration date */
  expires?: Date;
  /** Whether the cookie is HTTP only (not accessible via JavaScript) */
  httpOnly?: boolean;
  /** Cookie max age in seconds */
  maxAge?: number;
  /** Cookie path */
  path?: string;
  /** SameSite cookie attribute */
  sameSite?: true | false | 'lax' | 'none' | 'strict';
  /** Whether the cookie requires HTTPS */
  secure?: boolean;
};

/** Extended cookie options with session ID setter */
export interface SessionCookie extends SessionCookieOptions {
  /** Sets the session ID cookie */
  setSessionId: (sid: string) => Promise<void>;
}

/**
 * Base type for session data
 */
export type SessionDataT = Record<string, unknown>;

/**
 * Raw session data as stored in the session store
 */
export type RawSession<T extends SessionDataT = SessionDataT> = T;

/**
 * Session store interface for storing and retrieving session data
 */
export interface SessionStore<T extends SessionDataT = SessionDataT> {
  /** Get all sessions (optional) */
  all?: () => Promise<RawSession<T>[]>;
  
  /** Destroy/delete a session by ID */
  destroy: (sid: string) => Promise<void>;
  
  /** Clear all sessions (optional) */
  clear?: () => Promise<void>;
  
  /** Get count of sessions (optional) */
  length?: () => Promise<number>;
  
  /** Get session data by ID */
  get: (sid: string) => Promise<RawSession<T> | undefined>;
  
  /** Set session data for an ID */
  set: (sid: string, data: RawSession<T>) => Promise<void>;
  
  /** Update session access time */
  touch: (sid: string, data: T) => Promise<void>;
}

/**
 * Options for configuring H3Session
 */
export interface H3SessionOptions<T extends SessionDataT = SessionDataT> {
  /** Session store implementation */
  store: SessionStore<T>;
  
  /** Cookie configuration options */
  cookie?: SessionCookieOptions;
  
  /** Session cookie name */
  name?: string;
  
  /** Function to generate session IDs */
  genid?: (event: H3Event) => string;
  
  /** Function to generate initial session data */
  generate?: () => T;
  
  /** Whether to save uninitialized (empty) sessions */
  saveUninitialized?: boolean;
  
  /** Secret(s) for signing cookies */
  secret: string | readonly string[];
}