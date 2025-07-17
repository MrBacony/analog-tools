import type { Storage } from 'unstorage';

/**
 * Base session data interface - simple record type
 * Replaces complex SessionDataT generics from old implementation
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface
export interface SessionData extends Record<string, unknown> {}

/**
 * Cookie configuration options
 * Standard HTTP cookie options without over-engineering
 */
export interface CookieOptions {
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: boolean | 'lax' | 'strict' | 'none';
}

/**
 * Session configuration interface
 * Simplified from previous complex configuration layers
 */
export interface SessionConfig<T extends SessionData = SessionData> {
  /** Direct unstorage Storage instance - no wrapper abstractions */
  store: Storage<T>;

  /** Secret(s) for signing cookies - supports rotation with array */
  secret: string | string[];

  /** Cookie name (default: 'connect.sid') */
  name?: string;

  /** Session TTL in seconds (default: 86400 = 24 hours) */
  maxAge?: number;

  /** Cookie options */
  cookie?: CookieOptions;

  /** Optional function to generate initial session data */
  generate?: () => T;
}

/**
 * Session operation result
 * Simplified error handling without complex error enums
 */
export interface SessionOperationResult {
  success: boolean;
  error?: SessionError;
}

/**
 * Session error interface
 * Simple error structure without over-engineered error hierarchies
 */
export interface SessionError {
  code:
    | 'INVALID_SESSION'
    | 'CRYPTO_ERROR'
    | 'STORAGE_ERROR'
    | 'EXPIRED_SESSION';
  message: string;
  details?: Record<string, unknown>;
}

/**
 * H3 Event type for session operations
 * Re-export for convenience without adding dependency
 */
export interface H3Event {
  node: {
    req: any;
    res: any;
  };
  context: Record<string, any>;
}
