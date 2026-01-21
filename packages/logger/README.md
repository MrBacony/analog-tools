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
- [Metadata-Based Styling and Icons](#metadata-based-styling-and-icons)
- [Smart Log Deduplication](#smart-log-deduplication)
- [Log Grouping](#log-grouping)
- [API Reference](#api-reference)
- [Environment Variables](#environment-variables)
- [Testing with MockLoggerService](#testing-with-mockloggerservice)
- [Colored Console Output](#colored-console-output)
- [Performance Considerations](#performance-considerations)
  - [Log Level Configuration](#log-level-configuration)
  - [Lazy Message Evaluation](#lazy-message-evaluation)
  - [Efficient Context Usage](#efficient-context-usage)
  - [Environment-Based Configuration](#environment-based-configuration)
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
- ⚡ **Lazy Message Evaluation** for performance optimization of expensive logging operations
- 🎨 **Metadata-based styling** with colors, formatting, and emoji icons
- 🌈 **Curated color palette** with rich ANSI color support via ColorEnum
- ✨ **Semantic styling** with global and per-call configuration
- 🧩 Seamless integration with @analog-tools/inject for dependency injection
- 🌳 Context-based logging with child loggers
- 🔧 Configurable via environment variables
- 🚫 Context filtering with disabledContexts
- 🌐 Nitro middleware and request handler integration
- 🧪 Mock logger implementation for testing
- 🚀 Lightweight implementation using standard console
- 🔥 **Enhanced Error Handling** with multiple overloads and type safety
- 🛡️ **Structured Error Serialization** with circular reference protection
- 📊 **LogContext Support** for structured logging
- 🔄 **Backwards Compatibility** with existing error logging patterns
- 🔁 **Smart Log Deduplication** with aggregation to reduce noise from repeated messages

## Prerequisites

- Node.js 18.13.0 or later
- AnalogJS project or Nitro/H3-based application
- TypeScript 4.8 or later (for full type safety)
- @analog-tools/inject ^0.0.16 (peer dependency)

### Compatibility Matrix

| @analog-tools/logger | AnalogJS | Node.js | TypeScript |
|---------------------|----------|---------|-------------|
| 0.0.16              | ≥ 1.19.0 | ≥ 18.13 | ≥ 4.8       |

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

// Add styling and icons with metadata
logger.info('Success!', { style: 'success', icon: '✅' });
logger.warn('Be careful', { icon: '⚠️' });
logger.error('Critical error', { 
  style: { color: ColorEnum.FireRed, bold: true },
  icon: '🔥' 
});

// Lazy evaluation for expensive operations
logger.debug(() => JSON.stringify(largeObject)); // Only runs if debug is enabled

// Create context-specific loggers
const dbLogger = logger.forContext('database');
dbLogger.info('Database operation completed', { icon: '🗄️' });
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
// Message types
type LogMessage = string | (() => string);

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
  
  // Logging methods - support both strings and lazy functions
  trace(message: LogMessage, ...data: unknown[]): void;
  debug(message: LogMessage, ...data: unknown[]): void;
  info(message: LogMessage, ...data: unknown[]): void;
  warn(message: LogMessage, ...data: unknown[]): void;
  error(message: LogMessage, error?: Error | unknown, ...data: unknown[]): void;
  fatal(message: LogMessage, error?: Error | unknown, ...data: unknown[]): void;
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



## Metadata-Based Styling and Icons

@analog-tools/logger now supports a powerful metadata-based styling and icon system for all log methods. This enables semantic and custom styles, emoji icons, and per-call or global configuration for beautiful, expressive logs.

### Usage Example

```typescript
import { LoggerService, ColorEnum } from '@analog-tools/logger';

const logger = new LoggerService({
  level: 'info',
  name: 'my-app',
  // Optional: global style/icon config
  styles: { highlight: { color: ColorEnum.LemonYellow, bold: true } },
  icons: { success: '✅', info: 'ℹ️' }
});

// Per-call metadata for style and icon
logger.info('Success!', { style: 'success', icon: '✅' });
logger.warn('Be careful', { icon: '⚠️' });
logger.info('Custom dreamy color', { style: { color: ColorEnum.DeepPurple, underline: true } });
logger.info('With emoji', { icon: '🚀' });
```

#### Supported Features
- **Semantic styles**: Use names like `'success'`, `'warning'`, `'highlight'`, etc.
- **Custom styles**: Use `ColorEnum` and style config for color, bold, underline, background, etc.
- **Emoji icons**: Use any emoji or semantic icon name (e.g., `'success'`, `'info'`).
- **Global config**: Set default styles/icons in `LoggerConfig`.
- **Per-call override**: Pass metadata as the last argument to any log method.
- **Fallback/warning**: Unknown styles/icons trigger a warning and fallback to defaults.

#### Example: Highlighted Info (replaces `info2()`)
```typescript
// Old:
// logger.info2('Important!');
// New:
logger.info('Important!', { style: 'highlight', icon: '⭐️' });
```

See the [Migration Guide](./OPTIMIZATION.md) for upgrade instructions and more examples.

---

Use predefined semantic styles for common scenarios:

```typescript
// Configure semantic styles globally
const logger = new LoggerService({
  level: 'info',
  name: 'my-app',
  useColors: true,
  styles: {
    highlight: { color: ColorEnum.LemonYellow, bold: true },
    success: { color: ColorEnum.ForestGreen },
    error: { color: ColorEnum.FireRed },
    warning: { color: ColorEnum.TangerineOrange },
    info: { color: ColorEnum.OceanBlue },
    debug: { color: ColorEnum.SlateGray }
  },
  icons: {
    success: '✅',
    warning: '⚠️',
    error: '❌',
    info: 'ℹ️',
    debug: '🐞'
  }
});

// Use semantic styles
logger.info('Important message', { style: 'highlight' });
logger.info('Operation successful', { style: 'success', icon: 'success' });
logger.info('Debug information', { style: 'debug', icon: 'debug' });
```

### ColorEnum Options

The logger includes a comprehensive set of dreamy colors with ANSI codes:

```typescript
// Blue shades
ColorEnum.SkyBlue        // Bright blue
ColorEnum.OceanBlue      // Standard blue  
ColorEnum.MidnightBlue   // Deep blue

// Green shades
ColorEnum.MintGreen      // Bright green
ColorEnum.ForestGreen    // Standard green
ColorEnum.EmeraldGreen   // Deep green

// Yellow shades
ColorEnum.LemonYellow    // Bright yellow
ColorEnum.SunflowerYellow // Standard yellow
ColorEnum.GoldYellow     // Gold

// Red shades
ColorEnum.RoseRed        // Bright red
ColorEnum.FireRed        // Standard red
ColorEnum.BurgundyRed    // Deep red

// Purple shades
ColorEnum.LavenderPurple // Bright purple
ColorEnum.RoyalPurple    // Medium purple
ColorEnum.DeepPurple     // Deep purple

// Orange shades
ColorEnum.PeachOrange    // Light orange
ColorEnum.TangerineOrange // Standard orange
ColorEnum.AmberOrange    // Deep orange

// Gray shades
ColorEnum.SilverGray     // Light gray
ColorEnum.SlateGray      // Medium gray
ColorEnum.CharcoalGray   // Dark gray

// Background colors (add "Bg" suffix)
ColorEnum.SkyBlueBg      // Blue background
ColorEnum.ForestGreenBg  // Green background
// ... and many more
```

### Advanced Styling Options

```typescript
// Custom styling with multiple format options
logger.info('Formatted message', {
  style: { 
    color: ColorEnum.RoyalPurple,
    bold: true,
    underline: true 
  },
  icon: '🎨'
});

// Using with regular data
logger.info('User logged in', 
  { userId: '123', timestamp: Date.now() },
  { style: 'success', icon: '👤' }
);

// Multiple data objects with metadata
logger.info('Complex operation',
  { step: 1, status: 'processing' },
  { duration: 150, memory: '2.1MB' },
  { style: 'highlight', icon: '⚡️' }
);
```

### Error and Fatal Logging with Metadata

The enhanced error and fatal methods support metadata styling:

```typescript
// Error with metadata styling
logger.error('Database error', 
  new Error('Connection timeout'),
  { userId: '123', query: 'SELECT * FROM users' },
  { style: 'error', icon: '🔥' }
);

// Fatal error with styling
logger.fatal('Critical system failure', {
  style: { color: ColorEnum.FireRed, bold: true },
  icon: '💀'
});
```

### Icon System

The logger supports a comprehensive set of emoji icons:

```typescript
// Common icons
logger.info('Success', { icon: '✅' });
logger.warn('Warning', { icon: '⚠️' });
logger.error('Error', { icon: '❌' });
logger.info('Information', { icon: 'ℹ️' });
logger.debug('Debug', { icon: '🐞' });

// Process icons
logger.info('Loading', { icon: '⏳' });
logger.info('Rocket launch', { icon: '🚀' });
logger.info('Fire alert', { icon: '🔥' });
logger.info('Star rating', { icon: '⭐️' });

// Status icons
logger.info('Locked', { icon: '🔒' });
logger.info('Unlocked', { icon: '🔓' });
logger.info('Up arrow', { icon: '⬆️' });
logger.info('Down arrow', { icon: '⬇️' });

// And many more emoji options available...
```

### Fallback and Warning Behavior

The logger gracefully handles unknown styles and icons:

```typescript
// Unknown semantic style - logs warning and uses default
logger.info('Message', { style: 'unknown-style' });
// Console output: [my-app] Unknown semantic style: unknown-style. Falling back to default.

// Invalid icon - logs warning and uses the string as-is
logger.info('Message', { icon: 'not-an-emoji' });
// Console output: [my-app] Invalid icon: not-an-emoji. Expected a valid emoji or semantic icon name.
```

### Child Logger Inheritance

Child loggers inherit global styling configuration:

```typescript
const logger = new LoggerService({
  styles: { highlight: { color: ColorEnum.LemonYellow, bold: true } },
  icons: { success: '✅' }
});

const childLogger = logger.forContext('child');
childLogger.info('Child message', { style: 'highlight', icon: 'success' });
// Uses parent's configuration
```

### Color Control

Control color output globally or per-call:

```typescript
// Disable colors globally
const logger = new LoggerService({
  level: 'info',
  name: 'my-app',
  useColors: false  // Icons still work, colors are disabled
});

// Enable/disable colors at runtime
logger.setUseColors(false);
logger.info('No colors', { style: 'highlight', icon: '🎨' });
// Output: 🎨 [my-app] No colors (no color codes)

logger.setUseColors(true);
logger.info('With colors', { style: 'highlight', icon: '🎨' });
// Output: 🎨 [my-app] With colors (with color codes)
```

### Migration from Legacy Styling

If you were using custom color libraries or formatting, you can now use the built-in metadata system:

```typescript
// Before (custom color library)
logger.info(chalk.yellow.bold('Important message'));

// After (metadata-based)
logger.info('Important message', { 
  style: { color: ColorEnum.LemonYellow, bold: true } 
});

// Before (manual emoji concatenation)
logger.info('✅ Task completed');

// After (metadata-based)
logger.info('Task completed', { icon: '✅' });
```

## Smart Log Deduplication

The logger includes smart deduplication to reduce noise from repeated log messages. When enabled, identical messages within a time window are batched together and displayed with repeat counts.

### Basic Configuration

```typescript
const logger = new LoggerService({
  level: 'info',
  deduplication: {
    enabled: true,
    windowMs: 5000,        // 5-second batching window (default: 1000ms)
    flushOnCritical: true  // Flush batched messages when error/fatal occurs (default: true)
  }
});

// These repeated messages will be batched
logger.info('Processing file...');
logger.info('Processing file...');
logger.info('Processing file...');

// After 5 seconds, you'll see:
// [my-app] Processing file... (×3)
```

### How It Works

1. **Message Batching**: Identical messages at the same log level are grouped together within a time window
2. **Automatic Flushing**: Batched messages are automatically flushed when the time window expires
3. **Critical Message Priority**: Error and fatal messages always log immediately and optionally flush any pending batches
4. **Context Awareness**: Messages from different contexts are tracked separately
5. **Metadata Bypass**: Messages with styling metadata or additional data are never batched (logged immediately)

### Key Features

#### Simple Messages Only
Only simple messages without metadata or additional data are deduplicated:

```typescript
// These will be batched
logger.info('Connection retry');
logger.info('Connection retry');
logger.info('Connection retry');

// These will NOT be batched (logged immediately)
logger.info('Connection retry', { style: 'warning' });
logger.info('Connection retry', { userId: 123 });
logger.info('Connection retry', additionalData);
```

#### Critical Message Handling
Error and fatal messages bypass deduplication entirely:

```typescript
// Setup with batching
logger.info('Processing...');
logger.info('Processing...');

// This error logs immediately and flushes batched messages
logger.error('Processing failed!');

// Output:
// [my-app] Processing... (×2)
// [my-app] Processing failed!
```

#### Level-Specific Batching
Different log levels are batched separately:

```typescript
logger.debug('Checking status');
logger.info('Checking status');  // Different level, won't batch with debug
logger.debug('Checking status'); // Will batch with first debug message

// Results in separate batches for debug and info levels
```

#### Context Separation
Child loggers maintain separate deduplication tracking:

```typescript
const rootLogger = new LoggerService({ 
  deduplication: { enabled: true } 
});
const userLogger = rootLogger.forContext('user');
const adminLogger = rootLogger.forContext('admin');

// These are tracked separately
rootLogger.info('System status');
userLogger.info('System status');
adminLogger.info('System status');

// Results in three separate log entries
```

### Configuration Options

```typescript
interface DeduplicationConfig {
  enabled: boolean;         // Enable/disable deduplication
  windowMs?: number;        // Time window in milliseconds (default: 1000)
  flushOnCritical?: boolean; // Flush batches on error/fatal (default: true)
}
```

### Environment Variable Support

You can configure deduplication via environment variables:

```bash
# Enable deduplication with 2-second window
LOG_DEDUP_ENABLED=true
LOG_DEDUP_WINDOW=2000
LOG_DEDUP_FLUSH_CRITICAL=true
```

### Best Practices

1. **Use for High-Volume Scenarios**: Enable deduplication when you expect repeated messages (polling, retry loops, etc.)
2. **Keep Short Windows**: Use shorter time windows (1-5 seconds) to maintain responsiveness
3. **Critical Messages**: Always keep `flushOnCritical: true` to ensure important errors are seen immediately
4. **Disable for Development**: Consider disabling during development for immediate feedback
5. **Monitor Performance**: While lightweight, consider the memory footprint in extremely high-volume scenarios

### Performance Impact

- **Memory**: Minimal overhead - uses in-memory Map with automatic cleanup
- **CPU**: Negligible processing overhead per message
- **Timing**: Uses Node.js timers with automatic cleanup on flush

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

### LogContext Interface

Use the structured `LogContext` interface for consistent logging:

```typescript
import { LogContext } from '@analog-tools/logger';

const context: LogContext = {
  correlationId: 'req-123',
  userId: 'user-456',
  requestId: 'api-789',
  context: {
    service: 'auth',
    operation: 'login',
    duration: 150
  }
};

logger.error('Authentication failed', authError, context);
```

### Error Handling Patterns

#### Service Layer Error Handling

```typescript
class UserService {
  static INJECTABLE = true;
  private logger = inject(LoggerService).forContext('UserService');

  async createUser(userData: CreateUserRequest): Promise<User> {
    const context: LogContext = {
      operation: 'createUser',
      correlationId: userData.correlationId
    };

    try {
      const user = await this.userRepository.create(userData);
      this.logger.info('User created successfully', { 
        ...context, 
        userId: user.id 
      });
      return user;
    } catch (error) {
      // Enhanced error logging with Error object and context
      this.logger.error('User creation failed', error, {
        ...context,
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

    const context: LogContext = {
      requestId: event.context.requestId,
      method: event.node.req.method,
      path: event.node.req.url,
      userId
    };

    try {
      if (!userId) {
        logger.warn('User ID missing from request', context);
        throw createError({
          statusCode: 400,
          statusMessage: 'User ID is required'
        });
      }

      const user = await getUserById(userId);
      logger.info('User API request successful', context);
      return user;
    } catch (error) {
      // Log with Error object and structured context
      logger.error('User API request failed', error, context);
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

### Lazy Message Evaluation

For expensive logging operations, use lazy evaluation to avoid unnecessary computation when logging is disabled:

#### When to Use Lazy Evaluation

**Use lazy evaluation for:**
- JSON serialization of large objects
- String formatting with expensive computations
- Database queries for debugging
- Stack trace generation
- Complex calculations in log messages

**Don't use lazy evaluation for:**
- Simple string messages (adds unnecessary overhead)
- Already-computed values
- Infrequent log calls

#### Basic Usage (Recommended for 95% of cases)

```typescript
// ✅ Simple strings - fast and clean (use this by default)
logger.info('User logged in');
logger.warn('Rate limit exceeded');
logger.debug('Processing request');
```

#### Advanced Usage (For Expensive Operations)

```typescript
// ✅ Lazy evaluation - only runs if debug is enabled
logger.debug(() => JSON.stringify(largeObject));
logger.trace(() => `Complex stats: ${calculateExpensiveStats()}`);

// ✅ Avoid expensive string formatting when logging is disabled
logger.debug(() => {
  const metrics = gatherMetrics(); // Expensive operation
  return `Metrics: ${JSON.stringify(metrics, null, 2)}`;
});
```

#### Performance Comparison

```typescript
// ❌ Bad: Always executes even if not logged (wastes ~50ms)
logger.debug(JSON.stringify(hugeDataset)); 

// ✅ Good: Only executes when needed (0ms when disabled)
logger.debug(() => JSON.stringify(hugeDataset));

// Example with expensive computation
const calculateStats = () => {
  // Expensive operation taking 100ms
  return complexStatisticsCalculation();
};

// ❌ Bad: Computation always runs
logger.debug(`Stats: ${calculateStats()}`); // Costs 100ms every time

// ✅ Good: Computation only runs when debug level is enabled
logger.debug(() => `Stats: ${calculateStats()}`); // Costs 0ms when disabled
```

#### Real-World Examples

```typescript
// Example 1: JSON serialization
logger.debug(() => JSON.stringify(request.body, null, 2));

// Example 2: Database query logging
logger.trace(() => {
  const query = buildComplexQuery(filters);
  return `Executing query: ${query.toSQL()}`;
});

// Example 3: Complex string formatting
logger.debug(() => {
  const metrics = {
    cpu: process.cpuUsage(),
    memory: process.memoryUsage(),
    uptime: process.uptime()
  };
  return `System metrics: ${JSON.stringify(metrics, null, 2)}`;
});

// Example 4: Conditional object inspection
logger.trace(() => {
  if (shouldIncludeDetails) {
    return `Full context: ${JSON.stringify(context, null, 2)}`;
  }
  return `Basic context: ${context.id}`;
});
```

#### Anti-Patterns to Avoid

```typescript
// ❌ Anti-pattern: Using lazy evaluation for simple strings
logger.info(() => 'Simple message'); // Unnecessary overhead

// ❌ Anti-pattern: Always evaluating expensive operations
logger.debug(JSON.stringify(hugeObject)); // Wastes CPU when debug is disabled

// ❌ Anti-pattern: Throwing from message function
logger.info(() => { 
  throw new Error('test'); // Could crash logging
});

// ✅ Correct: Simple strings directly
logger.info('Simple message'); // Zero overhead

// ✅ Correct: Lazy evaluate only when needed
logger.debug(() => JSON.stringify(hugeObject)); // Zero cost when disabled

// ✅ Correct: Error handling in message function
logger.info(() => { 
  try { 
    return expensiveOperation();
  } catch (error) {
    return 'fallback message';
  }
});
```

#### Type Safety with Lazy Messages

```typescript
// TypeScript ensures message functions return strings
const message1: string | (() => string) = 'simple'; // ✅ Valid
const message2: string | (() => string) = () => 'computed'; // ✅ Valid
const message3: string | (() => string) = () => 123; // ❌ Type error

// Works with all log levels
logger.trace(() => 'trace message');
logger.debug(() => 'debug message');
logger.info(() => 'info message');
logger.warn(() => 'warn message');
logger.error(() => 'error message');
logger.fatal(() => 'fatal message');
```

#### Performance Metrics

Based on implementation testing:

| Scenario | Overhead | Notes |
|----------|----------|-------|
| Simple string messages | < 5% | Single `typeof` check, virtually no impact |
| Function creation | ~1-2 bytes | Minimal memory footprint |
| Lazy evaluation (when skipped) | 0ms | Early exit before function call |
| Lazy evaluation (when executed) | < 10% | One function call overhead |
| JSON serialization savings | 70-95% | Massive savings for large objects |
| Complex computation savings | 90-99% | Near-total elimination when disabled |

**Key Takeaway:** Use simple strings for 95% of your logging. Reserve lazy evaluation for genuinely expensive operations (JSON serialization, calculations, queries).

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

### Lazy Message Evaluation Best Practices

9. **Reserve lazy evaluation for expensive operations**: Only use function-based messages when the operation is genuinely expensive (> 5ms)
   ```typescript
   // ✅ Good: Simple string for cheap operations
   logger.info('User logged in');
   
   // ✅ Good: Lazy evaluation for expensive operations
   logger.debug(() => JSON.stringify(largeDataset));
   
   // ❌ Bad: Lazy evaluation for simple strings (unnecessary overhead)
   logger.info(() => 'Simple message');
   ```

10. **Use lazy evaluation for JSON serialization**: Large object serialization is the most common use case
    ```typescript
    // ✅ Perfect use case
    logger.debug(() => JSON.stringify(response, null, 2));
    logger.trace(() => JSON.stringify(requestBody));
    ```

11. **Keep message functions pure and safe**: Don't rely on side effects or throw errors
    ```typescript
    // ✅ Good: Pure function
    logger.debug(() => `Count: ${items.length}`);
    
    // ❌ Bad: Side effects in message function
    logger.debug(() => {
      counter++; // Side effect!
      return `Counter: ${counter}`;
    });
    
    // ✅ Good: Error handling
    logger.debug(() => {
      try {
        return expensiveOperation();
      } catch {
        return 'Operation failed';
      }
    });
    ```

12. **Profile before optimizing**: Only add lazy evaluation after profiling shows logging overhead
    ```typescript
    // Measure first, then optimize
    console.time('logging');
    logger.debug(JSON.stringify(data)); // Is this slow?
    console.timeEnd('logging');
    
    // If yes, then optimize
    logger.debug(() => JSON.stringify(data));
    ```

### Enhanced Error Handling Best Practices

13. **Use appropriate error overloads**: Choose the right method signature for your use case:
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

14. **Use LogContext interface**: Structure your metadata consistently:
    ```typescript
    const context: LogContext = {
      correlationId: 'req-123',
      userId: 'user-456',
      context: { service: 'payments', operation: 'charge' }
    };
    logger.error('Payment processing failed', paymentError, context);
    ```

15. **Handle circular references**: The logger automatically handles circular references, but be mindful of object complexity:
    ```typescript
    // ✅ Safe - circular references are detected and handled
    const user = { id: '123', profile: {} };
    user.profile.user = user;
    logger.error('User error', user);
    ```

16. **Configure serialization options**: Customize error serialization when needed:
    ```typescript
    import { ErrorSerializer } from '@analog-tools/logger';
    
    // For sensitive environments - exclude stack traces
    const serialized = ErrorSerializer.serialize(error, {
      includeStack: false,
      maxDepth: 3,
      includeNonEnumerable: true
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

## Metadata-Based Styling and Icon System

@analog-tools/logger now supports a powerful metadata-based styling and icon system for all log methods. This enables semantic and custom styles, emoji icons, and per-call or global configuration for beautiful, expressive logs.

### Usage Example

```typescript
import { LoggerService, ColorEnum } from '@analog-tools/logger';

const logger = new LoggerService({
  level: 'info',
  name: 'my-app',
  // Optional: global style/icon config
  styles: { highlight: { color: ColorEnum.LemonYellow, bold: true } },
  icons: { success: '✅', info: 'ℹ️' }
});

// Per-call metadata for style and icon
logger.info('Success!', { style: 'success', icon: '✅' });
logger.warn('Be careful', { icon: '⚠️' });
logger.info('Custom dreamy color', { style: { color: ColorEnum.DeepPurple, underline: true } });
logger.info('With emoji', { icon: '🚀' });
```

#### Supported Features
- **Semantic styles**: Use names like `'success'`, `'warning'`, `'highlight'`, etc.
- **Custom styles**: Use `ColorEnum` and style config for color, bold, underline, background, etc.
- **Emoji icons**: Use any emoji or semantic icon name (e.g., `'success'`, `'info'`).
- **Global config**: Set default styles/icons in `LoggerConfig`.
- **Per-call override**: Pass metadata as the last argument to any log method.
- **Fallback/warning**: Unknown styles/icons trigger a warning and fallback to defaults.

#### Example: Highlighted Info (replaces `info2()`)
```typescript
// Old:
// logger.info2('Important!');
// New:
logger.info('Important!', { style: 'highlight', icon: '⭐️' });
```

See the [Migration Guide](./OPTIMIZATION.md) for upgrade instructions and more examples.

---
