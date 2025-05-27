import { H3Event } from 'h3';

/**
 * Represents an authentication route with a path and handler function
 */
export type AuthRoute = {
    /**
     * The path of the route relative to the auth base path
     */
    path: string;

    /**
     * The handler function for the route that processes H3Event objects
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (event: H3Event) => Promise<any> | any;
};

/**
 * Redis session storage configuration
 */
export type RedisSessionConfig = {
    host: string;
    port: number;
    username?: string;
    password?: string;
    db?: number;
    tls?: boolean;
    keyPrefix?: string;
    maxAge?: number; // TTL in seconds
};

/**
 * Memory session storage configuration
 */
export type MemorySessionConfig = {
    maxAge?: number; // TTL in seconds
};

/**
 * Cookie session storage configuration
 */
export type CookieSessionConfig = {
    maxAge?: number; // TTL in seconds
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    domain?: string;
    path?: string;
};

/**
 * Type-safe session storage configuration using discriminated union
 */
export type SessionStorageConfig =
    | { type: 'redis'; config: RedisSessionConfig }
    | { type: 'memory'; config: MemorySessionConfig }
    | { type: 'cookie'; config: CookieSessionConfig };

export type UserHandler = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mapUserToLocal?: <T>(user: T) => Promise<any> | any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createOrUpdateUser?: <T>(user: T) => Promise<any>;
};

/**
 * Configuration for analog auth
 */
export type AnalogAuthConfig = {
    issuer: string;
    clientId: string;
    clientSecret: string;
    audience: string;
    scope: string;
    callbackUri: string;
    
    tokenRefreshApiKey?: string;
    unprotectedRoutes?: string[];

    /**
     * Session storage configuration with type-safe mapping between
     * storage type and corresponding configuration
     */
    sessionStorage?: SessionStorageConfig;

    userHandler?: UserHandler;
};
