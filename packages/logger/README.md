# @analog-tools/logger

> **⚠️ IMPORTANT: Early Development Stage** ⚠️  
> This project is in its early development stage. Breaking changes may happen frequently as the APIs evolve. Use with caution in production environments.

A minimal, type-safe logging utility for server-side applications in AnalogJS, Nitro and H3-based environments. Works standalone or with optional @analog-tools/inject integration for dependency injection patterns.

[![npm version](https://img.shields.io/npm/v/@analog-tools/logger.svg)](https://www.npmjs.com/package/@analog-tools/logger)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm downloads](https://img.shields.io/npm/dm/@analog-tools/logger.svg)](https://www.npmjs.com/package/@analog-tools/logger)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [30-Second Quickstart](#30-second-quickstart)
- [Quick Start](#quick-start)
- [Type Safety](#type-safety)
- [Usage with @analog-tools/inject (Optional)](#usage-with-analog-toolsinject-optional)
- [Usage in AnalogJS API Routes](#usage-in-analogjs-api-routes)
- [Enhanced Error Handling](#enhanced-error-handling)
- [Context-Based Logging](#context-based-logging)
- [API Reference](#api-reference)
- [Environment Variables](#environment-variables)
- [Testing with MockLoggerService](#testing-with-mockloggerservice)
- [Colored Console Output](#colored-console-output)
- [Log Grouping](#log-grouping)
- [Performance Considerations](#performance-considerations)
- [Troubleshooting](#troubleshooting)
- [Migration Guide](#migration-guide)
- [Best Practices](#best-practices)
- [Security Considerations](#security-considerations)
- [Contributing](#contributing)
- [Future Plans](#future-plans)
- [License](#license)

## Features

- 📝 **Type-safe log levels** with `LogLevel` union type: `trace`, `debug`, `info`, `warn`, `error`, `fatal`, `silent`
- 🛡️ **Compile-time type checking** for log level configuration
- ⚠️ **Runtime validation** with graceful fallback for invalid log levels
- 🎯 **IntelliSense support** for log level auto-completion
- 🎨 Colorized console output with color-coding by log level
- 🧩 Seamless integration with @analog-tools/inject for dependency injection
- 🌳 Context-based logging with child loggers
- 🔧 Configurable via environment variables
- 🚫 Context filtering with disabledContexts
- 🌐 Nitro middleware and request handler integration
- 🧪 Mock logger implementation for testing
- 🚀 Lightweight implementation using standard console
- 🔥 **Enhanced Error Handling** with multiple overloads and type safety
- 🛡️ **Structured Error Serialization** with circular reference protection
- 📊 **LogMetadata Support** for structured logging
- 🔄 **Backwards Compatibility** with existing error logging patterns

## Prerequisites

- Node.js 18.13.0 or later
- AnalogJS project or Nitro/H3-based application
- TypeScript 4.8 or later (for full type safety)
- @analog-tools/inject ^0.0.5 (peer dependency)

### Compatibility Matrix

| @analog-tools/logger | AnalogJS | Node.js | TypeScript |
|---------------------|----------|---------|------------|
| 0.0.5               | ≥ 1.0.0  | ≥ 18.13 | ≥ 4.8      |

## Installation

```bash
# Using npm
npm install @analog-tools/logger

# Using pnpm
pnpm add @analog-tools/logger

# Using yarn
yarn add @analog-tools/logger
```

## 30-Second Quickstart

Get up and running with @analog-tools/logger in under a minute:

```typescript
import { LoggerService } from '@analog-tools/logger';

// Create a logger instance
const logger = new LoggerService({ level: 'info', name: 'my-app' });

// Start logging immediately
logger.info('Hello from @analog-tools/logger!');
logger.warn('This is a warning message');
logger.error('Error occurred', new Error('Something went wrong'));

// Create context-specific loggers
const dbLogger = logger.forContext('database');
dbLogger.info('Database operation completed');
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
logger.fatal('Fatal error', new Error('Critical failure'));

// Create a context-specific logger
const authLogger = logger.forContext('auth');
authLogger.info('User authenticated');

// Group related log messages
logger.group('API Request');
logger.info('Processing request to /users');
logger.debug('Validating request body');
logger.info('Request processed successfully');
logger.groupEnd('API Request');

// Nested groups
logger.group('Database Operations');
logger.info('Starting transaction');

logger.group('Query Execution');
logger.debug('Executing SQL: SELECT * FROM users');
logger.debug('Query completed in 15ms');
logger.groupEnd('Query Execution');

logger.info('Transaction committed');
logger.groupEnd('Database Operations');
```

## Type Safety

@analog-tools/logger provides comprehensive type safety through TypeScript, ensuring compile-time validation and excellent developer experience.

### LogLevelString Type

The logger uses a string union type `LogLevel` for log levels, providing compile-time validation and IntelliSense support:

```typescript
import { LoggerConfig, LogLevel, isValidLogLevel } from '@analog-tools/logger';

// ✅ Valid log levels with IntelliSense support
const validLevels: LogLevel[] = [
  'trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'
];

// ✅ Type-safe configuration
const config: LoggerConfig = {
  level: 'debug', // ← IntelliSense shows valid options
  name: 'my-app'
};

// ❌ TypeScript error for invalid levels
const invalidConfig: LoggerConfig = {
  level: 'verbose', // ← TypeScript error: Type '"verbose"' is not assignable
  name: 'my-app'
};
```

### Runtime Validation

The logger provides graceful runtime validation for scenarios where log levels come from external sources:

```typescript
import { LoggerService, isValidLogLevel } from '@analog-tools/logger';

// Runtime validation function
if (isValidLogLevel(externalLevel)) {
  // Safe to use
  const logger = new LoggerService({ level: externalLevel });
} else {
  // Handle invalid level
  console.warn(`Invalid log level: ${externalLevel}`);
}

// Automatic fallback with warning
const logger = new LoggerService({ 
  level: 'INVALID' as LogLevel, // Runtime error
  name: 'my-app' 
});
// Console output: [LoggerService] Invalid log level "INVALID". Falling back to "info"...
```

### LogLevel Enum

For scenarios where you need numeric log level values:

```typescript
import { LogLevelEnum } from '@analog-tools/logger';

console.log(LogLevelEnum.trace);  // 0
console.log(LogLevelEnum.debug);  // 1
console.log(LogLevelEnum.info);   // 2
console.log(LogLevelEnum.warn);   // 3
console.log(LogLevelEnum.error);  // 4
console.log(LogLevelEnum.fatal);  // 5
console.log(LogLevelEnum.silent); // 6

// Useful for custom log level comparisons
if (currentLogLevel >= LogLevelEnum.warn) {
  // Log warning and above
}
```

### Type-Safe Nitro Integration

The Nitro integration also supports type-safe log levels:

```typescript
import { withLogging, LogLevel } from '@analog-tools/logger';

// ✅ Type-safe Nitro middleware
export default withLogging(myHandler, {
  namespace: 'api',
  level: 'debug' as LogLevel, // ← IntelliSense support
  logResponse: true
});

// ❌ TypeScript error for invalid levels
export default withLogging(myHandler, {
  level: 'verbose' // ← TypeScript error
});
```

### Migration from String Types

If you're migrating from a version that used generic `string` types:

```typescript
// Before (generic string)
interface OldConfig {
  level?: string; // ❌ No type safety
}

// After (type-safe)
interface NewConfig {
  level?: LogLevel; // ✅ Compile-time validation
}

// Migration strategy
const config: LoggerConfig = {
  level: process.env.LOG_LEVEL as LogLevel, // Runtime validation will handle invalid values
  name: 'my-app'
};
```

## Usage with @analog-tools/inject (Optional)

The logger works perfectly standalone, but integrates seamlessly with @analog-tools/inject for dependency injection patterns. **Note: @analog-tools/inject is a peer dependency and completely optional.**

### Standalone Usage (No Injection Framework)

```typescript
import { LoggerService } from '@analog-tools/logger';

// Direct instantiation - works without @analog-tools/inject
const logger = new LoggerService({
  level: 'debug',
  name: 'my-app',
  disabledContexts: ['verbose-module']
});

// Use directly in your services
class UserService {
  private logger = new LoggerService({ name: 'user-service' });
  private userLogger = this.logger.forContext('users');

  getUser(id: string) {
    this.userLogger.info(`Getting user with id ${id}`, { userId: id });
    // Implementation...
  }
}

// Or create a singleton pattern
class LoggerFactory {
  private static instance: LoggerService;
  
  static getInstance(): LoggerService {
    if (!this.instance) {
      this.instance = new LoggerService({
        level: process.env['LOG_LEVEL'] || 'info',
        name: 'my-app'
      });
    }
    return this.instance;
  }
}

// Usage
const logger = LoggerFactory.getInstance();
const apiLogger = logger.forContext('api');
```

### With @analog-tools/inject Integration

When you want centralized dependency injection and configuration:

```typescript
import { inject, registerService } from '@analog-tools/inject';
import { LoggerService } from '@analog-tools/logger';

// Register with custom configuration (optional)
registerService(LoggerService, {
  level: 'debug',
  name: 'my-app',
  disabledContexts: ['verbose-module'] // Disable specific contexts
});

// Inject in your services or API routes
class UserService {
  private logger = inject(LoggerService);
  private userLogger = this.logger.forContext('users');

  getUser(id: string) {
    this.userLogger.info(`Getting user with id ${id}`, { userId: id });
    // Implementation...
  }
}

// Auto-registration: If not manually registered, LoggerService will be auto-registered with defaults
class ProductService {  
  // This works even without explicit registerService() call
  private logger = inject(LoggerService).forContext('products');
  
  getProduct(id: string) {
    this.logger.info(`Fetching product ${id}`);
    // Implementation...
  }
}
```

### Choosing Between Approaches

**Use Standalone When:**
- You prefer direct control over logger instances
- You're not using dependency injection patterns
- You want minimal dependencies
- You're integrating into existing applications without DI

**Use with @analog-tools/inject When:**
- You want centralized configuration management
- You're building applications with dependency injection patterns
- You want consistent logger configuration across services
- You're using other @analog-tools packages that leverage injection

### Migration Between Approaches

You can easily switch between standalone and injection patterns:

- **To Standalone:** Replace `inject(LoggerService)` with `new LoggerService()`
- **To Injection:** replace direct instantiation with `inject(LoggerService)`
- **Mixed Approach:** Use injection for services and standalone for utilities as needed

## Usage in AnalogJS API Routes

### Basic Usage (With @analog-tools/inject)

```typescript
// src/server/routes/api/users/[id].ts
import { defineEventHandler, getRouterParam } from 'h3';
import { inject } from '@analog-tools/inject';
import { LoggerService } from '@analog-tools/logger';

export default defineEventHandler((event) => {
  const logger = inject(LoggerService).forContext('users-api');
  const userId = getRouterParam(event, 'id');

  logger.info(`User endpoint called for ID: ${userId}`, {
    userId,
    path: event.node.req.url,
  });

  // Route implementation...
  return { id: userId, name: 'Example User' };
});
```

### Basic Usage (Standalone)

```typescript
// src/server/routes/api/users/[id].ts
import { defineEventHandler, getRouterParam } from 'h3';
import { LoggerService } from '@analog-tools/logger';

// Create a shared logger instance (you might want to create this in a separate module)
const apiLogger = new LoggerService({ 
  level: 'info', 
  name: 'api' 
});

export default defineEventHandler((event) => {
  const logger = apiLogger.forContext('users-api');
  const userId = getRouterParam(event, 'id');

  logger.info(`User endpoint called for ID: ${userId}`, {
    userId,
    path: event.node.req.url,
  });

  // Route implementation...
  return { id: userId, name: 'Example User' };
});
```

### Shared Logger Configuration for API Routes

For standalone usage, create a shared logger module:

```typescript
// src/server/utils/logger.ts
import { LoggerService } from '@analog-tools/logger';

export const apiLogger = new LoggerService({
  level: process.env['LOG_LEVEL'] || 'info',
  name: 'api',
  disabledContexts: process.env['LOG_DISABLED_CONTEXTS']?.split(',') || []
});

// Export commonly used context loggers
export const usersApiLogger = apiLogger.forContext('users');
export const productsApiLogger = apiLogger.forContext('products');
export const authApiLogger = apiLogger.forContext('auth');
```

```typescript
// src/server/routes/api/users/[id].ts
import { defineEventHandler, getRouterParam } from 'h3';
import { usersApiLogger } from '../../utils/logger';

export default defineEventHandler((event) => {
  const userId = getRouterParam(event, 'id');

  usersApiLogger.info(`User endpoint called for ID: ${userId}`, {
    userId,
    path: event.node.req.url,
  });

  // Route implementation...
  return { id: userId, name: 'Example User' };
});
```

### With Nitro Middleware

```typescript
// src/server/middleware/logging.ts
import { createLoggerMiddleware } from '@analog-tools/logger';

export default createLoggerMiddleware('api-requests');
```

### With Request Handler Wrapper

```typescript
// src/server/routes/api/products/index.ts
import { defineEventHandler } from 'h3';
import { withLogging } from '@analog-tools/logger';

export default withLogging(
  defineEventHandler(() => {
    // Handler implementation
    return { products: [] };
  }),
  { 
    namespace: 'products-api', 
    level: 'info',
    logResponse: true // Log response body (use with caution)
  }
);
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

### Disabling Specific Contexts

You can disable logging for specific contexts:

```typescript
// Option 1: Via constructor configuration
const logger = new LoggerService({
  disabledContexts: ['verbose-module', 'debug-info']
});

// Option 2: Via setter method
logger.setDisabledContexts(['verbose-module', 'debug-info']);

// Option 3: Via environment variable
// Set LOGGER_DISABLED_CONTEXTS=verbose-module,debug-info
```

## API Reference

### `LoggerService`

The main logger class:

```typescript
class LoggerService implements ILogger {
  // Mark as injectable for @analog-tools/inject
  static INJECTABLE = true;

  constructor(config?: LoggerConfig);
  
  // Create a child logger with context
  forContext(context: string): ILogger;
  
  // Get/set configuration
  getLogLevel(): LogLevel;
  getDisabledContexts(): string[];
  setDisabledContexts(contexts: string[]): void;
  setUseColors(enabled: boolean): void;
  getUseColors(): boolean;
  
  // Logging methods
  trace(message: string, ...data: unknown[]): void;
  debug(message: string, ...data: unknown[]): void;
  info(message: string, ...data: unknown[]): void;
  warn(message: string, ...data: unknown[]): void;
  error(message: string, error?: Error | unknown, ...data: unknown[]): void;
  fatal(message: string, error?: Error | unknown, ...data: unknown[]): void;
}
```

### `LoggerConfig`

Configuration options:

```typescript
interface LoggerConfig {
  // Log level (default: 'info' or from LOG_LEVEL env variable)
  level?: string; 
  
  // Logger name prefix (default: 'analog-tools')
  name?: string; 

  // Contexts to disable logging for
  disabledContexts?: string[];
  
  // Whether to use colored output (default: true in non-test environments)
  useColors?: boolean;
}
```

### Nitro Integration

```typescript
// Create middleware that adds logger to event context
createLoggerMiddleware(namespace: string = 'api'): EventHandler;

// Wrap an event handler with automatic request logging
withLogging<T extends EventHandlerRequest>(
  handler: EventHandler<T>,
  options?: {
    namespace?: string;    // Context for the logger (default: 'api')
    level?: 'debug' | 'info'; // Log level (default: 'debug')
    logResponse?: boolean; // Whether to log response bodies (default: false)
  }
): EventHandler<T>;
```

### Mock Logger for Testing

```typescript
class MockLoggerService implements ILogger {
  static INJECTABLE = true;
  
  // All standard logger methods that can be spied on in tests
  forContext(context: string): ILogger;
  trace(message: string, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, error?: Error | unknown, data?: Record<string, unknown>): void;
  fatal(message: string, error?: Error | unknown, data?: Record<string, unknown>): void;
}
```

## Environment Variables

The logger supports the following environment variables:

```
LOG_LEVEL=info              # Set the default log level
LOG_DISABLED_CONTEXTS=verbose-module,debug-info  # Comma-separated list of contexts to disable
```

## Testing with MockLoggerService

For unit tests, you can use the provided MockLoggerService:

```typescript
import { MockLoggerService } from '@analog-tools/logger';
import { registerService } from '@analog-tools/inject';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('MyService', () => {
  let mockLogger: MockLoggerService;
  
  beforeEach(() => {
    mockLogger = new MockLoggerService();
    registerService(LoggerService, mockLogger);
    
    // Spy on logger methods
    vi.spyOn(mockLogger, 'info');
    vi.spyOn(mockLogger, 'error');
  });
  
  it('should log correctly', () => {
    const myService = new MyService();
    myService.doSomething();
    
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Operation completed', 
      expect.objectContaining({ status: 'success' })
    );
  });
});
```

## Colored Console Output

The logger automatically applies different colors to log messages based on their log level, making it easier to identify different types of logs in the console:

- `trace`: Gray
- `debug`: Cyan
- `info`: Green
- `warn`: Yellow
- `error`: Red
- `fatal`: Bright Red

Colors are automatically disabled in test environments to ensure consistent test output. You can also manually control the color settings:

```typescript
// Disable colors
logger.setUseColors(false);

// Enable colors
logger.setUseColors(true);

// Check if colors are enabled
const usingColors = logger.getUseColors();

// Disable colors via constructor
const noColorLogger = new LoggerService({
  level: 'info',
  name: 'my-app',
  useColors: false
});
```

## Log Grouping

The logger provides methods to visually group related log messages in the console output:

```typescript
// Start a group
logger.group('Process Name');

// All logs after this will be visually grouped until groupEnd is called
logger.info('First step');
logger.debug('Details about first step');
logger.info('Second step');

// End the group
logger.groupEnd('Process Name');

// Nested groups
logger.group('Parent Process');
logger.info('Parent process started');

logger.group('Child Process');
logger.debug('Child process details');
logger.groupEnd('Child Process');

logger.info('Parent process continued');
logger.groupEnd('Parent Process');

// End a group without specifying name (ends most recent group)
logger.group('Another Group');
logger.info('Some info');
logger.groupEnd(); // Ends 'Another Group'
```

Groups are particularly useful for:
- Organizing related log messages (e.g., HTTP request/response cycles)
- Tracking multi-step processes
- Debugging complex operations with multiple sub-operations
- Improving readability of logs with many entries

## Enhanced Error Handling

The logger provides robust and flexible error handling with multiple overloads, structured serialization, and full backwards compatibility.

### Error Method Overloads

The `error()` and `fatal()` methods support multiple call signatures for maximum flexibility:

```typescript
import { LoggerService } from '@analog-tools/logger';

const logger = new LoggerService({ name: 'my-app' });

// 1. Simple message
logger.error('Something went wrong');

// 2. Error object only
const dbError = new Error('Connection failed');
logger.error(dbError);

// 3. Message with Error object
logger.error('Database operation failed', dbError);

// 4. Message with structured metadata
logger.error('Validation failed', {
  userId: '12345',
  field: 'email',
  value: 'invalid-email',
  timestamp: Date.now()
});

// 5. Message with Error and metadata
logger.error('Payment processing failed', paymentError, {
  orderId: 'order-123',
  amount: 99.99,
  currency: 'USD'
});

// 6. Backwards compatible: message with additional data
logger.error('Operation failed', { context: 'user-service' }, { operation: 'createUser' });
```

### Structured Error Serialization

The logger includes a powerful error serializer that handles complex scenarios:

```typescript
import { ErrorSerializer } from '@analog-tools/logger';

// Circular reference handling
const obj = { name: 'test' };
obj.self = obj; // Creates circular reference
logger.error('Circular reference detected', obj); // Safely serialized

// Deep object traversal with limits
const deepObj = { level1: { level2: { level3: { level4: 'deep' } } } };
logger.error('Deep object logging', deepObj); // Respects max depth

// Custom error serialization
const customError = ErrorSerializer.serialize(error, {
  includeStack: false,          // Exclude stack traces
  maxDepth: 5,                 // Limit object depth
  includeNonEnumerable: true   // Include hidden properties
});
```

### LogMetadata Interface

Use the structured `LogMetadata` interface for consistent logging:

```typescript
import { LogMetadata } from '@analog-tools/logger';

const metadata: LogMetadata = {
  correlationId: 'req-123',
  userId: 'user-456',
  requestId: 'api-789',
  context: {
    service: 'auth',
    operation: 'login',
    duration: 150
  }
};

logger.error('Authentication failed', authError, metadata);
```

### Error Handling Patterns

#### Service Layer Error Handling

```typescript
class UserService {
  static INJECTABLE = true;
  private logger = inject(LoggerService).forContext('UserService');

  async createUser(userData: CreateUserRequest): Promise<User> {
    const metadata: LogMetadata = {
      operation: 'createUser',
      correlationId: userData.correlationId
    };

    try {
      const user = await this.userRepository.create(userData);
      this.logger.info('User created successfully', { 
        ...metadata, 
        userId: user.id 
      });
      return user;
    } catch (error) {
      // Enhanced error logging with Error object and metadata
      this.logger.error('User creation failed', error, {
        ...metadata,
        email: userData.email,
        provider: userData.provider
      });
      throw error;
    }
  }
}
```

### API Route Error Handling

```typescript
// src/server/routes/api/users/[id].ts
import { defineEventHandler, getRouterParam, createError } from 'h3';
import { withLogging, LogMetadata } from '@analog-tools/logger';

export default withLogging(
  defineEventHandler(async (event) => {
    const logger = inject(LoggerService).forContext('users-api');
    const userId = getRouterParam(event, 'id');

    const metadata: LogMetadata = {
      requestId: event.context.requestId,
      method: event.node.req.method,
      path: event.node.req.url,
      userId
    };

    try {
      if (!userId) {
        logger.warn('User ID missing from request', metadata);
        throw createError({
          statusCode: 400,
          statusMessage: 'User ID is required'
        });
      }

      const user = await getUserById(userId);
      logger.info('User API request successful', metadata);
      return user;
    } catch (error) {
      // Log with Error object and structured metadata
      logger.error('User API request failed', error, metadata);
      throw error;
    }
  }),
  { namespace: 'users-api', level: 'info' }
);
```

## Performance Considerations

Optimize your logging for production environments:

### Log Level Configuration

```typescript
// Development
const devLogger = new LoggerService({ 
  level: 'debug', 
  name: 'my-app-dev' 
});

// Production
const prodLogger = new LoggerService({ 
  level: 'info',  // Avoid trace/debug in production
  name: 'my-app-prod',
  disabledContexts: ['verbose-module', 'debug-info']
});
```

### Efficient Context Usage

```typescript
// Good: Create context loggers once and reuse
class DatabaseService {
  private logger = inject(LoggerService).forContext('database');
  
  async query(sql: string) {
    this.logger.debug('Executing query', { sql });
    // Implementation...
  }
}

// Avoid: Creating new context loggers repeatedly
async function badExample() {
  for (let i = 0; i < 1000; i++) {
    const logger = inject(LoggerService).forContext('loop'); // Inefficient
    logger.debug(`Iteration ${i}`);
  }
}
```

### Environment-Based Configuration

```typescript
// Use environment variables for production tuning
const logger = new LoggerService({
  level: process.env['LOG_LEVEL'] || 'info',
  name: process.env['APP_NAME'] || 'my-app',
  disabledContexts: process.env['LOG_DISABLED_CONTEXTS']?.split(',') || []
});
```

## Troubleshooting

### Common Issues

#### Logger not working after injection
**Problem:** `inject(LoggerService)` throws an error or returns undefined.  
**Solution:** Ensure the service is registered before use, or consider using standalone approach:

```typescript
// Option 1: With @analog-tools/inject
import { registerService } from '@analog-tools/inject';
import { LoggerService } from '@analog-tools/logger';

// Register with custom configuration
registerService(LoggerService, {
  level: 'debug',
  name: 'my-app',
  disabledContexts: ['verbose-module']
});

// Now injection will work
const logger = inject(LoggerService);

// Option 2: Standalone (no injection needed)
const logger = new LoggerService({
  level: 'debug',
  name: 'my-app',
  disabledContexts: ['verbose-module']
});
```

#### Missing @analog-tools/inject dependency
**Problem:** TypeScript errors or runtime errors related to `inject()` function.
**Solution:** Install the peer dependency or use standalone approach:

```bash
# Option 1: Install the peer dependency
npm install @analog-tools/inject

# Option 2: Remove injection usage and use standalone
# Replace inject(LoggerService) with new LoggerService()
```

#### Colors not showing in output
**Problem:** Log messages appear without colors in development.
**Solution:** Colors are automatically disabled in test environments. To force enable:
```typescript
const logger = new LoggerService({ useColors: true });
// Or check if you're in a test environment
const isTest = process.env['NODE_ENV'] === 'test' || process.env['VITEST'] === 'true';
const logger = new LoggerService({ useColors: !isTest });
```

#### Context logging not working
**Problem:** Child logger contexts don't appear in output.
**Solution:** Check if the context is in your disabled contexts list:
```typescript
// Clear disabled contexts
logger.setDisabledContexts([]);

// Or check current disabled contexts
console.log(logger.getDisabledContexts());

// Remove specific context from disabled list
const current = logger.getDisabledContexts();
const filtered = current.filter(ctx => ctx !== 'my-context');
logger.setDisabledContexts(filtered);
```

#### Log levels not working as expected
**Problem:** Debug messages appear in production or info messages don't show.
**Solution:** Check your log level configuration:
```typescript
// Check current log level
console.log('Current log level:', logger.getLogLevel());

// Set log level explicitly
const logger = new LoggerService({ level: 'info' });

// Or use environment variable
// LOG_LEVEL=debug npm start
```

### Performance Issues

#### High memory usage with extensive logging
**Problem:** Application memory usage grows with heavy logging.
**Solutions:**
- Use appropriate log levels for production (`info` and above)
- Disable verbose contexts: `LOG_DISABLED_CONTEXTS=debug-module,verbose-api`
- Avoid logging large objects frequently
- Use structured logging instead of string concatenation

#### Slow application startup
**Problem:** Application takes long to start with logger configuration.
**Solution:** Optimize logger initialization:
```typescript
// Lazy initialization
let _logger: LoggerService;
function getLogger() {
  if (!_logger) {
    _logger = new LoggerService({ level: 'info', name: 'my-app' });
  }
  return _logger;
}
```

### Integration Issues

#### TypeScript compilation errors
**Problem:** TypeScript errors when using the logger.
**Solution:** Ensure proper peer dependencies:
```bash
npm install @analog-tools/inject@^0.0.5
npm install --save-dev typescript@^4.8.0
```

#### Nitro middleware not working
**Problem:** `createLoggerMiddleware` or `withLogging` not functioning.
**Solution:** Verify H3 version compatibility:
```bash
npm install h3@^1.10.1
```

## Migration Guide

### Upgrading to Enhanced Error Handling

The latest version introduces enhanced error handling with multiple overloads while maintaining full backwards compatibility. Your existing code will continue to work without changes.

#### No Breaking Changes

All existing logging patterns continue to work exactly as before:

```typescript
// ✅ These patterns still work identically
logger.error('Simple message');
logger.error('Message', error);
logger.error('Message', error, additionalData);
logger.error('Message', data1, data2, data3);
```

#### New Recommended Patterns

While backwards compatibility is maintained, consider adopting these new patterns for better type safety and structured logging:

```typescript
// ❌ Old pattern (still works)
logger.error('Validation failed', error, { userId: '123', field: 'email' });

// ✅ New recommended pattern - more explicit and type-safe
logger.error('Validation failed', error, {
  userId: '123',
  field: 'email',
  operation: 'validateUser'
} as LogMetadata);
```

#### Structured Metadata

Consider migrating to the new `LogMetadata` interface for better structure:

```typescript
import { LogMetadata } from '@analog-tools/logger';

// ❌ Old pattern (still works)
logger.error('Operation failed', { userId: '123', context: 'api' });

// ✅ New pattern with structured metadata
const metadata: LogMetadata = {
  userId: '123',
  correlationId: 'req-456',
  context: {
    service: 'api',
    operation: 'processPayment'
  }
};
logger.error('Payment processing failed', paymentError, metadata);
```

#### Error Serialization

The new error serializer provides better handling of complex objects:

```typescript
// ❌ Objects with circular references could cause issues before
const objWithCircular = { name: 'test' };
objWithCircular.self = objWithCircular;
logger.error('Circular ref', objWithCircular); // Now handled safely

// ✅ Custom serialization options now available
import { ErrorSerializer } from '@analog-tools/logger';

const serialized = ErrorSerializer.serialize(complexError, {
  includeStack: false,
  maxDepth: 3,
  includeNonEnumerable: true
});
```

### Performance Improvements

The enhanced error handling includes several performance improvements:

- **Lazy serialization**: Objects are only serialized when actually logged
- **Circular reference detection**: Prevents infinite recursion
- **Depth limiting**: Prevents deep object traversal issues
- **Type checking optimization**: Faster parameter resolution

### Testing Migration

If you're using custom mocks for testing, they remain compatible:

```typescript
// ✅ Existing test mocks continue to work
const mockLogger = {
  error: vi.fn(),
  fatal: vi.fn(),
  // ... other methods
};

// ✅ New test patterns can leverage enhanced types
const error = new Error('Test error');
const metadata: LogMetadata = { testId: '123' };
mockLogger.error('Test failed', error, metadata);

expect(mockLogger.error).toHaveBeenCalledWith('Test failed', error, metadata);
```

## Best Practices

### Logging Best Practices

1. **Use structured logging**: Pass structured data as additional parameters instead of string concatenation
2. **Create context-specific loggers**: Use `forContext()` to create loggers for different parts of your application
3. **Configure log levels appropriately**: Use `trace` and `debug` for development, `info` and above for production
4. **Log meaningful errors**: Include the actual Error object in error logs, not just messages
5. **Disable noisy contexts**: Use `disabledContexts` to selectively disable logging for specific contexts
6. **Use dependency injection**: Leverage @analog-tools/inject for cleaner code organization
7. **Use Nitro integration**: Use the provided middleware and handlers in AnalogJS API routes
8. **Configure via environment**: Use environment variables for production configuration

### Enhanced Error Handling Best Practices

9. **Use appropriate error overloads**: Choose the right method signature for your use case:
   ```typescript
   // ✅ For simple errors
   logger.error('Operation failed');
   
   // ✅ For errors with Error objects
   logger.error('Database error', dbError);
   
   // ✅ For structured metadata
   logger.error('Validation failed', { field: 'email', value: 'invalid' });
   
   // ✅ For comprehensive error logging
   logger.error('Payment failed', paymentError, { orderId: '123', amount: 99.99 });
   ```

10. **Use LogMetadata interface**: Structure your metadata consistently:
    ```typescript
    const metadata: LogMetadata = {
      correlationId: 'req-123',
      userId: 'user-456',
      context: { service: 'payments', operation: 'charge' }
    };
    logger.error('Payment processing failed', error, metadata);
    ```

11. **Handle circular references**: The logger automatically handles circular references, but be mindful of object complexity:
    ```typescript
    // ✅ Safe - circular references are detected and handled
    const user = { id: '123', profile: {} };
    user.profile.user = user;
    logger.error('User error', user);
    ```

12. **Configure serialization options**: Customize error serialization when needed:
    ```typescript
    import { ErrorSerializer } from '@analog-tools/logger';
    
    // For sensitive environments - exclude stack traces
    const serialized = ErrorSerializer.serialize(error, {
      includeStack: false,
      maxDepth: 3
    });
    ```

## Security Considerations

### Avoiding Sensitive Data in Logs

Never log sensitive information such as passwords, API keys, or personal data:

```typescript
// ❌ DON'T: Log sensitive data
logger.info('User login attempt', {
  username: 'john.doe',
  password: 'secret123', // Never log passwords!
  apiKey: 'sk-1234567890' // Never log API keys!
});

// ✅ DO: Log safely with sanitized data
logger.info('User login attempt', {
  username: 'john.doe',
  hasPassword: true, // Boolean indicator instead
  apiKeyPrefix: 'sk-***', // Partial information only
  timestamp: new Date().toISOString()
});
```

### Sanitizing User Input

Always sanitize user input before logging:

```typescript
import { LoggerService } from '@analog-tools/logger';

function sanitizeForLogging(input: unknown): unknown {
  if (typeof input === 'string') {
    // Remove potential sensitive patterns
    return input
      .replace(/password[=:]\s*\S+/gi, 'password=***')
      .replace(/token[=:]\s*\S+/gi, 'token=***')
      .replace(/key[=:]\s*\S+/gi, 'key=***');
  }
  return input;
}

// Usage in your application
const logger = new LoggerService({ name: 'api' });

function handleUserInput(userInput: string) {
  logger.info('Processing user input', {
    input: sanitizeForLogging(userInput),
    length: userInput.length
  });
}
```

### Production Log Security

```typescript
// Configure different log levels for different environments
const logger = new LoggerService({
  level: process.env['NODE_ENV'] === 'production' ? 'warn' : 'debug',
  name: 'secure-app',
  // Disable detailed contexts in production
  disabledContexts: process.env['NODE_ENV'] === 'production' 
    ? ['debug-details', 'user-data', 'internal'] 
    : []
});
```

### Compliance Considerations

For applications handling sensitive data (GDPR, HIPAA, etc.):

```typescript
// Create a compliance-aware logger
class ComplianceLogger extends LoggerService {
  static INJECTABLE = true;

  // Override methods to add compliance checks
  info(message: string, ...data: unknown[]): void {
    const sanitizedData = data.map(item => this.sanitizeCompliance(item));
    super.info(message, ...sanitizedData);
  }

  private sanitizeCompliance(data: unknown): unknown {
    if (typeof data === 'object' && data !== null) {
      const sanitized = { ...data as Record<string, unknown> };
      
      // Remove common PII fields
      delete sanitized.ssn;
      delete sanitized.creditCard;
      delete sanitized.email; // or hash it
      delete sanitized.phoneNumber;
      
      return sanitized;
    }
    return data;
  }
}
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

### Development Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Run tests: `nx test`
4. Serve Demo App: `nx serve`

### Reporting Issues
- Use [GitHub Issues](https://github.com/MrBacony/analog-tools/issues) for bug reports and feature requests
- Include code examples and error messages
- Specify your environment (Node.js version, AnalogJS version, etc.)

### Support Channels
- 🐛 **Bug Reports:** [GitHub Issues](https://github.com/MrBacony/analog-tools/issues)
- 💡 **Feature Requests:** [GitHub Discussions](https://github.com/MrBacony/analog-tools/discussions)
- 📖 **Documentation:** Contribute improvements via Pull Requests

## Future Plans

- Support for custom transports (file, HTTP, etc.)
- Support for log rotation and compression
- Structured JSON logging format option
- Performance optimizations for high-volume logging

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
