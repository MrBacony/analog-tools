# @analog-tools/session

> **⚠️ IMPORTANT: Early Development Stage** ⚠️  
> This project is in its early development stage. Breaking changes may happen frequently as the APIs evolve. Use with caution in production environments.

A powerful session management library for H3-based applications (Nuxt, Nitro, Analog), providing persistent sessions with various storage backends.

[![npm version](https://img.shields.io/npm/v/@analog-tools/session.svg)](https://www.npmjs.com/package/@analog-tools/session)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Features

- 🔒 Secure, signed session cookies
- 🔄 Multiple storage backends (Redis, Memory, Unstorage)
- 🧩 TypeScript support with full type safety
- 🚀 Familiar API (compatible with express-session patterns)
- 🔑 Secret key rotation support
- ⏰ Configurable TTL for sessions

## Installation

```bash
# Using npm
npm install @analog-tools/session

# Using pnpm
pnpm add @analog-tools/session

# Using yarn
yarn add @analog-tools/session
```

## Quick Start

Here's a basic example using the Unstorage session store with Redis:

```typescript
import { defineEventHandler } from 'h3';
import { useSession, UnstorageSessionStore } from '@analog-tools/session';
import { createStorage } from 'unstorage';
import redisDriver from 'unstorage/drivers/redis';

// Create a Redis-backed session store
const sessionStore = new UnstorageSessionStore(
  createStorage({
    driver: redisDriver({
      host: 'localhost',
      port: 6379,
    }),
  }),
  {
    ttl: 60 * 60 * 24, // 1 day
    prefix: 'sess',
  }
);

export default defineEventHandler(async (event) => {
  // Initialize session
  await useSession(event, {
    store: sessionStore,
    secret: 'my-super-secret-key',
  });

  // Access session data
  const session = event.context.sessionHandler;

  // Get session data
  console.log(session.data);

  // Update session data
  session.update((data) => ({
    ...data,
    visits: (data.visits || 0) + 1,
  }));

  // Save session (required after modifications)
  await session.save();

  return {
    sessionId: session.id,
    visits: session.data.visits,
  };
});
```

## Usage with AnalogJS

### API Route

```typescript
// src/server/routes/api/auth/login.ts
import { defineEventHandler, readBody } from 'h3';
import { useSession } from '@analog-tools/session';

export default defineEventHandler(async (event) => {
  const { username, password } = await readBody(event);

  // Validate credentials (example)
  // Note: validateUser is a placeholder function you would implement
  // to validate user credentials against your database
  const user = await validateUser(username, password);
  if (!user) {
    return { success: false, message: 'Invalid credentials' };
  }

  // Setup session
  await useSession(event);

  // Store user info in session
  const session = event.context.sessionHandler;
  session.set({
    userId: user.id,
    username: user.username,
    role: user.role,
    isAuthenticated: true,
  });

  // Save session
  await session.save();

  return { success: true };
});
```

### Session Configuration

Create a session configuration file:

```typescript
// src/lib/session.ts
import { createStorage } from 'unstorage';
import redisDriver from 'unstorage/drivers/redis';
import { UnstorageSessionStore } from '@analog-tools/session';

// Environment variables
const SESSION_SECRET = process.env.SESSION_SECRET || 'development-secret';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);

// Create Redis storage
const storage = createStorage({
  driver: redisDriver({
    host: REDIS_HOST,
    port: REDIS_PORT,
  }),
});

// Create session store
export const sessionStore = new UnstorageSessionStore(storage, {
  ttl: 60 * 60 * 24 * 7, // 1 week
  prefix: 'app-sess',
});

// Session configuration
export const sessionConfig = {
  store: sessionStore,
  secret: SESSION_SECRET,
  cookie: {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 1 week
  },
  saveUninitialized: false,
};
```

### Creating a Session Middleware

```typescript
// src/server/middleware/session.ts
import { defineEventHandler } from 'h3';
import { useSession } from '@analog-tools/session';
import { sessionConfig } from '../../lib/session';

export default defineEventHandler(async (event) => {
  await useSession(event, sessionConfig);
});
```

### Using the Session Middleware

To apply the session middleware in your AnalogJS application, you can use one of the following approaches:

#### Option 1: Using middleware.ts file (applies to all routes)

```typescript
// src/server/middleware/middleware.ts
import { defineEventHandler } from 'h3';
import { useSession } from '@analog-tools/session';
import { sessionConfig } from '../../lib/session';

// This middleware will be applied to all routes
export default defineEventHandler(async (event) => {
  await useSession(event, sessionConfig);
});
```

#### Option 2: Using a route-specific middleware

```typescript
// src/server/middleware/auth.ts
import { defineEventHandler, createError, getRouterParam } from 'h3';

export default defineEventHandler(async (event) => {
  // Access session from previous middleware
  const session = event.context.sessionHandler;

  // Check if user is authenticated
  if (!session?.data?.isAuthenticated) {
    throw createError({
      statusCode: 401,
      message: 'Authentication required',
    });
  }
});
```

Then, in your API routes:

```typescript
// src/server/routes/api/protected/[id].ts
import { defineEventHandler, getRouterParam } from 'h3';

// Middleware runs first, ensuring authentication
export default defineEventHandler(async (event) => {
  const session = event.context.sessionHandler;
  const id = getRouterParam(event, 'id');

  // User is guaranteed to be authenticated here
  return {
    id,
    username: session.data.username,
    message: `This is protected resource ${id}`,
  };
});
```

## Choosing a Session Store

@analog-tools/session provides multiple storage backends, each with different characteristics:

### Comparison of Session Stores

| Store Type                 | Description                                                                                                        | Best For                                                | Configuration Complexity |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ------------------------ |
| **UnstorageSessionStore**  | Uses [Unstorage](https://github.com/unjs/unstorage) to support multiple storage drivers (Redis, Memory, FS, etc.). | Flexibility and adaptability to different environments. | Medium                   |
| **RedisSessionStore**      | Specialized implementation optimized for Redis.                                                                    | High-performance production environments.               | Low                      |
| **Memory** (via Unstorage) | In-memory storage that doesn't persist across restarts.                                                            | Development and testing.                                | Very Low                 |

### When to use each store:

- **UnstorageSessionStore**: When you need flexibility to switch between different storage backends or want to use other Unstorage drivers (MongoDB, Cloudflare KV, etc.).
- **RedisSessionStore**: When performance is critical and Redis is your preferred storage solution.
- **Memory**: For development environments or stateless applications where session persistence isn't required.

> **⚠️ KNOWN ISSUE**: The Memory storage option is currently broken and not functioning properly. Please use Redis or another storage backend until this issue is resolved.

### Memory Store Example

```typescript
import { createStorage } from 'unstorage';
import memoryDriver from 'unstorage/drivers/memory';
import { UnstorageSessionStore } from '@analog-tools/session';

// Create a memory-backed session store (not persistent across restarts)
const sessionStore = new UnstorageSessionStore(
  createStorage({ driver: memoryDriver() }),
  { ttl: 3600 } // 1 hour
);
```

## Type Safety

You can define your session data structure by extending the `SessionDataT` interface:

```typescript
// Define your session data structure
declare module '@analog-tools/session' {
  export interface SessionDataT {
    userId?: string;
    username?: string;
    isAuthenticated: boolean;
    lastAccess?: Date;
    preferences?: {
      theme: 'light' | 'dark';
      language: string;
    };
  }
}
```

## Secret Rotation

To rotate session secrets without invalidating existing sessions:

```typescript
await useSession(event, {
  store: sessionStore,
  // Last secret is used for signing new cookies
  // All secrets are used for verifying existing cookies
  secret: ['old-secret-1', 'old-secret-2', 'new-secret'],
});
```

## License

MIT

## Acknowledgements

This package is inspired by and contains code adapted from [@scayle/h3-session](https://www.npmjs.com/package/@scayle/h3-session), which is based on express-session. We extend our gratitude to the original authors for their excellent work.

---

## Development

This library was generated with [Nx](https://nx.dev).

### Running unit tests

Run `nx test session` to execute the unit tests.

### Building the library

Run `nx build session` to build the library.
