# @analog-tools/inject

> **Production Ready** — Stable DI system for AnalogJS and H3/Nitro server-side applications.

A dependency injection system for AnalogJS and H3/Nitro server-side applications. Provides both global singleton semantics and scoped registries for test isolation and multi-tenant scenarios. Uses symbol-based tokens (via `@Injectable()` decorator) and lazy auto-registration.

[![npm version](https://img.shields.io/npm/v/@analog-tools/inject.svg)](https://www.npmjs.com/package/@analog-tools/inject)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Usage](#usage)
  - [Defining Injectable Services](#defining-injectable-services)
  - [Registering Services with Constructor Arguments](#registering-services-with-constructor-arguments)
  - [Injecting Dependencies Within Services](#injecting-dependencies-within-services)
  - [Optional Injection](#optional-injection)
  - [Async Initialization](#async-initialization)
- [Lifecycle Management](#lifecycle-management)
- [API Reference](#api-reference)
- [Testing Utilities](#testing-utilities)
- [Scoped Injection](#scoped-injection)
- [Usage with AnalogJS](#usage-with-analogjs)
- [Migration from v1](#migration-from-v1)
- [Limitations](#limitations)

## Installation

```bash
npm install @analog-tools/inject
```

## Quick Start

```typescript
import { Injectable, inject, registerService } from '@analog-tools/inject';

// 1. Mark class as injectable
@Injectable()
class DatabaseService {
  query(sql: string) {
    // ...
  }
}

// 2. Register with constructor args (if any)
registerService(DatabaseService);

// 3. Inject anywhere
const db = inject(DatabaseService);
db.query('SELECT * FROM users');
```

## How It Works

The package manages service registries using a scoped architecture. By default, all services are registered in a `default` scope (global singleton):

1. Mark a class with `@Injectable()` — this creates a unique symbol token for that class.
2. When you call `inject(MyService)`, it looks up the service by its symbol token.
3. If no instance exists yet, one is created using the class constructor.
4. The same instance is returned on all subsequent `inject()` calls within that scope.

Symbol-based tokens are **minification-safe** — class names in production builds won't affect service lookup.

## Usage

### Defining Injectable Services

Use the `@Injectable()` decorator to mark a class as injectable:

```typescript
import { Injectable, inject } from '@analog-tools/inject';

@Injectable()
class DatabaseService {
  private pool: ConnectionPool;

  constructor() {
    this.pool = createPool({ /* ... */ });
  }

  async query(sql: string, params: unknown[] = []): Promise<unknown[]> {
    return this.pool.execute(sql, params);
  }
}

// First call creates the instance; subsequent calls return the same one
const db = inject(DatabaseService);
```

> **Note:** TypeScript decorators require `"target": "ES2015"` or later in `tsconfig.json`. No `emitDecoratorMetadata` or `reflect-metadata` required.

### Registering Services with Constructor Arguments

When a service needs configuration at creation time, register it explicitly:

```typescript
import { Injectable, registerService, inject } from '@analog-tools/inject';

@Injectable()
class CacheService {
  constructor(
    private readonly ttlSeconds: number,
    private readonly prefix: string
  ) {}

  getKey(key: string): string {
    return `${this.prefix}:${key}`;
  }
}

// Register with constructor args before first use
registerService(CacheService, 300, 'app');

// Now inject anywhere -- returns the instance created above
const cache = inject(CacheService);
cache.getKey('session'); // "app:session"
```

Registration is idempotent: calling `registerService()` again for an already-registered service is a no-op. The first registration wins.

### Injecting Dependencies Within Services

Services can inject other services as instance properties:

```typescript
import { Injectable, inject } from '@analog-tools/inject';

@Injectable()
class UserRepository {
  private db = inject(DatabaseService);

  async findById(id: string) {
    const rows = await this.db.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return rows[0];
  }
}

@Injectable()
class DatabaseService {
  async query(sql: string, params: unknown[]): Promise<unknown[]> {
    // implementation
  }
}
```

The dependency (`DatabaseService`) is resolved when `UserRepository` is first instantiated. If `DatabaseService` hasn't been registered yet, it will be auto-registered using its no-arg constructor.

### Optional Injection

For services that might not be available, pass `{ required: false }`:

```typescript
const analytics = inject(AnalyticsService, { required: false });
if (analytics) {
  analytics.track('page_view');
}
```

When `required` is `false` and the service is not registered (or was registered as undefined), `inject()` returns `undefined` instead of throwing.

### Async Initialization

For services that need asynchronous setup (connecting to databases, loading configuration, etc.), implement the `AsyncInjectableService` interface with an `initializeAsync()` method:

```typescript
import { Injectable, injectAsync, registerAsync } from '@analog-tools/inject';
import type { AsyncInjectableService } from '@analog-tools/inject';

@Injectable()
class DatabaseService implements AsyncInjectableService {
  private connection: Connection | null = null;

  async initializeAsync(): Promise<void> {
    this.connection = await createConnection({
      host: 'localhost',
      port: 5432,
      database: 'myapp',
    });
  }

  query(sql: string): Promise<unknown[]> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }
    return this.connection.query(sql);
  }
}
```

**Registering and injecting async services:**

Use `registerAsync()` during application startup to eagerly initialize services:

```typescript
// Application startup
await registerAsync(DatabaseService);

// Services are now initialized and ready to use
const db = inject(DatabaseService);
await db.query('SELECT 1');
```

Or use `injectAsync()` on-demand to ensure initialization before use:

```typescript
const db = await injectAsync(DatabaseService);
await db.query('SELECT * FROM users');
```

**Key behaviors:**
- Services **without** `initializeAsync()` work fine with `injectAsync()` (no-op initialization)
- Initialization promises are **deduplicated** — concurrent calls to `injectAsync()` for the same service share a single initialization promise
- Failed initialization attempts are **not cached** — subsequent calls will retry initialization
- The sync `inject()` function does **not** await async initialization; use `injectAsync()` for async services
- Scoped injection (`injectScoped()`) returns uninitialized instances; use `injectAsync()` on scoped services, or call `initializeAsync()` manually

## Lifecycle Management

For services managing external resources (database connections, file handles, timers, etc.), implement the `onDestroy()` lifecycle hook to ensure proper cleanup:

```typescript
import { Injectable } from '@analog-tools/inject';
import type { AsyncInjectableService } from '@analog-tools/inject';

@Injectable()
class DatabaseService implements AsyncInjectableService {
  private connection: Connection | null = null;

  async initializeAsync(): Promise<void> {
    this.connection = await createConnection({
      host: 'localhost',
      database: 'myapp',
    });
  }

  async onDestroy(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }

  async query(sql: string): Promise<unknown[]> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }
    return this.connection.query(sql);
  }
}
```

### Destroying Services

Use `destroyAllServicesAsync()` during application shutdown to invoke `onDestroy()` hooks and clean up resources:

```typescript
import { destroyAllServicesAsync } from '@analog-tools/inject';

// Application shutdown handler
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  try {
    await destroyAllServicesAsync();
    console.log('All services cleaned up');
    process.exit(0);
  } catch (error) {
    console.error('Cleanup failed:', error);
    process.exit(1);
  }
});
```

### Real-World Examples

**File Handling Service:**

```typescript
@Injectable()
class FileService implements AsyncInjectableService {
  private fileHandle: FileHandle | null = null;

  async initializeAsync(): Promise<void> {
    const tempDir = path.join(os.tmpdir(), 'myapp');
    await fs.mkdir(tempDir, { recursive: true });
    this.fileHandle = await fs.open(
      path.join(tempDir, 'app.log'),
      'a'
    );
  }

  async onDestroy(): Promise<void> {
    if (this.fileHandle) {
      await this.fileHandle.close();
      this.fileHandle = null;
    }
  }

  async write(message: string): Promise<void> {
    if (!this.fileHandle) {
      throw new Error('FileService not initialized');
    }
    await this.fileHandle.writeFile(message + '\n');
  }
}
```

**Timer/Scheduler Service:**

```typescript
@Injectable()
class SchedulerService implements AsyncInjectableService {
  private intervals: NodeJS.Timeout[] = [];

  async initializeAsync(): Promise<void> {
    // Setup any background tasks
  }

  async onDestroy(): Promise<void> {
    // Clear all intervals
    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals = [];
  }

  schedule(callback: () => void, ms: number): void {
    const interval = setInterval(callback, ms);
    this.intervals.push(interval);
  }
}
```

**Cache Service with Expiration:**

```typescript
@Injectable()
class CacheService implements AsyncInjectableService {
  private cache = new Map<string, { value: unknown; expiresAt: number }>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  async initializeAsync(): Promise<void> {
    // Run cleanup every 60 seconds
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (entry.expiresAt < now) {
          this.cache.delete(key);
        }
      }
    }, 60000);
  }

  async onDestroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.cache.clear();
  }

  set(key: string, value: unknown, ttlSeconds: number): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  get(key: string): unknown {
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.value;
    }
    this.cache.delete(key);
    return undefined;
  }
}
```

### Error Handling

If an `onDestroy()` hook fails, cleanup continues for other services and errors are aggregated:

```typescript
import { AggregateDestructionError, destroyAllServicesAsync } from '@analog-tools/inject';

try {
  await destroyAllServicesAsync();
} catch (error) {
  if (error instanceof AggregateDestructionError) {
    console.error(`Cleanup failed for ${error.failures.length} service(s):`);
    error.failures.forEach((failure) => {
      console.error(
        `  ${failure.serviceName}: ${failure.error.message}`
      );
    });

    // Check if a specific service failed
    if (error.hasFailure('DatabaseService')) {
      console.error('Database cleanup failed - may have connection leaks');
    }
  } else {
    throw error;
  }
}
```

### Scoped Cleanup

For scoped services, use the async scoped destruction APIs:

```typescript
import { InjectionContext } from '@analog-tools/inject';

// Cleanup a specific scope
await InjectionContext.destroyScopeAsync('tenant-123');

// Cleanup all scopes (useful in test teardown)
afterEach(async () => {
  await InjectionContext.clearAllAsync();
});
```

## API Reference

### `inject<T>(token, options?): T`

Retrieves a service instance from the registry. Auto-registers the service (with no constructor args) if not already present.

| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | `InjectionServiceClass<T>` | The service class to inject (must be decorated with `@Injectable()`) |
| `options.required` | `boolean` (default: `true`) | Throw if service is not found |

Throws `MissingServiceTokenError` if the class is not decorated with `@Injectable()`, or throws `InjectionError` if `required` is `true` and the service resolves to `undefined`.

### `registerService<T>(token, ...args): void`

Creates and registers a singleton instance of the service with the given constructor arguments.

| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | `InjectionServiceClass<T>` | The service class to register (must be decorated with `@Injectable()`) |
| `...args` | `ConstructorParameters` | Arguments passed to the class constructor |

No-op if the service is already registered with a defined value.

### `registerServiceAsUndefined<T>(token): void`

Registers a service as `undefined` in the registry. Primarily used in tests to verify behavior when a dependency is missing.

| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | `InjectionServiceClass<T>` | The service class to register as undefined |

Throws `MissingServiceTokenError` if the class is not decorated with `@Injectable()`.

### `injectAsync<T>(token, options?): Promise<T>`

Retrieves and initializes an async service instance. Ensures `initializeAsync()` is called and completes before returning.

| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | `InjectionServiceClass<T>` | The service class to inject (must have `@Injectable()`) |
| `options.required` | `boolean` (default: `true`) | Throw if service is not found or initialization fails |

Returns a promise that resolves to the initialized service instance. If the service does not implement `initializeAsync()`, it still works — initialization is a no-op.

Concurrent calls return the same initialization promise, preventing duplicate initialization work.

### `registerAsync<T>(token, ...args): Promise<void>`

Registers and eagerly initializes a service during application startup. Use this in your app's bootstrap to ensure services are ready before handling requests.

| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | `InjectionServiceClass<T>` | The service class to register (must have `@Injectable()`) |
| `...args` | `ConstructorParameters` | Arguments passed to the class constructor |

After this resolves, the service is fully initialized and can be injected via `inject()` or `injectAsync()`.

### `destroyAllServicesAsync(): Promise<void>`

Destroys all services in the global registry, invoking `onDestroy()` lifecycle hooks for proper resource cleanup. Aggregates errors from multiple failed cleanups.

Use this during application shutdown to ensure all resources are properly released.

```typescript
process.on('SIGTERM', async () => {
  await destroyAllServicesAsync();
  process.exit(0);
});
```

Throws `AggregateDestructionError` if one or more services fail during destruction. Use the `failures` property to inspect individual errors.

### `AggregateDestructionError`

Error thrown when one or more services fail during destruction. Contains all individual errors for debugging.

**Properties:**
- `failures: Array<{ serviceName: string; error: Error }>` — List of services that failed with their errors
- `getErrors(): Error[]` — Get all underlying errors as an array
- `hasFailure(serviceName: string): boolean` — Check if a specific service failed

**Example:**

```typescript
try {
  await destroyAllServicesAsync();
} catch (error) {
  if (error instanceof AggregateDestructionError) {
    error.failures.forEach((failure) => {
      console.error(`${failure.serviceName}: ${failure.error.message}`);
    });
  }
}
```

### Scoped Async Cleanup

For scoped destruction with lifecycle hook support:

| Function | Description |
|----------|-------------|
| `InjectionContext.destroyScopeAsync(scope)` | Destroy scope and invoke `onDestroy()` hooks for async services |
| `InjectionContext.clearAllAsync()` | Destroy all scopes asynchronously, aggregating errors across all scopes |

**Example:**

```typescript
await InjectionContext.destroyScopeAsync('my-scope');
```

### `registerMockService<T>(token, partial): void`

Registers a partial object as the service instance. Intended for tests where you only need to stub specific methods.

| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | `InjectionServiceClass<T>` | The service class to mock |
| `partial` | `Partial<T>` | Object used as the service instance |

### `resetAllInjections(): void`

Clears all entries from the service registry. Call this in test teardown (`afterEach`) to isolate tests from each other.

### `hasService<T>(token): boolean`

Checks if a service is registered in the global registry without attempting to create it.

| Parameter | Type | Description |
|-----------|------|-------------||
| `token` | `InjectionServiceClass<T>` | The service class to check (must be decorated with `@Injectable()`) |

Returns `true` if the service is registered with a defined value, `false` otherwise. Never throws an error.

**Example:**

```typescript
if (hasService(DatabaseService)) {
  const db = inject(DatabaseService);
}
```

### `tryInject<T>(token): T | undefined`

Attempts to inject a service, returning `undefined` if not available. A safer alternative to `inject(token, { required: false })`.

| Parameter | Type | Description |
|-----------|------|-------------||
| `token` | `InjectionServiceClass<T>` | The service class to inject (must be decorated with `@Injectable()`) |

Never throws an error. Returns `undefined` if the service is not registered or resolves to `undefined`.

**Example:**

```typescript
const analytics = tryInject(AnalyticsService);
if (analytics) {
  analytics.track('event');
}
```

### Error Types

#### `InjectionError`

Base error class thrown by injection functions when injection fails.

**Properties:**
- `token: InjectionServiceClass<unknown>` — The service class that failed to inject
- `cause?: Error` — Underlying error that caused the injection failure

**Example:**

```typescript
try {
  const service = inject(MyService);
} catch (error) {
  if (error instanceof InjectionError) {
    console.error(`Failed to inject ${error.token.name}: ${error.message}`);
  }
}
```

#### `MissingServiceTokenError`

Thrown when attempting to inject a class that is not decorated with `@Injectable()`.

**Example:**

```typescript
class NotDecorated {}

try {
  inject(NotDecorated);  // Throws MissingServiceTokenError
} catch (error) {
  if (error instanceof MissingServiceTokenError) {
    console.error(`${error.message} — add @Injectable() decorator`);
  }
}
```

### Symbol-based Tokens

To access or create custom service tokens:

```typescript
import { SERVICE_TOKEN, Injectable, createServiceToken, AsyncInjectableService } from '@analog-tools/inject';

// SERVICE_TOKEN is the symbol used by @Injectable()
const token: symbol = MyService[SERVICE_TOKEN];

// Create custom tokens (advanced use cases)
const MY_TOKEN = createServiceToken('MyService');

@Injectable(MY_TOKEN)
class MyService {}

// Interface for async services
const asyncService: AsyncInjectableService = {
  initializeAsync: async () => {
    // async setup
  }
};
```

## Testing Utilities

`registerMockService` and `resetAllInjections` are exported from the package for use in tests:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Injectable, inject, registerMockService, resetAllInjections } from '@analog-tools/inject';

@Injectable()
class NotificationService {
  send(userId: string, message: string): void {
    // production implementation
  }
}

@Injectable()
class OrderService {
  private notifications = inject(NotificationService);

  placeOrder(userId: string, item: string): void {
    // ... order logic ...
    this.notifications.send(userId, `Order placed: ${item}`);
  }
}

describe('OrderService', () => {
  const mockNotifications = {
    send: vi.fn(),
  };

  afterEach(() => {
    resetAllInjections();
    vi.clearAllMocks();
  });

  it('sends a notification when an order is placed', () => {
    registerMockService(NotificationService, mockNotifications);

    const orders = inject(OrderService);
    orders.placeOrder('user-1', 'Widget');

    expect(mockNotifications.send).toHaveBeenCalledWith(
      'user-1',
      'Order placed: Widget'
    );
  });
});
```

## Scoped Injection

For test isolation or multi-tenant scenarios, use scoped injection to create independent service registries:

### Basic Scoped Usage

```typescript
import {
  InjectionContext,
  registerServiceScoped,
  injectScoped,
} from '@analog-tools/inject';

// Create a named scope
InjectionContext.createScope('my-scope');

// Register and inject within scope
registerServiceScoped(MyService, 'my-scope', 'config-value');
const service = injectScoped(MyService, 'my-scope');

// Cleanup when done
InjectionContext.destroyScope('my-scope');
```

### Test Isolation Example

Use scoped injection for complete test isolation without affecting other tests:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import {
  InjectionContext,
  Injectable,
  registerServiceScoped,
  injectScoped,
  registerMockServiceScoped,
  resetScopedInjections,
} from '@analog-tools/inject';

@Injectable()
class DatabaseService {
  constructor(private dbUrl: string) {}

  async query(sql: string): Promise<unknown[]> {
    // database implementation
  }
}

@Injectable()
class UserRepository {

  // Accept the scope as a parameter and use injectScoped for dependencies
  constructor(private scope: string = 'default') {}

  private get db() {
    return injectScoped(DatabaseService, this.scope);
  }

  async findById(id: string) {
    return this.db.query(`SELECT * FROM users WHERE id = '${id}'`);
  }
}

describe('UserRepository with scope isolation', () => {
  const TEST_SCOPE = 'user-repo-test';

  afterEach(() => {
    resetScopedInjections(TEST_SCOPE);
  });

  it('should query the database', () => {
    // Create scope and register services within that scope
    InjectionContext.createScope(TEST_SCOPE);
    registerServiceScoped(DatabaseService, TEST_SCOPE, 'postgres://test');
    registerServiceScoped(UserRepository, TEST_SCOPE, TEST_SCOPE);

    // Inject from the test scope - both parent and dependencies resolve from same scope
    const repo = injectScoped(UserRepository, TEST_SCOPE);
    // ...test assertions...
  });

  it('should handle missing users', () => {
    InjectionContext.createScope(TEST_SCOPE);

    const mockDb = {
      query: async () => [],
    };

    // Register services in the test scope
    registerMockServiceScoped(DatabaseService, mockDb, TEST_SCOPE);
    registerServiceScoped(UserRepository, TEST_SCOPE, TEST_SCOPE);

    // Inject UserRepository from test scope - it finds mocked DatabaseService in same scope
    const repo = injectScoped(UserRepository, TEST_SCOPE);
    // ...test assertions...
  });
});
```

**Key Points for Scope Awareness:**
- When using `injectScoped(UserRepository, TEST_SCOPE)`, the `UserRepository` instance is created from that scope.
- If `UserRepository` uses `inject(DatabaseService)` in its constructor (default scope), it creates a **scope mismatch** — the dependency won't be found in the test scope.
- **Solution:** Either:
  1. Pass the scope to `UserRepository` so it can use `injectScoped(DatabaseService, scope)` for its own dependencies, OR
  2. Register `DatabaseService` in **both** the test scope (for the test) and the default scope (for constructor injection at creation time), OR
  3. Use lazy property injection (shown above with a private `get db()` accessor) that resolves dependencies on access

### Hierarchical Scopes (Multi-tenant Example)

Use scoped injection to support multiple tenants with isolated service instances:

```typescript
import {
  InjectionContext,
  Injectable,
  registerServiceScoped,
  injectScoped,
} from '@analog-tools/inject';

@Injectable()
class TenantService {
  constructor(public tenantId: string) {}

  async getConfig() {
    // Fetch tenant-specific configuration
  }
}

// Setup function for each tenant
function setupTenant(tenantId: string) {
  InjectionContext.createScope(`tenant-${tenantId}`);
  registerServiceScoped(TenantService, `tenant-${tenantId}`, tenantId);
}

// API handler
export async function getTenantData(tenantId: string) {
  setupTenant(tenantId);

  const tenant = injectScoped(TenantService, `tenant-${tenantId}`);
  const config = await tenant.getConfig();

  // Cleanup tenant scope when done
  InjectionContext.destroyScope(`tenant-${tenantId}`);

  return config;
}
```

### API Reference: Scoped Functions

| Function | Description |
|----------|-------------|
| `InjectionContext.createScope(name)` | Create a new named scope |
| `InjectionContext.destroyScope(name)` | Destroy scope and cleanup all services |
| `InjectionContext.clearAll()` | Clear all scopes (useful in global test teardown) |
| `InjectionContext.getActiveScopes()` | Get list of all active scope names |
| `registerServiceScoped(token, scope, ...args)` | Register service in specific scope |
| `injectScoped(token, scope, options?)` | Inject service from specific scope |
| `registerServiceAsUndefinedScoped(token, scope)` | Register service as undefined in scope |
| `registerMockServiceScoped(token, partial, scope)` | Register mock service in scope |
| `resetScopedInjections(scope)` | Clear all services in a scope |

> **Note:** Scoped resolution is **scope-only** -- services do not inherit from parent or default scopes. Each scope has its own independent registry.

## Usage with AnalogJS

In AnalogJS API routes (H3 event handlers), inject services directly:

```typescript
// src/server/routes/api/users/[id].ts
import { defineEventHandler, getRouterParam } from 'h3';
import { Injectable, inject } from '@analog-tools/inject';

@Injectable()
class UserRepository {
  async findById(id: string) {
    // implementation
  }
}

export default defineEventHandler(async (event) => {
  const userId = getRouterParam(event, 'id');
  const users = inject(UserRepository);

  return users.findById(userId!);
});
```

Since services use the default scope, the same instance is shared across all requests within the same server process.

For multi-tenant applications, use [scoped injection](#scoped-injection) to provide isolated service instances per tenant:

```typescript
import { defineEventHandler } from 'h3';
import { InjectionContext, registerServiceScoped, injectScoped, Injectable } from '@analog-tools/inject';

@Injectable()
class TenantService {
  constructor(private tenantId: string) {}

  async getData() {
    // tenant-specific logic
  }
}

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId; // From auth middleware

  // Setup tenant scope if needed
  if (!InjectionContext.getActiveScopes().includes(`tenant-${tenantId}`)) {
    InjectionContext.createScope(`tenant-${tenantId}`);
    registerServiceScoped(TenantService, `tenant-${tenantId}`, tenantId);
  }

  // Use tenant-specific services
  const tenant = injectScoped(TenantService, `tenant-${tenantId}`);
  return tenant.getData();
});
```

## Migration from v1

If you're upgrading from v1.x, see [**Migration Guide: Symbol-based Service Tokens**](docs/migrations/symbol-tokens.md) for detailed upgrade instructions.

**Quick summary:**
- Replace `static INJECTABLE = true` with `@Injectable()` decorator
- No changes to `inject()` or `registerService()` APIs
- No `reflect-metadata` or `emitDecoratorMetadata` needed


## Limitations

- **No circular dependency detection** in the current public API. If service A injects service B which injects service A, you will get a stack overflow.
- **Constructor args are not type-checked end-to-end** -- the `registerService` generic does its best, but complex constructor signatures may require explicit type annotations.
- **Class name collisions** -- Two injectable classes with the same name will have distinct symbol tokens, so collisions are prevented. However, if you deliberately create custom tokens with `createServiceToken()`, ensure token names are unique across your application.
- **Scoped async initialization** -- `injectScoped()` does not await `initializeAsync()`. For async services in scoped contexts, call `injectAsync()` or manually call `initializeAsync()` after `injectScoped()`.
- **Parallel test execution** -- scoped registries are stored in a static `Map`. If tests run in parallel (e.g., worker threads), use unique scope names per test file to avoid interference.

## License

MIT
