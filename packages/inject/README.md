# @analog-tools/inject

> **Early Development Stage** -- Breaking changes may happen frequently as APIs evolve.

A dependency injection system for AnalogJS and H3/Nitro server-side applications. Uses a global service registry with singleton semantics, class-based tokens, and lazy auto-registration.

[![npm version](https://img.shields.io/npm/v/@analog-tools/inject.svg)](https://www.npmjs.com/package/@analog-tools/inject)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Table of Contents

- [Installation](#installation)
- [How It Works](#how-it-works)
- [Usage](#usage)
  - [Defining Injectable Services](#defining-injectable-services)
  - [Registering Services with Constructor Arguments](#registering-services-with-constructor-arguments)
  - [Injecting Dependencies Within Services](#injecting-dependencies-within-services)
  - [Optional Injection](#optional-injection)
  - [Custom Service Names](#custom-service-names)
- [API Reference](#api-reference)
- [Testing Utilities](#testing-utilities)
- [Usage with AnalogJS](#usage-with-analogjs)
- [Limitations](#limitations)

## Installation

```bash
npm install @analog-tools/inject
```

## How It Works

The package maintains a global `ServiceRegistry` that stores singleton service instances keyed by class name. When you call `inject(MyService)`:

1. The registry checks that `MyService` has a static `INJECTABLE` property set to `true` (or a string).
2. If no instance exists yet, one is created using the class constructor (with no arguments by default).
3. The same instance is returned on all subsequent `inject()` calls.

If a service requires constructor arguments, you must call `registerService()` before the first `inject()` call to provide them.

## Usage

### Defining Injectable Services

Mark a class as injectable by adding a static `INJECTABLE` property:

```typescript
import { inject } from '@analog-tools/inject';

class DatabaseService {
  static readonly INJECTABLE = true;

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

### Registering Services with Constructor Arguments

When a service needs configuration at creation time, register it explicitly:

```typescript
import { registerService, inject } from '@analog-tools/inject';

class CacheService {
  static readonly INJECTABLE = true;

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

Registration is idempotent: calling `registerService()` again for an already-registered token is a no-op. The first registration wins.

### Injecting Dependencies Within Services

Services can inject other services as instance properties:

```typescript
class UserRepository {
  static readonly INJECTABLE = true;

  private db = inject(DatabaseService);

  async findById(id: string) {
    const rows = await this.db.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return rows[0];
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

### Custom Service Names

The `INJECTABLE` property can be a string to provide a custom token name. This is useful when class names might be minified in production:

```typescript
class MyService {
  static readonly INJECTABLE = 'MyService';
  // ...
}
```

When `INJECTABLE` is a string, that string is used as the registry key instead of the class's `.name` property.

## API Reference

### `inject<T>(token, options?): T`

Retrieves a service instance from the registry. Auto-registers the service (with no constructor args) if not already present.

| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | `InjectionServiceClass<T>` | The service class to inject |
| `options.required` | `boolean` (default: `true`) | Throw if service is not found |

Throws if the class does not have `INJECTABLE` set to a truthy value, or if `required` is `true` and the service resolves to `undefined`.

### `registerService<T>(token, ...args): void`

Creates and registers a singleton instance of the service with the given constructor arguments.

| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | `InjectionServiceClass<T>` | The service class to register |
| `...args` | `ConstructorParameters` | Arguments passed to the class constructor |

No-op if the service is already registered with a defined value.

### `registerServiceAsUndefined<T>(token): void`

Registers a service as `undefined` in the registry. Primarily used in tests to verify behavior when a dependency is missing.

| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | `InjectionServiceClass<T>` | The service class to register as undefined |

Throws if the class is not injectable.

### `registerMockService<T>(token, partial): void`

Registers a partial object as the service instance. Intended for tests where you only need to stub specific methods.

| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | `InjectionServiceClass<T>` | The service class to mock |
| `partial` | `Partial<T>` | Object used as the service instance |

### `resetAllInjections(): void`

Clears all entries from the service registry. Call this in test teardown (`afterEach`) to isolate tests from each other.

## Testing Utilities

`registerMockService` and `resetAllInjections` are exported from the package for use in tests:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { inject, registerMockService, resetAllInjections } from '@analog-tools/inject';

class NotificationService {
  static readonly INJECTABLE = true;

  send(userId: string, message: string): void {
    // production implementation
  }
}

class OrderService {
  static readonly INJECTABLE = true;

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

## Usage with AnalogJS

In AnalogJS API routes (H3 event handlers), inject services directly:

```typescript
// src/server/routes/api/users/[id].ts
import { defineEventHandler, getRouterParam } from 'h3';
import { inject } from '@analog-tools/inject';
import { UserRepository } from '../../../services/user.repository';

export default defineEventHandler(async (event) => {
  const userId = getRouterParam(event, 'id');
  const users = inject(UserRepository);

  return users.findById(userId!);
});
```

Since services are singletons, the same instance is shared across all requests within the same server process.

## Limitations

- **Global singleton registry** -- all services live in a single process-wide map. There is no per-request or per-scope isolation in the public API.
- **No circular dependency detection** in the current public API. If service A injects service B which injects service A, you will get a stack overflow.
- **Constructor args are not type-checked end-to-end** -- the `registerService` generic does its best, but complex constructor signatures may require explicit type annotations.
- **Class name collisions** -- two different classes with the same `.name` property will conflict in the registry. Use a string `INJECTABLE` token to disambiguate.
- **No async initialization** -- constructors run synchronously. Services that need async setup should expose an `init()` method called separately.

## License

MIT
