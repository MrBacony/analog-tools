# Migration: Symbol-based Service Tokens

## Overview

As of v2.0, `@analog-tools/inject` requires all injectable classes to use the `@Injectable()` decorator. This change fixes class-name mangling issues in production builds and improves type safety.

## Breaking Change

The legacy `static INJECTABLE = true` pattern is **no longer supported**.

## Migration Steps

### Before (Legacy)

```typescript
class MyService {
  static INJECTABLE = true;

  doSomething() {
    return 'Hello, World!';
  }
}

// Usage
registerService(MyService);
const service = inject(MyService);
```

### After (New)

```typescript
import { Injectable, inject, registerService } from '@analog-tools/inject';

@Injectable()
class MyService {
  doSomething() {
    return 'Hello, World!';
  }
}

// Usage (unchanged)
registerService(MyService);
const service = inject(MyService);
```

## Key Changes

1. **Add `@Injectable()` decorator** to all service classes.
2. **No changes to usage** — `inject()` and `registerService()` APIs remain the same.
3. **No `reflect-metadata` required** — `@Injectable()` is a plain decorator with no metadata dependencies.
4. **Improved error messages** — Missing `@Injectable()` now produces a clear error.

## Examples

### Basic Service

```typescript
import { Injectable } from '@analog-tools/inject';

@Injectable()
class DatabaseService {
  query(sql: string) {
    // ...
  }
}
```

### Service with Constructor Parameters

```typescript
import { Injectable, registerService, inject } from '@analog-tools/inject';

interface Config {
  apiUrl: string;
}

@Injectable()
class ApiService {
  constructor(private config: Config) {}

  fetchData() {
    // uses this.config.apiUrl
  }
}

// Register with config
const config: Config = { apiUrl: 'https://api.example.com' };
registerService(ApiService, config);

// Inject
const api = inject(ApiService);
api.fetchData();
```

### Custom Tokens (Optional)

If you need a specific token for a service, pass it to the decorator:

```typescript
const MY_TOKEN = Symbol('MyService');

@Injectable(MY_TOKEN)
class MyService {}
```

## Troubleshooting

### Error: "Service 'MyService' is missing SERVICE_TOKEN"

**Solution:** Add the `@Injectable()` decorator to your service class.

```typescript
// ❌ Wrong
class MyService {}

// ✅ Correct
@Injectable()
class MyService {}
```

### Error: "Cannot find SERVICE_TOKEN"

**Cause:** The `SERVICE_TOKEN` symbol is not imported.

**Solution:** Ensure `@Injectable()` is imported:

```typescript
import { Injectable } from '@analog-tools/inject';
```

## Q&A

**Q: Do I need `emitDecoratorMetadata` or `reflect-metadata`?**  
A: No. `@Injectable()` works without decorator metadata. Decorators are purely for marking classes.

**Q: Can I use both old and new syntax?**  
A: No. The package now requires all services to use `@Injectable()`.

**Q: Will TypeScript compilation fail without `@Injectable()`?**  
A: No, but injecting a non-decorated service will throw a runtime error.

## Support

For issues or questions, please open an issue on the repository.
