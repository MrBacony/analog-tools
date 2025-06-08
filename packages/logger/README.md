# @analog-tools/logger

> **⚠️ IMPORTANT: Early Development Stage** ⚠️  
> This project is in its early development stage. Breaking changes may happen frequently as the APIs evolve. Use with caution in production environments.

A minimal, type-safe logging utility for server-side applications in AnalogJS, Nitro and H3-based environments. Designed for full compatibility with the @analog-tools/inject package for easy dependency injection.

[![npm version](https://img.shields.io/npm/v/@analog-tools/logger.svg)](https://www.npmjs.com/package/@analog-tools/logger)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Features

- 📝 Type-safe log levels: `trace`, `debug`, `info`, `warn`, `error`, `fatal`, `silent`
- 🎨 Colorized console output with color-coding by log level
- 🧩 Seamless integration with @analog-tools/inject for dependency injection
- 🌳 Context-based logging with child loggers
- 🔧 Configurable via environment variables
- 🚫 Context filtering with disabledContexts
- 🌐 Nitro middleware and request handler integration
- 🧪 Mock logger implementation for testing
- 🚀 Lightweight implementation using standard console

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

## Usage with @analog-tools/inject

```typescript
import { inject, registerService } from '@analog-tools/inject';
import { LoggerService } from '@analog-tools/logger';

// Optional: Register with custom configuration
registerService(LoggerService, {
  level: 'debug',
  name: 'my-app',
  disabledContexts: ['verbose-module'] // Disable specific contexts
});

// Inject in your services or API routes
class UserService {
  static INJECTABLE = true;

  private logger = inject(LoggerService);
  private userLogger = this.logger.forContext('users');

  getUser(id: string) {
    this.userLogger.info(`Getting user with id ${id}`, { userId: id });
    // Implementation...
  }
}
```

## Usage in AnalogJS API Routes

### Basic Usage

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

## Best Practices

1. **Use structured logging**: Pass structured data as additional parameters instead of string concatenation
2. **Create context-specific loggers**: Use `forContext()` to create loggers for different parts of your application
3. **Configure log levels appropriately**: Use `trace` and `debug` for development, `info` and above for production
4. **Log meaningful errors**: Include the actual Error object in error logs, not just messages
5. **Disable noisy contexts**: Use `disabledContexts` to selectively disable logging for specific contexts
6. **Use dependency injection**: Leverage @analog-tools/inject for cleaner code organization
7. **Use Nitro integration**: Use the provided middleware and handlers in AnalogJS API routes
8. **Configure via environment**: Use environment variables for production configuration

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Future Plans

- Support for custom transports (file, HTTP, etc.)
- Support for log rotation and compression
- Structured JSON logging format option
- Performance optimizations for high-volume logging

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
