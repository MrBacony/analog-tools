# @analog-tools/session Architecture Documentation

## Architecture Overview

The @analog-tools/session library implements a modern, type-safe session management system for H3-based applications. This document outlines the architecture, components, design patterns, and data flows that compose the @analog-tools/session implementation.

```
┌─────────────────┐           ┌───────────────┐
│ H3 Application  │◄─────────►│  useSession   │
└─────────────────┘           └───────┬───────┘
                                     │
                                     ▼
┌─────────────────┐           ┌───────────────┐
│  SessionStore   │◄─────────►│    Session    │
└─────────────────┘           └───────────────┘
        │
        │
        ▼
┌─────────────────────────────────────────────┐
│            Storage Implementations          │
├─────────────────┐           ┌───────────────┤
│ UnstoragSession │           │ RedisSession  │
│     Store       │           │    Store      │
└─────────────────┘           └───────────────┘
```

## Core Components

The @analog-tools/session architecture consists of five key components that work together through well-defined interfaces:

### 1. Session Class

The Session class serves as the core entity of the architecture, representing a user session with immutable data handling.

**Responsibilities:**
- Maintain session data immutably
- Provide an API for updating, retrieving, and manipulating session state
- Interface with the session store for persistence
- Handle session lifecycle operations (creation, regeneration, destruction)

**Design Characteristics:**
- Implements immutable data pattern using private fields and getter methods
- Uses method chaining for fluent API design
- Encapsulates session ID and cookie management

### 2. useSession Middleware

The useSession function serves as the integration point with H3 applications, acting as middleware that initializes and attaches session handling to H3 events.

**Responsibilities:**
- Initialize session from request cookies or create a new session
- Configure and validate session options
- Attach session handlers to the H3 event context
- Handle session cookie management
- Integrate with the session store

**Design Characteristics:**
- Implements middleware pattern for H3 integration
- Provides dependency injection for session store
- Handles session initialization logic
- Applies functional programming principles for state management

### 3. Session Store Interface

The SessionStore interface defines a contract for session storage implementations, enabling pluggable storage backends.

**Responsibilities:**
- Define consistent API for session data persistence
- Support CRUD operations for session data
- Enable TTL (time-to-live) management for sessions

**Design Characteristics:**
- Uses interface-based design for storage abstraction
- Implements repository pattern for data access
- Provides flexibility for different storage mechanisms

### 4. Storage Implementations

The architecture includes concrete implementations of the SessionStore interface for different storage backends.

**Implementations:**
- **UnstorageSessionStore**: A flexible store based on the unstorage library
- **RedisSessionStore**: Redis-specific implementation for production use

**Design Characteristics:**
- Implements adapter pattern for different storage backends
- Leverages composition for shared functionality
- Provides specialized implementations for different use cases

### 5. Cryptographic Utilities

Utility functions that handle security aspects of session management.

**Responsibilities:**
- Sign and verify session cookies
- Generate secure session IDs
- Support secret rotation

**Design Characteristics:**
- Implements stateless functional design
- Provides focused utilities for security operations
- Supports multiple secrets for key rotation

## Design Patterns

The @analog-tools/session architecture employs several design patterns to achieve flexibility, maintainability, and robustness:

### 1. Immutable Object Pattern

The Session class implements immutability for session data, preventing accidental mutations and ensuring predictable behavior.

```typescript
// Example of immutable object pattern in the Session class
update(updater: (data: Readonly<SessionDataT>) => SessionDataT | Partial<SessionDataT>): Session {
  const updatedData = updater(this.#data);
  this.#data = Object.freeze({
    ...this.#data,
    ...(updatedData as SessionDataT),
  });
  return this;
}
```

### 2. Repository Pattern

The SessionStore interface and its implementations follow the repository pattern, abstracting data access and storage details.

