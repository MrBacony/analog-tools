# @analog-tools/inject

> **⚠️ IMPORTANT: Early Development Stage** ⚠️  
> This project is in its early development stage. Breaking changes may happen frequently as the APIs evolve. Use with caution in production environments.

A lightweight yet powerful dependency injection system for H3-based server applications (Nitro, AnalogJS), providing a clean, type-safe approach to managing services and dependencies.

[![npm version](https://img.shields.io/npm/v/@analog-tools/inject.svg)](https://www.npmjs.com/package/@analog-tools/inject)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Features

- 🧩 Simple, lightweight dependency injection system
- 🔍 Full TypeScript support with type safety
- 📦 Singleton pattern implementation for services
- 🔄 Automatic lazy initialization of services
- 🛠️ Support for service registration with constructor parameters
- 🧪 Easy to test with mock implementations

## Installation

```bash
# Using npm
npm install @analog-tools/inject

# Using pnpm
pnpm add @analog-tools/inject

# Using yarn
yarn add @analog-tools/inject
```

## Quick Start

Here's a basic example of creating injectable services:

```typescript
import { inject, registerService } from '@analog-tools/inject';

// Define a service class with the INJECTABLE static property
class LoggerService {
  static INJECTABLE = true;

  log(message: string): void {
    console.log(`[Logger] ${message}`);
  }
}

// Define another service that depends on LoggerService
class UserService {
  static INJECTABLE = true;

  private logger = inject(LoggerService);

  getUserInfo(userId: string): void {
    this.logger.log(`Getting info for user: ${userId}`);
    // Implementation...
    return { id: userId, name: 'Example User' };
  }
}

// Usage in your application
const userService = inject(UserService);
const userInfo = userService.getUserInfo('user123');
```

## Usage with AnalogJS

### In API Routes

```typescript
// src/server/routes/api/users/[id].ts
import { defineEventHandler } from 'h3';
import { inject } from '@analog-tools/inject';
import { UserService } from '../../../services/user.service';

export default defineEventHandler(async (event) => {
  const userService = inject(UserService);
  const userId = event.context.params.id;

  const userData = await userService.getUserById(userId);

  return userData;
});
```

### Creating Services

```typescript
// src/server/services/user.service.ts
import { inject } from '@analog-tools/inject';
import { DatabaseService } from './database.service';

export class UserService {
  static INJECTABLE = true;

  private db = inject(DatabaseService);

  async getUserById(id: string) {
    return this.db.query('SELECT * FROM users WHERE id = ?', [id]);
  }

  async createUser(userData: any) {
    // Implementation...
  }
}

// src/server/services/database.service.ts
export class DatabaseService {
  static INJECTABLE = true;

  private connection: any;

  constructor() {
    // Initialize database connection
    this.connection = {}; // Example placeholder
  }

  async query(sql: string, params: any[] = []) {
    // Implementation...
    return [];
  }
}
```

## Advanced Usage

### Using Constructor Parameters

You can pass constructor parameters when registering services:

```typescript
import { registerService } from '@analog-tools/inject';

class ConfigService {
  static INJECTABLE = true;

  constructor(private readonly apiUrl: string) {}

  getApiUrl() {
    return this.apiUrl;
  }
}

// Register with constructor parameters
registerService(ConfigService, 'https://api.example.com');

// Now use it anywhere
const configService = inject(ConfigService);
const apiUrl = configService.getApiUrl(); // Returns 'https://api.example.com'
```

### Optional Injection

If you want to handle cases where a service might not be available:

```typescript
import { inject } from '@analog-tools/inject';

const analytics = inject(AnalyticsService, { required: false });
if (analytics) {
  analytics.trackEvent('page_view');
}
```

## API Reference

### `inject<T>(token: InjectionServiceClass<T>, options?: InjectOptions): T`

The primary method to retrieve a service instance:

- `token`: The class/constructor function of the service to inject
- `options`:
  - `required` (default: `true`): Whether to throw an error if the service doesn't exist

### `registerService<T>(token: InjectionServiceClass<T>, ...properties: any[]): void`

Registers a service with optional constructor parameters:

- `token`: The class/constructor function of the service to register
- `properties`: Any typesafe constructor parameters the service requires

### Making a Class Injectable

For a class to be injectable, it needs the `INJECTABLE` static property:

```typescript
class MyService {
  static INJECTABLE = true;

  // Service implementation...
}
```

## Best Practices

1. **Keep services focused**: Each service should have a single responsibility
2. **Use dependency injection**: Instead of creating service instances directly
3. **Add proper typing**: Leverage TypeScript's type system for better safety
4. **Unit test services**: Use dependency injection to mock service dependencies

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
