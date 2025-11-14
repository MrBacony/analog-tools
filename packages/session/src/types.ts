import type { BuiltinDriverOptions, Storage } from 'unstorage';

/**
 * Base session data interface
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface
export interface SessionData extends Record<string, unknown> {}

/**
 * Cookie configuration options
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
 */
export interface SessionConfig<T extends SessionData = SessionData> {
  /** Direct unstorage Storage instance */
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
 */
export interface SessionOperationResult {
  success: boolean;
  error?: SessionError;
}

/**
 * Session error interface
 */
export interface SessionError {
  code:
    | 'COOKIE_ERROR'
    | 'INVALID_SESSION'
    | 'CRYPTO_ERROR'
    | 'STORAGE_ERROR'
    | 'EXPIRED_SESSION';
  message: string;
  details?: Record<string, unknown>;
}

export type AvailableDrivers = keyof BuiltinDriverOptions;

/**
 * Type-safe driver options - maps driver type to corresponding options
 * TypeScript will enforce that options match the selected driver type
 */
export type DriverOptions = {
  [K in AvailableDrivers]: {
    type: K;
    options: BuiltinDriverOptions[K];
  }
}[AvailableDrivers];

/**
 * Helper type to extract specific driver options
 * @example ExtractDriverOptions<'redis'> gives { type: 'redis', options: RedisOptions }
 */
export type ExtractDriverOptions<T extends AvailableDrivers> = Extract<DriverOptions, { type: T }>;