```typescript
// Repository pattern abstraction
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

### 3. Middleware Pattern

The useSession function implements the middleware pattern for H3 integration, processing requests and attaching session handling.

```typescript
// Middleware pattern for H3 integration
export async function useSession<T extends SessionDataT = SessionDataT>(
  event: H3Event, 
  config: H3SessionOptions<T>
): Promise<void> {
  // Middleware implementation
}
```

### 4. Factory Pattern

The session generation process uses factory pattern principles to create new sessions.

```typescript
// Factory pattern for session generation
const generator = async () => {
  return await Promise.resolve({
    id: sessionConfig.genid(event),
    data: sessionConfig.generate() as T,
  });
};
```

### 5. Adapter Pattern

Storage implementations use the adapter pattern to integrate with different storage backends.

```typescript
// Adapter pattern for Redis integration
export class RedisSessionStore<T extends SessionDataT = SessionDataT> extends UnstorageSessionStore<T> {
  constructor(options: Partial<RedisSessionStoreOptions<T>> = {}) {
    const storage = createStorage<T>({
      driver: redisDriver({
        // Redis connection options
      }),
    });
    super(storage, {
      // Base store options
    });
  }
}
```

### 6. Proxy Pattern

Cookie management uses the Proxy pattern to intercept property assignments and trigger cookie updates.

```typescript
// Proxy pattern for cookie management
return new Proxy(cookie, {
  set<K extends keyof typeof cookie>(target: typeof cookie, property: K, value: typeof cookie[K]) {
    target[property] = value;
    setCookie(event, sessionConfig.name, signedCookie, cookie);
    return true;
  },
});
```

## Data Flow and Session Lifecycle

The session lifecycle follows these key stages:

### 1. Session Initialization

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  H3 Request   │────►│  useSession   │────►│ Extract/Create│
│               │     │  Middleware   │     │  Session ID   │
└───────────────┘     └───────────────┘     └───────┬───────┘
                                                   │
                                                   ▼
                                           ┌───────────────┐
                                           │ Load/Generate │
                                           │ Session Data  │
                                           └───────┬───────┘
                                                   │
                                                   ▼
                                           ┌───────────────┐
                                           │ Create Session│
                                           │    Object     │
                                           └───────┬───────┘
                                                   │
                                                   ▼
                                           ┌───────────────┐
                                           │ Attach to H3  │
                                           │    Context    │
                                           └───────────────┘
```

### 2. Session Interaction

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  Application  │────►│ Session Update │────►│ Immutable Data│
│     Logic     │     │    Methods     │     │ Transformation│
└───────────────┘     └───────────────┘     └───────┬───────┘
                                                   │
                                                   ▼
                                           ┌───────────────┐
                                           │ Return Updated│
                                           │  Session Obj  │
                                           └───────────────┘
```

### 3. Session Persistence

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│    Session    │────►│  Session.save │────►│ SessionStore  │
│     Object    │     │    Method     │     │  .set Method  │
└───────────────┘     └───────────────┘     └───────┬───────┘
                                                   │
                                                   ▼
                                           ┌───────────────┐
                                           │Storage Backend│
                                           │ (Redis/Memory)│
                                           └───────────────┘
```

### 4. Session Termination

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│    Session    │────►│Session.destroy│────►│ SessionStore  │
│     Object    │     │    Method     │     │.destroy Method│
└───────────────┘     └───────────────┘     └───────┬───────┘
                                                   │
                                                   ▼
                                           ┌───────────────┐
                                           │ Expire Session│
                                           │    Cookie     │
                                           └───────────────┘
```

## Storage Architecture

The storage architecture follows a layered approach:

### Layer 1: Session Store Interface
Defines the contract for session storage with core CRUD operations.

### Layer 2: Base Implementation (UnstorageSessionStore)
Provides a flexible implementation using the unstorage library, which serves as both a concrete implementation and a base class.

### Layer 3: Specialized Implementations
Extends the base implementation for specific storage backends (e.g., RedisSessionStore).

### TTL Management

The storage architecture includes a sophisticated TTL (time-to-live) management system:

```typescript
protected getTTL(session: T): number {
  if (typeof this.ttl === 'function') {
    return this.ttl(session);
  }
  return this.ttl;
}
```

This allows both static TTL values and dynamic TTL calculation based on session content, enabling use cases like:
- Longer sessions for "remember me" functionality
- Different TTLs based on user roles or permissions
- Adaptive session length based on activity patterns

## Security Architecture

### 1. Cookie Signing

Sessions use cryptographically signed cookies to prevent tampering:

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  Session ID   │────►│  Sign Cookie  │────►│ Signed Cookie │
│               │     │  (HMAC-SHA256)│     │   Value       │
└───────────────┘     └───────────────┘     └───────────────┘
```

### 2. Secret Rotation

The architecture supports multiple secrets for key rotation:

```typescript
const normalizedSecrets = Array.isArray(sessionConfig.secret) 
  ? sessionConfig.secret 
  : [sessionConfig.secret];

// Latest secret is used for signing
signedCookie = await signCookie(
  sid2, 
  normalizedSecrets[normalizedSecrets.length - 1]
);

// All secrets are tried for verification
const unsignResult = rawCookie 
  ? await unsignCookie(rawCookie, normalizedSecrets) 
  : null;
```

This enables smooth secret rotation without invalidating existing sessions.

