# @analog-tools/session

> **Early Development Stage** -- Breaking changes may happen frequently as APIs evolve.

Session management for H3-based applications (AnalogJS, Nitro, Nuxt). Uses a functional API with direct [unstorage](https://unstorage.unjs.io) integration for pluggable storage backends.

[![npm version](https://img.shields.io/npm/v/@analog-tools/session.svg)](https://www.npmjs.com/package/@analog-tools/session)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [useSession](#usesessionevent-config)
  - [getSession](#getsessiontevent-t--null)
  - [updateSession](#updatesessiontevent-updater)
  - [destroySession](#destroysessionevent)
  - [regenerateSession](#regeneratesessiontevent)
  - [createUnstorageStore](#createunstoragestoretoptions)
  - [signCookie / unsignCookie](#signcookie--unsigncookie)
- [Configuration](#configuration)
  - [SessionConfig](#sessionconfig)
  - [Cookie Options](#cookie-options)
- [Storage Drivers](#storage-drivers)
- [Error Handling](#error-handling)
- [Usage Examples](#usage-examples)
  - [Authentication Flow](#authentication-flow)
  - [Typed Sessions](#typed-sessions)
  - [Secret Rotation](#secret-rotation)
- [Security](#security)
- [Limitations](#limitations)
- [Related Packages](#related-packages)
- [License](#license)

## Installation

```bash
npm install @analog-tools/session
```

Peer dependency:

```bash
npm install h3
```

## Quick Start

```typescript
import { defineEventHandler } from 'h3';
import { useSession, getSession, updateSession, createUnstorageStore } from '@analog-tools/session';

const store = await createUnstorageStore({
  type: 'redis',
  options: { url: 'redis://localhost:6379' },
});

export default defineEventHandler(async (event) => {
  await useSession(event, {
    store,
    secret: process.env['SESSION_SECRET']!,
    maxAge: 86400,
  });

  const session = getSession(event);

  await updateSession(event, (data) => ({
    visits: ((data['visits'] as number) || 0) + 1,
    lastAccess: Date.now(),
  }));

  return { visits: getSession(event)?.['visits'] || 0 };
});
```

## API Reference

### `useSession(event, config)`

Initializes a session for an H3 event. Must be called before any other session operation on that event.

- Reads the session cookie, verifies its HMAC-SHA256 signature, and loads session data from the store
- If no valid session exists, generates a new session ID (using `nanoid`), sets a signed cookie, and persists initial data
- Stores the session config in the event context so subsequent calls (`updateSession`, `destroySession`, `regenerateSession`) can access it

```typescript
await useSession(event, {
  store,
  secret: 'your-secret-key',
  name: 'my-app-session',   // cookie name (default: 'connect.sid')
  maxAge: 3600,              // TTL in seconds (default: 86400)
  cookie: {
    secure: true,
    httpOnly: true,
    sameSite: 'strict',
  },
  generate: () => ({ createdAt: Date.now() }),
});
```

### `getSession<T>(event): T | null`

Returns the current session data from the event context, or `null` if no session has been initialized.

```typescript
interface UserSession {
  userId?: string;
  roles?: string[];
}

const session = getSession<UserSession>(event);
if (session?.userId) {
  // session is typed as UserSession
}
```

This is a synchronous read from the event context -- it does not hit the storage backend.

### `updateSession<T>(event, updater)`

Applies partial updates to session data and persists the result to the store.

The updater function receives the current session data and returns a partial object that is shallow-merged with the existing data:

```typescript
await updateSession<UserSession>(event, (current) => ({
  lastActivity: Date.now(),
  loginCount: (current.loginCount || 0) + 1,
}));
```

Throws a `SessionError` with code `INVALID_SESSION` if no active session exists.

### `destroySession(event)`

Removes the session from the store, clears the event context, and sets the cookie to expire immediately.

```typescript
await destroySession(event);
```

Safe to call when no session exists -- returns without throwing.

### `regenerateSession<T>(event)`

Generates a new session ID while preserving existing session data. The old session is removed from the store, and the cookie is updated with the new signed ID.

Use this after authentication to prevent session fixation attacks:

```typescript
// After successful login
await regenerateSession(event);
await updateSession(event, () => ({ userId: user.id }));
```

Throws a `SessionError` with code `INVALID_SESSION` if no active session exists.

### `createUnstorageStore<T>(options)`

Creates an [unstorage](https://unstorage.unjs.io) `Storage<T>` instance by dynamically importing the specified driver. Returns a promise.

```typescript
import { createUnstorageStore } from '@analog-tools/session';

// Redis
const store = await createUnstorageStore({
  type: 'redis',
  options: { url: 'redis://localhost:6379' },
});

// Cloudflare KV
const kvStore = await createUnstorageStore({
  type: 'cloudflare-kv-binding',
  options: { binding: 'MY_KV_NAMESPACE' },
});

// File system (development)
const fsStore = await createUnstorageStore({
  type: 'fs',
  options: { base: './.sessions' },
});

// Memory (testing only)
const memStore = await createUnstorageStore({ type: 'memory' });
```

The `options` parameter is type-safe: TypeScript enforces that the `options` object matches the selected driver type via the `DriverOptions` discriminated union.

> **Note:** Memory storage has known issues. Use Redis, Cloudflare KV, or file system for development and production.

### `signCookie` / `unsignCookie`

Low-level cookie signing utilities. You typically do not need these directly -- `useSession` handles signing internally.

```typescript
import { signCookie, unsignCookie } from '@analog-tools/session';

// Sign a value with HMAC-SHA256
// Returns format: s:value.signature
const signed = await signCookie('session-id-123', 'secret');

// Verify and extract the original value
// Tries each secret in order (for key rotation)
const value = await unsignCookie(signed, ['current-secret', 'old-secret']);
// Returns 'session-id-123' or null if invalid
```

Requires the Web Crypto API (`crypto.subtle`). Throws if the environment does not support it.

## Configuration

### SessionConfig

```typescript
interface SessionConfig<T extends SessionData = SessionData> {
  /** unstorage Storage instance */
  store: Storage<T>;

  /** Secret(s) for HMAC-SHA256 cookie signing. Array enables key rotation. */
  secret: string | string[];

  /** Cookie name (default: 'connect.sid') */
  name?: string;

  /** Session TTL in seconds (default: 86400 = 24 hours) */
  maxAge?: number;

  /** Cookie configuration */
  cookie?: CookieOptions;

  /** Function to generate initial session data for new sessions */
  generate?: () => T;
}
```

When `secret` is an array, the first secret is used for signing new cookies. All secrets are tried when verifying existing cookies, enabling zero-downtime secret rotation.

### Cookie Options

```typescript
interface CookieOptions {
  domain?: string;
  path?: string;       // default: '/'
  secure?: boolean;    // default: false
  httpOnly?: boolean;  // default: true
  sameSite?: boolean | 'lax' | 'strict' | 'none'; // default: 'lax'
}
```

## Storage Drivers

The package supports all [unstorage built-in drivers](https://unstorage.unjs.io/drivers). The `DriverOptions` type is derived from unstorage's `BuiltinDriverOptions`, so any driver that unstorage ships is available with full type checking.

Common options:

| Driver | Type | Use Case |
|--------|------|----------|
| `redis` | `'redis'` | Production deployments with Redis |
| `cloudflare-kv-binding` | `'cloudflare-kv-binding'` | Cloudflare Workers with KV |
| `fs` | `'fs'` | Local development with file-based persistence |
| `memory` | `'memory'` | Unit tests (has known issues) |
| `http` | `'http'` | Remote storage over HTTP |

Additional drivers (MongoDB, Vercel KV, Planetscale, Azure, etc.) are documented in the [unstorage drivers documentation](https://unstorage.unjs.io/drivers).

## Error Handling

Session operations throw errors with a `code` property for programmatic handling:

```typescript
interface SessionError {
  code:
    | 'COOKIE_ERROR'      // Failed to sign or set the session cookie
    | 'INVALID_SESSION'   // No active session (updateSession/regenerateSession called without useSession)
    | 'CRYPTO_ERROR'      // Unexpected error during session initialization
    | 'STORAGE_ERROR'     // Failed to read/write/delete from the store
    | 'EXPIRED_SESSION';  // Session data no longer exists in the store
  message: string;
  details?: Record<string, unknown>;
}
```

Example error handling:

```typescript
import { defineEventHandler, createError } from 'h3';
import { useSession, getSession } from '@analog-tools/session';

export default defineEventHandler(async (event) => {
  try {
    await useSession(event, sessionConfig);
  } catch (err) {
    const sessionErr = err as Error & { code?: string };
    if (sessionErr.code === 'STORAGE_ERROR') {
      throw createError({ statusCode: 503, statusMessage: 'Session storage unavailable' });
    }
    throw createError({ statusCode: 500, statusMessage: 'Session initialization failed' });
  }

  const session = getSession(event);
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'No session' });
  }

  return { ok: true };
});
```

## Usage Examples

### Authentication Flow

```typescript
import { defineEventHandler, readBody, createError } from 'h3';
import {
  useSession,
  getSession,
  updateSession,
  destroySession,
  regenerateSession,
  createUnstorageStore,
} from '@analog-tools/session';

interface AuthSession {
  userId?: string;
  username?: string;
  loginTime?: number;
}

const store = await createUnstorageStore({
  type: 'redis',
  options: { url: process.env['REDIS_URL']! },
});

const sessionConfig = {
  store,
  secret: process.env['SESSION_SECRET']!,
  maxAge: 3600,
  cookie: {
    secure: process.env['NODE_ENV'] === 'production',
    httpOnly: true,
    sameSite: 'strict' as const,
  },
};

// Login handler
export const loginHandler = defineEventHandler(async (event) => {
  await useSession<AuthSession>(event, sessionConfig);

  const { username, password } = await readBody(event);
  const user = await validateCredentials(username, password);

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' });
  }

  // Prevent session fixation
  await regenerateSession(event);

  await updateSession<AuthSession>(event, () => ({
    userId: user.id,
    username: user.username,
    loginTime: Date.now(),
  }));

  return { authenticated: true };
});

// Protected handler
export const protectedHandler = defineEventHandler(async (event) => {
  await useSession<AuthSession>(event, sessionConfig);

  const session = getSession<AuthSession>(event);
  if (!session?.userId) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' });
  }

  return { user: { id: session.userId, username: session.username } };
});

// Logout handler
export const logoutHandler = defineEventHandler(async (event) => {
  await useSession<AuthSession>(event, sessionConfig);
  await destroySession(event);
  return { authenticated: false };
});
```

### Typed Sessions

Define a session interface and pass it as a type parameter for compile-time safety:

```typescript
interface AppSession {
  userId: string;
  roles: string[];
  preferences: {
    theme: 'light' | 'dark';
    language: string;
  };
  lastActivity: number;
}

export default defineEventHandler(async (event) => {
  await useSession<AppSession>(event, {
    store,
    secret: process.env['SESSION_SECRET']!,
    generate: () => ({
      userId: '',
      roles: [],
      preferences: { theme: 'light', language: 'en' },
      lastActivity: Date.now(),
    }),
  });

  const session = getSession<AppSession>(event);
  // TypeScript knows: session.preferences.theme is 'light' | 'dark'

  await updateSession<AppSession>(event, () => ({
    lastActivity: Date.now(),
  }));
});
```

### Secret Rotation

Rotate session secrets without invalidating existing sessions:

```typescript
// Step 1: Add the new secret as the first element
const config = {
  store,
  secret: ['new-secret-2025', 'old-secret-2024'],
  // New sessions are signed with 'new-secret-2025'
  // Existing cookies signed with 'old-secret-2024' still validate
};

// Step 2: After all old sessions have expired (maxAge has elapsed),
// remove the old secret
const configAfterRotation = {
  store,
  secret: 'new-secret-2025',
};
```

## Security

- HMAC-SHA256 cookie signatures using the Web Crypto API (`crypto.subtle`)
- Timing-safe signature comparison to prevent timing attacks
- Session IDs generated with `nanoid` (URL-safe, 21 characters, 126 bits of entropy)
- `httpOnly: true` by default -- cookies are not accessible from client-side JavaScript
- Secret rotation support for zero-downtime key changes
- `regenerateSession` prevents session fixation after privilege escalation

**Production recommendations:**
- Set `cookie.secure: true` (requires HTTPS)
- Use a secret of at least 32 random characters
- Use persistent storage (Redis, Cloudflare KV) -- not memory or file system
- Set `sameSite: 'strict'` or `'lax'` based on your cross-origin requirements

## Limitations

- **No built-in session expiry cleanup** -- expired sessions remain in the store until explicitly removed or the storage driver handles TTL natively (Redis `EX`, Cloudflare KV `expirationTtl`). The `maxAge` config only controls the cookie lifetime.
- **Memory driver has known issues** -- use Redis, file system, or another persistent driver for development and production.
- **No per-request locking** -- concurrent requests modifying the same session can produce race conditions. The last write wins.
- **Web Crypto API required** -- the signing functions use `crypto.subtle`, which is available in Node.js 15+, Deno, Cloudflare Workers, and modern browsers. Environments without Web Crypto will throw at runtime.

## Related Packages

| Package | Purpose |
|---------|---------|
| [`@analog-tools/auth`](https://github.com/MrBacony/analog-tools/tree/main/packages/auth) | OAuth 2.0/OIDC authentication (uses this package internally) |
| [`@analog-tools/inject`](https://github.com/MrBacony/analog-tools/tree/main/packages/inject) | Service registry dependency injection |
| [`@analog-tools/logger`](https://github.com/MrBacony/analog-tools/tree/main/packages/logger) | Structured logging with deduplication |

## License

MIT
