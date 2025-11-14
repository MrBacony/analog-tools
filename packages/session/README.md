# @analog-tools/session

> **✨ Simplified Session Management** ✨  
> Completely redesigned with a clean, functional API. No more over-engineered abstractions!

A simple, performant session management library for H3-based applications (Nuxt, Nitro, AnalogJS). Designed for simplicity and efficiency with a single API pattern.

[![npm version](https://img.shields.io/npm/v/@analog-tools/session.svg)](https://www.npmjs.com/package/@analog-tools/session)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@analog-tools/session)](https://bundlephobia.com/package/@analog-tools/session)

## Table of Contents

- [Features](#features)
- [Breaking Changes in v0.0.6](#breaking-changes-in-v006)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Usage Examples](#usage-examples)
- [Configuration](#configuration)
- [Migration from v0.0.5](#migration-from-v005)
- [Performance](#performance)
- [Security](#security)
- [Contributing](#contributing)

## Features

- 🎯 **Simple**: Single functional API, no dual patterns or classes
- ⚡ **Performance**: ~4KB gzipped, optimized for modern applications
- 🔒 **Secure**: Essential crypto with timing attack resistance
- 🔄 **Direct**: Uses unstorage directly, no wrapper abstractions
- 🔄 **Rotation**: Secret key rotation support
- 🧩 **TypeScript**: Full type safety with minimal generics
- ⚡ **Modern**: Built for AnalogJS

## Breaking Changes in v0.0.6

This version introduces a **complete API redesign** that simplifies the previous over-engineered approach:

- ❌ **Removed**: `Session` class and `SessionHandler` interface
- ❌ **Removed**: `UnstorageSessionStore` wrapper and `registerStorage` factory
- ❌ **Removed**: Complex crypto module (309 lines → 96 lines)
- ❌ **Removed**: Dual API patterns and unnecessary abstractions
- ✅ **Added**: Simple functional API with direct storage integration
- ✅ **Added**: Essential crypto functions only
- ✅ **Added**: Storage factory functions

**Migration Guide**: See [Migration from v0.0.5](#migration-from-v005) section below.

## Installation

```bash
npm install @analog-tools/session
```

## Quick Start

### Basic Usage with Memory Storage

```typescript
import { defineEventHandler } from 'h3';
import { useSession, getSession, updateSession, createUnstorageStore } from '@analog-tools/session';

const store = await createUnstorageStore({ type: 'memory' });

export default defineEventHandler(async (event) => {
  // Initialize session middleware
  await useSession(event, {
    store,
    secret: 'your-secret-key',
    maxAge: 86400, // 24 hours
  });

  // Get current session data
  const session = getSession(event);
  console.log('Current session:', session);

  // Update session data
  await updateSession(event, (data) => ({
    visits: (data.visits || 0) + 1,
    lastAccess: Date.now(),
  }));

  return {
    visits: getSession(event)?.visits || 0,
  };
});
```

### With Redis Storage

```typescript
import { createUnstorageStore } from '@analog-tools/session';

const store = await createUnstorageStore({
  type: 'redis',
  options: {
    host: 'localhost',
    port: 6379,
    // Optional: password, db, etc.
  }
});

export default defineEventHandler(async (event) => {
  await useSession(event, {
    store,
    secret: ['new-secret', 'old-secret'], // Supports rotation
    name: 'my-app-session',
    maxAge: 3600,
    cookie: {
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
    },
  });

  // Your session logic here
});
```

## API Reference

### Core Functions

#### `useSession(event, config)`

Initialize session middleware for an H3 event. Must be called before other session operations.

```typescript
await useSession(event, {
  store: Storage<T>,           // Direct unstorage Storage instance
  secret: string | string[],   // Secret(s) for signing cookies
  name?: string,              // Cookie name (default: 'connect.sid')
  maxAge?: number,            // TTL in seconds (default: 86400)
  cookie?: CookieOptions,     // Standard cookie options
  generate?: () => T,         // Optional initial data generator
});
```

#### `getSession<T>(event): T | null`

Get current session data from the event context.

```typescript
const session = getSession<{ userId?: string }>(event);
if (session?.userId) {
  console.log('User ID:', session.userId);
}
```

#### `updateSession<T>(event, updater)`

Update session data immutably and persist to storage.

```typescript
await updateSession(event, (currentData) => ({
  lastLogin: new Date().toISOString(),
  loginCount: (currentData.loginCount || 0) + 1,
}));
```

#### `destroySession(event)`

Destroy the current session, clear storage and cookies.

```typescript
await destroySession(event);
```

#### `regenerateSession<T>(event)`

Regenerate session ID while preserving data (useful after login).

```typescript
await regenerateSession(event);
```

### Storage Factory

#### `createUnstorageStore<T>(options)`

Create a storage instance using unstorage drivers.

```typescript
// Memory storage (development/testing)
const memoryStore = await createUnstorageStore({ type: 'memory' });

// Redis storage (production)
const redisStore = await createUnstorageStore({
  type: 'redis',
  options: {
    url: 'redis://localhost:6379',
    // or individual options:
    host: 'localhost',
    port: 6379,
    password: 'optional',
    db: 0,
  }
});

// Cloudflare KV storage
const kvStore = await createUnstorageStore({
  type: 'cloudflare-kv-binding',
  options: {
    binding: 'MY_KV_NAMESPACE',
  }
});

// File system storage
const fsStore = await createUnstorageStore({
  type: 'fs',
  options: {
    base: './data/sessions',
  }
});
```

**Available Storage Drivers:**

The package supports all [Unstorage drivers](https://unstorage.unjs.io/drivers). Popular options include:

- **Memory**: In-memory storage (development only)
- **Redis**: Redis database storage
- **Cloudflare KV**: Cloudflare Workers KV storage
- **File System**: Local file system storage
- **HTTP**: Remote HTTP storage
- **And many more**: MongoDB, Vercel KV, Planetscale, Azure, etc.

> 📚 For detailed configuration options for each driver, see the [Unstorage Drivers Documentation](https://unstorage.unjs.io/drivers)

### Crypto Functions

#### `signCookie(value, secret): Promise<string>`

Sign a cookie value with HMAC-SHA256.

#### `unsignCookie(signedValue, secrets): Promise<string | null>`

Verify and unsign a cookie value, supports multiple secrets for rotation.

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
  createUnstorageStore 
} from '@analog-tools/session';

// Session configuration (define once, reuse across routes)
const sessionConfig = {
  store: await createUnstorageStore({ 
    type: 'redis', 
    options: { url: process.env.REDIS_URL } 
  }),
  secret: process.env.SESSION_SECRET!,
  maxAge: 3600, // 1 hour
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict' as const,
  },
};

// Login endpoint
export default defineEventHandler(async (event) => {
  await useSession(event, sessionConfig);
  
  const { username, password } = await readBody(event);
  const user = await validateUser(username, password);
  
  if (user) {
    // Regenerate session ID for security
    await regenerateSession(event);
    
    // Store user data
    await updateSession(event, () => ({
      userId: user.id,
      username: user.username,
      loginTime: Date.now(),
    }));
    
    return { success: true };
  }
  
  return { success: false };
});

// Protected endpoint
export default defineEventHandler(async (event) => {
  await useSession(event, sessionConfig);
  
  const session = getSession(event);
  if (!session?.userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Not authenticated',
    });
  }
  
  return { user: session };
});

// Logout endpoint
export default defineEventHandler(async (event) => {
  await useSession(event, sessionConfig);
  await destroySession(event);
  return { success: true };
});
```

### TypeScript Interface

```typescript
interface UserSession {
  userId?: string;
  username?: string;
  roles?: string[];
  preferences?: Record<string, unknown>;
  lastActivity?: number;
}

export default defineEventHandler(async (event) => {
  await useSession<UserSession>(event, {
    store: await createUnstorageStore({ 
      type: 'redis', 
      options: { url: process.env.REDIS_URL } 
    }),
    secret: process.env.SESSION_SECRET!,
    generate: () => ({ lastActivity: Date.now() }),
  });

  const session = getSession<UserSession>(event);
  // TypeScript knows session has UserSession shape
});
```

## Configuration

### Session Config

```typescript
interface SessionConfig<T> {
  store: Storage<T>;           // Direct unstorage Storage
  secret: string | string[];   // Support for key rotation
  name?: string;              // Cookie name (default: 'connect.sid')
  maxAge?: number;            // TTL in seconds (default: 86400)
  cookie?: CookieOptions;     // Cookie configuration
  generate?: () => T;         // Initial session data generator
}
```

### Cookie Options

```typescript
interface CookieOptions {
  domain?: string;
  path?: string;              // Default: '/'
  secure?: boolean;           // Default: false
  httpOnly?: boolean;         // Default: true
  sameSite?: boolean | 'lax' | 'strict' | 'none'; // Default: 'lax'
}
```

## Migration from v0.0.5

If you're upgrading from v0.0.5 or earlier, here's how to migrate your code:

### Before (v0.0.5 and earlier)
```typescript
// If you were using the old Session class (not available in any released version)
// This is just for reference as the class was removed before public release
```

### After (v0.0.6 - Current)
```typescript
import { useSession, getSession, updateSession, createUnstorageStore } from '@analog-tools/session';

const store = await createUnstorageStore({ 
  type: 'redis', 
  options: { host: 'localhost', port: 6379 } 
});

export default defineEventHandler(async (event) => {
  await useSession(event, { store, secret: 'key' });
  
  await updateSession(event, (data) => ({ 
    visits: (data.visits || 0) + 1 
  })); // Auto-saves
});
```

### Key Migration Points:
1. Use `createUnstorageStore()` with appropriate driver type
2. Pass configuration directly to `useSession(event, config)`
3. Use `getSession(event)` to get current session data
4. Use `updateSession(event, updater)` to modify session data (auto-saves)
5. All operations are functional - no class instantiation needed

## Performance

- **Bundle Size**: ~4KB gzipped (significant reduction from previous versions)
- **Memory Usage**: Reduced through simplified architecture and direct storage integration
- **CPU**: Essential HMAC-SHA256 operations only, ~96 lines of crypto code
- **Tree Shaking**: Better dead code elimination with modern ESM build

## Security

- HMAC-SHA256 for cookie signing
- Timing attack resistant comparisons
- Secure cookie defaults
- Secret rotation support
- No over-engineered crypto that creates attack surfaces

## Contributing

Contributions are welcome! Please read our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

MIT © [Gregor Speck](https://github.com/MrBacony)