### 3. Session Fixation Protection

The architecture includes session regeneration capabilities to prevent session fixation attacks:

```typescript
async regenerate() {
  await this.#store.destroy(this.#id);
  const { data, id } = await this.#generate();
  this.#data = Object.freeze({ ...data });
  this.#id = id;
  await Promise.all([this.#cookie.setSessionId(id), this.save()]);
}
```

### 4. Secure Cookie Configuration

Default cookie settings prioritize security:

```typescript
const sessionConfig = defu(config, {
  name: 'connect.sid',
  genid: () => randomUUID(),
  generate: () => ({} as T),
  cookie: { path: '/', httpOnly: true, secure: true, maxAge: null },
  saveUninitialized: false,
});
```

## Extension Points

The architecture provides several extension points for customization:

### 1. Custom Session Stores

Developers can implement the SessionStore interface to create custom storage backends:

```typescript
class CustomSessionStore implements SessionStore<MySessionType> {
  // Implementation of required methods
}
```

### 2. Session Data Generation

The session generation process can be customized:

```typescript
const sessionConfig: H3SessionOptions = {
  // Custom session ID generation
  genid: (event) => `custom-${Date.now()}-${Math.random()}`,
  
  // Custom initial session data
  generate: () => ({ 
    created: new Date(),
    visits: 0,
    customData: {}
  })
}
```

### 3. TTL Configuration

Session TTL can be customized with static values or dynamic functions:

```typescript
// Static TTL
const store = new UnstorageSessionStore(storage, { ttl: 3600 });

// Dynamic TTL based on session data
const store = new UnstorageSessionStore(storage, {
  ttl: (session) => session.rememberMe ? 7 * 24 * 3600 : 3600
});
```

### 4. Cookie Configuration

Session cookies can be extensively customized:

```typescript
const sessionConfig: H3SessionOptions = {
  cookie: {
    maxAge: 7 * 24 * 60 * 60, // 1 week
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    domain: '.example.com'
  }
}
```

## Architecture Decision Records

### ADR-1: Immutable Session Data

**Context:** Session data is shared across multiple request handlers and manipulated throughout the request lifecycle.

**Decision:** Implement session data as immutable using Object.freeze() and provide explicit methods for updates.

**Consequences:** 
- Positive: Prevents accidental mutations and ensures consistent state
- Positive: Makes changes trackable and explicit
- Negative: Slightly higher memory usage from creating new objects

### ADR-2: Pluggable Storage Backend

**Context:** Different applications have varying requirements for session storage (memory, Redis, database).

**Decision:** Implement a storage interface with multiple implementations, using the unstorage library as an abstraction layer.

**Consequences:**
- Positive: Flexibility to use different storage backends
- Positive: Consistent API across storage implementations
- Negative: Additional abstraction layer adds complexity

### ADR-3: H3 Context Integration

**Context:** Need to make session data accessible throughout the H3 request lifecycle.

**Decision:** Attach session and session handler to the H3 event context during middleware execution.

**Consequences:**
- Positive: Simple access to session data from any handler
- Positive: Consistent pattern for accessing session data
- Negative: Creates implicit dependency on middleware execution order

### ADR-4: Cookie-Based Session Identification

**Context:** Need a reliable way to identify sessions across requests.

**Decision:** Use HTTP cookies with cryptographic signatures for session identification.

**Consequences:**
- Positive: Standard, well-tested approach to session management
- Positive: Works across most clients and environments
- Negative: Limited by cookie size restrictions
- Negative: Requires CSRF protection for security

## Trade-offs and Considerations

The @analog-tools/session architecture makes several key trade-offs:

1. **Simplicity vs. Flexibility**
   - Provides a simple API while enabling advanced customization
   - Default configurations work for most cases, but specialized needs require deeper integration

2. **Performance vs. Security**
   - Cookie signing adds security but incurs performance overhead
   - In-memory storage is faster but less durable than distributed options

3. **Tight H3 Integration vs. Framework Agnosticism**
   - Optimized for H3 ecosystem but limited to H3-based applications
   - Deeply integrated with H3 context for convenience

4. **Type Safety vs. Dynamic Flexibility**
   - Strong TypeScript typing improves developer experience but requires explicit type definitions
   - Generic types provide flexibility while maintaining type safety

## Conclusion

The @analog-tools/session architecture provides a robust, flexible foundation for session management in H3-based applications. Its design emphasizes type safety, immutability, and pluggable components, enabling a wide range of use cases from simple sites to complex applications with specialized requirements. The architecture balances performance, security, and developer experience while providing clear extension points for customization.
