# @analog-tools/session Implementation Explained

## Introduction

The `@analog-tools/session` library provides a robust and flexible session management solution for Nitro/H3-based applications. It is designed to work seamlessly with Nuxt, Nitro, or any application built on the H3 server framework. This document explains the library's implementation, design decisions, configuration options, and various session storage mechanisms.

## Core Concepts and Architecture

### Why @analog-tools/session?

The standard session management solutions for Express and other Node.js frameworks typically don't work well with the H3 server that powers Nitro applications. @analog-tools/session was implemented to provide a session management solution specifically designed for the H3 ecosystem, with:

1. **H3 Integration**: Works natively with H3 events and context
2. **Type Safety**: Full TypeScript support with generics for type-safe session data
3. **Modern Architecture**: Built with immutability and functional programming principles
4. **Multiple Storage Options**: Support for various session storage backends
5. **Security First**: Secure-by-default with signed cookies and other security measures

### Core Components

The library is organized into several key components:

1. **Session Class**: Represents a user session with immutable data handling
2. **useSession Hook**: H3 middleware that initializes and manages sessions
3. **Storage Backends**: Pluggable storage mechanisms for session persistence
4. **Cryptographic Utilities**: For cookie signing/verification and secure session handling

## Implementation Details

### Session Class

The core `Session` class implements an immutable data pattern, providing:

```typescript
class Session {
  get data(): Readonly<SessionDataT>; // Get immutable session data
  update(updater: (data: Readonly<SessionDataT>) => SessionDataT | Partial<SessionDataT>): Session; // Update session data immutably
  set(newData: SessionDataT): Session; // Replace entire session data
  save(): Promise<void>; // Save session to store
  reload(): Promise<void>; // Reload from store
  destroy(): Promise<void>; // Destroy session
  regenerate(): Promise<void>; // Create new session ID
}
```

This immutable approach prevents accidental mutation of session data and provides a clear, predictable API for session management.

### Session Middleware (useSession)

The `useSession` function integrates with H3's middleware system:

1. **Cookie Management**: Reads and writes signed session cookies
2. **Session Initialization**: Creates new sessions or loads existing ones
3. **Session Storage**: Interfaces with the configured storage backend
4. **Context Integration**: Attaches session information to the H3 event context

### Session Storage

The library implements a store interface with these key methods:

```typescript
interface SessionStore<T extends SessionDataT = SessionDataT> {
  destroy(sid: string): Promise<void>;
  get(sid: string): Promise<RawSession<T> | undefined>;
  set(sid: string, data: RawSession<T>): Promise<void>;
  touch(sid: string, data: T): Promise<void>;
  // Optional methods
  all?(): Promise<RawSession<T>[]>;
  clear?(): Promise<void>;
  length?(): Promise<number>;
}
```

Two primary storage implementations are provided:

1. **UnstorageSessionStore**: A flexible store based on the `unstorage` library
2. **RedisSessionStore**: Redis-specific implementation built on top of UnstorageSessionStore

## Configuration Options

### Basic Configuration

```typescript
const sessionConfig: H3SessionOptions = {
  store: new UnstorageSessionStore(/* storage options */),
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  name: 'session-id', // Cookie name
  cookie: {
    maxAge: 60 * 60 * 24 * 7, // 1 week
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}
```

### Store Configuration Options

#### Unstorage Store Options

```typescript
interface UnstorageSessionStoreOptions<T> {
  prefix: string;         // Key prefix for storage
  ttl: number | Function; // Time-to-live in seconds or TTL calculator function
}
```

#### Redis Store Options

```typescript
interface RedisSessionStoreOptions<T> extends UnstorageSessionStoreOptions<T> {
  url?: string;      // Redis connection URL
  host?: string;     // Redis host
  port?: number;     // Redis port
  username?: string; // Redis username
  password?: string; // Redis password
  db?: number;       // Redis database
  tls?: Record<string, unknown>; // TLS configuration
}
```

## Security Implementation

The library emphasizes security with several key features:

1. **Cookie Signing**: All session cookies are cryptographically signed to prevent tampering
2. **Secret Rotation**: Support for multiple secrets enables secret rotation without invalidating sessions
3. **HTTP-Only Cookies**: Default to HTTP-only, preventing JavaScript access
4. **Secure-by-Default**: Secure cookies are enabled by default in production
5. **Session Regeneration**: Support for regenerating session IDs to prevent fixation attacks

## Package Dependencies

The @analog-tools/session library has the following direct dependencies:

- `h3`: The H3 HTTP server framework
- `uncrypto`: For cryptographic functions and secure ID generation
- `unstorage`: Flexible storage abstraction layer
- `defu`: For default option merging
- `ioredis`: For Redis session store (optional dependency)

## Usage Examples

### Basic Usage with Nitro Server

```typescript
// nitro.config.ts
import { defineNitroConfig } from 'nitropack/config'
import { UnstorageSessionStore, useSession } from '@analog-tools/session'
import { createStorage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'

export default defineNitroConfig({
  handlers: [
    {
      route: '/**',
      handler: (event) => {
        await useSession(event, {
          store: new UnstorageSessionStore(
            createStorage({ driver: memoryDriver() }),
            { prefix: 'sess', ttl: 60 * 60 * 24 }
          ),
          secret: process.env.SESSION_SECRET || 'your-secret',
        })
      }
    }
  ]
})
```

### Using with Redis Session Store

```typescript
// Configure Redis session store
const sessionStore = new RedisSessionStore({
  url: process.env.REDIS_URL,
  prefix: 'app-sess',
  ttl: 60 * 60 * 24 * 7 // 1 week
});

// Use session middleware
app.use(async (event) => {
  await useSession(event, {
    store: sessionStore,
    secret: process.env.SESSION_SECRET,
    cookie: {
      maxAge: 60 * 60 * 24 * 7, // 1 week
      secure: process.env.NODE_ENV === 'production'
    }
  });
});
```

## Best Practices

1. **Environment Variables**: Store session secrets in environment variables
2. **Secret Rotation**: Use an array of secrets when rotating session signing keys
3. **Redis for Production**: Use Redis session store in production for reliability and scalability
4. **TTL Management**: Configure appropriate TTLs based on security requirements
5. **Type Safety**: Leverage TypeScript generics to ensure type-safe session data

## Conclusion

The @analog-tools/session library provides a robust, type-safe, and flexible session management solution specifically designed for H3-based applications. By leveraging modern JavaScript patterns and providing multiple storage backends, it enables developers to implement secure and efficient session management across various deployment scenarios.
