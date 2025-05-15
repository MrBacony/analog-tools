# @analog-tools/logger

> **⚠️ IMPORTANT: Early Development Stage** ⚠️  
> This project is in its early development stage. Breaking changes may happen frequently as the APIs evolve. Use with caution in production environments.

A minimal, type-safe logging utility for server-side applications in AnalogJS, Nitro and H3-based environments. Designed for full compatibility with the @analog-tools/inject package for easy dependency injection.

[![npm version](https://img.shields.io/npm/v/@analog-tools/logger.svg)](https://www.npmjs.com/package/@analog-tools/logger)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Features

- 📝 Type-safe log levels: `trace`, `debug`, `info`, `warn`, `error`, `fatal`
- 🔌 Pluggable transports for console, file, or remote logging
- 🧩 Seamless integration with @analog-tools/inject for dependency injection
- 🌳 Context-based logging with child loggers
- 🔄 Extendable and customizable for different environments
- 📦 Built on Pino for high-performance logging

## Installation

```bash
# Using npm
npm install @analog-tools/logger

# Using pnpm
pnpm add @analog-tools/logger

# Using yarn
yarn add @analog-tools/logger
```

## Quick Start

Here's a basic example of using the logger:

```typescript
import { LoggerService } from '@analog-tools/logger';

// Create a logger instance
const logger = new LoggerService({
  level: 'info',
  name: 'my-app',
});

// Log at different levels
logger.debug('Debug message');
logger.info('Info message', { userId: 123 });
logger.warn('Warning message');
logger.error('Error occurred', new Error('Something went wrong'));
```

## Usage with @analog-tools/inject

```typescript
import { inject, registerService } from '@analog-tools/inject';
import { LoggerService } from '@analog-tools/logger';

// Optional: Register with custom configuration
registerService(LoggerService, {
  level: 'debug',
  prettyPrint: true,
});

// Inject in your services or API routes
class UserService {
  static INJECTABLE = true;

  private logger = inject(LoggerService);

  getUser(id: string) {
    this.logger.info(`Getting user with id ${id}`, { userId: id });
    // Implementation...
  }
}
```

## Usage in AnalogJS API Routes

```typescript
// src/server/routes/api/users/[id].ts
import { defineEventHandler, getRouterParam } from 'h3';
import { inject } from '@analog-tools/inject';
import { LoggerService } from '@analog-tools/logger';

export default defineEventHandler((event) => {
  const logger = inject(LoggerService);
  const userId = getRouterParam(event, 'id');

  logger.info(`User endpoint called for ID: ${userId}`, {
    userId,
    path: event.node.req.url,
  });

  // Route implementation...
  return { id: userId, name: 'Example User' };
});
```

## Context-Based Logging

Create child loggers for specific contexts:

```typescript
// Main logger
const logger = new LoggerService();

// Create context-specific loggers
const authLogger = logger.forContext('auth');
const dbLogger = logger.forContext('database');

// Usage
authLogger.info('User logged in'); // Logs with context: 'auth'
dbLogger.error('Database connection failed'); // Logs with context: 'database'
```

## API Reference

### `LoggerService`

The main logger class:

```typescript
class LoggerService implements ILogger {
  constructor(config?: LoggerConfig);

  forContext(context: string): ILogger;
  trace(message: string, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, error?: Error | unknown, data?: Record<string, unknown>): void;
  fatal(message: string, error?: Error | unknown, data?: Record<string, unknown>): void;
}
```

### `LoggerConfig`

Configuration options:

```typescript
interface LoggerConfig {
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';
  name?: string;
  prettyPrint?: boolean;
  transport?: Record<string, unknown>;
}
```

## Best Practices

1. **Use structured logging**: Pass structured data as the second parameter instead of string concatenation
2. **Create context-specific loggers**: Use `forContext()` to create loggers for different parts of your application
3. **Configure log levels appropriately**: Use `trace` and `debug` for development, `info` and above for production
4. **Log meaningful errors**: Include the actual Error object in error logs, not just messages
5. **Use dependency injection**: Leverage @analog-tools/inject for cleaner code organization

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
