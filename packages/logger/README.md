# @analog-tools/logger

> **Early Development Stage** -- Breaking changes may happen frequently as the APIs evolve.

Structured logging for AnalogJS, Nitro, and H3-based server applications. Provides context-based child loggers, log deduplication, error serialization with circular reference handling, and pluggable output formatters (console with ANSI colors, JSON for log aggregation, or custom).

[![npm version](https://img.shields.io/npm/v/@analog-tools/logger.svg)](https://www.npmjs.com/package/@analog-tools/logger)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Log Levels](#log-levels)
- [Context-Based Logging](#context-based-logging)
- [Formatters](#formatters)
- [Error Handling](#error-handling)
- [Log Deduplication](#log-deduplication)
- [Log Sanitization](#log-sanitization)
- [Log Sanitization](#log-sanitization)
- [Nitro/H3 Integration](#nitroh3-integration)
- [Usage with @analog-tools/inject](#usage-with-analog-toolsinject)
- [Lazy Message Evaluation](#lazy-message-evaluation)
- [Styling and Icons](#styling-and-icons)
- [Correlation ID Tracking](#correlation-id-tracking)
- [Log Grouping](#log-grouping)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [License](#license)

## Installation

```bash
npm install @analog-tools/logger
```

Peer dependency (optional -- only required for Nitro integration and DI patterns):

```bash
npm install @analog-tools/inject
```

## Quick Start

```typescript
import { LoggerService } from '@analog-tools/logger';

const logger = new LoggerService({
  level: 'info',
  name: 'my-app',
});

logger.info('Server started on port 3000');
logger.warn('Cache miss for key user:123');
logger.error('Failed to connect to database', new Error('ECONNREFUSED'));

// Create a child logger with context
const dbLogger = logger.forContext('database');
dbLogger.debug('Query executed in 42ms');
```

## Log Levels

Seven levels, ordered by severity:

| Level    | Numeric | Console Method | Use Case                                |
|----------|---------|----------------|-----------------------------------------|
| `trace`  | 0       | `console.trace` | Granular diagnostics, function entry/exit |
| `debug`  | 1       | `console.debug` | Development-time debugging              |
| `info`   | 2       | `console.info`  | Normal operational events               |
| `warn`   | 3       | `console.warn`  | Recoverable issues, deprecation notices |
| `error`  | 4       | `console.error` | Failures requiring attention            |
| `fatal`  | 5       | `console.error` | Unrecoverable errors, imminent shutdown |
| `silent` | 6       | (none)          | Suppress all output                     |

Messages at levels below the configured threshold are discarded without evaluation:

```typescript
const logger = new LoggerService({ level: 'warn' });

logger.debug('skipped'); // not logged
logger.info('skipped');  // not logged
logger.warn('logged');   // logged
logger.error('logged');  // logged
```

The `LogLevel` type provides compile-time checking:

```typescript
import { LogLevel, isValidLogLevel } from '@analog-tools/logger';

const level: LogLevel = 'debug'; // IntelliSense autocomplete

// Runtime validation for external input
const envLevel = process.env['LOG_LEVEL'] || 'info';
if (isValidLogLevel(envLevel)) {
  new LoggerService({ level: envLevel });
}
```

Invalid levels passed to the constructor throw a `LoggerError`:

```typescript
import { LoggerError } from '@analog-tools/logger';

try {
  new LoggerService({ level: 'verbose' as LogLevel }); // throws LoggerError
} catch (e) {
  // "Invalid log level: verbose. Valid levels: trace, debug, info, warn, error, fatal, silent."
}
```

## Context-Based Logging

`forContext()` creates child loggers that share configuration with the parent but include a context label in output. Child loggers are cached -- calling `forContext('db')` twice returns the same instance.

```typescript
const logger = new LoggerService({ level: 'debug', name: 'my-app' });

const authLogger = logger.forContext('auth');
const dbLogger = logger.forContext('database');

authLogger.info('User authenticated');
// Output: [my-app:auth] User authenticated

dbLogger.error('Connection pool exhausted');
// Output: [my-app:database] Connection pool exhausted
```

### Disabling Contexts

Suppress output from specific contexts without changing log levels:

```typescript
const logger = new LoggerService({
  level: 'debug',
  name: 'my-app',
  disabledContexts: ['verbose-polling', 'health-check'],
});

const polling = logger.forContext('verbose-polling');
polling.info('tick'); // suppressed

// Modify at runtime
logger.setDisabledContexts(['health-check']);
polling.info('tick'); // now logged
```

## Formatters

The logger supports pluggable output formatters. The default is `ConsoleFormatter` (ANSI-colored terminal output). A `JsonFormatter` is included for structured log aggregation, and you can provide a custom formatter function.

### Console Formatter (default)

```typescript
const logger = new LoggerService({
  name: 'my-app',
  level: 'info',
  useColors: true, // default; set false to strip ANSI codes
});
```

### JSON Formatter

Outputs one JSON object per log line -- useful for piping to log aggregation tools (Datadog, ELK, CloudWatch):

```typescript
import { FormatterFactory } from '@analog-tools/logger';

const logger = new LoggerService({
  name: 'my-app',
  level: 'info',
  formatter: FormatterFactory.createJson(),
});

logger.info('Request handled', { userId: '42', duration: 150 });
// Output: {"timestamp":"2025-01-15T10:30:00.000Z","level":"info","logger":"my-app","message":"Request handled","metadata":{"userId":"42","duration":150}}

// Pretty-print for development
const devLogger = new LoggerService({
  formatter: FormatterFactory.createJson({ prettyPrint: true }),
});
```

### Custom Formatter

```typescript
import { FormatterFactory, LogEntry } from '@analog-tools/logger';

const logger = new LoggerService({
  name: 'my-app',
  formatter: FormatterFactory.createCustom((entry: LogEntry) => {
    return `${entry.timestamp.toISOString()} [${entry.level}] ${entry.message}`;
  }),
});
```

The `LogEntry` interface passed to custom formatters contains:

```typescript
interface LogEntry {
  readonly level: LogLevelEnum;
  readonly message: string;
  readonly logger: string;
  readonly timestamp: Date;
  readonly context?: string;
  readonly metadata?: Record<string, unknown>;
  readonly error?: Error;
  readonly styling?: LogStyling;
  readonly correlationId?: string;
}
```

## Error Handling

The `error()` and `fatal()` methods accept multiple call signatures:

```typescript
// Message only
logger.error('Connection refused');

// Error object only (message extracted automatically)
logger.error(new Error('ECONNREFUSED'));

// Message + Error
logger.error('Database query failed', new Error('timeout'));

// Message + structured context
logger.error('Validation failed', { field: 'email', value: 'not-an-email' });

// Message + Error + context
logger.error('Payment failed', paymentError, {
  orderId: 'ord-123',
  amount: 99.99,
});
```

### ErrorSerializer

Errors are serialized using `ErrorSerializer`, which handles:

- Circular references (replaced with `[Circular Reference]`)
- Deep object graphs (configurable `maxDepth`, default 10)
- `Error.cause` chains (Node.js 16+)
- Non-enumerable properties (opt-in)

Direct usage for custom serialization needs:

```typescript
import { ErrorSerializer } from '@analog-tools/logger';

const serialized = ErrorSerializer.serialize(error, {
  includeStack: false,        // omit stack traces in production logs
  maxDepth: 5,                // limit object traversal depth
  includeNonEnumerable: true, // include non-enumerable properties
});
```

The serializer caches results (up to 100 entries) based on error identity to avoid repeated serialization of the same error.

## Log Deduplication

`LogDeduplicator` batches identical messages within a time window and outputs them with a repeat count. Only simple messages (no metadata or extra data) are deduplicated.

```typescript
const logger = new LoggerService({
  level: 'info',
  name: 'my-app',
  deduplication: {
    enabled: true,
    windowMs: 5000,        // batch window (default: 5000ms)
    flushOnCritical: true, // flush pending messages on error/fatal (default: true)
  },
});

// These three calls produce one output line after the window expires:
logger.info('Retrying connection...');
logger.info('Retrying connection...');
logger.info('Retrying connection...');
// Output after 5s: [my-app] Retrying connection... (x3)
```

Behavior details:

- Error and fatal messages bypass deduplication entirely and log immediately.
- Messages with metadata, styling, or extra data arguments are never batched.
- Different contexts are tracked separately (a child logger's messages do not batch with the parent's).
- Different log levels are tracked separately even for the same message text.

## Log Sanitization

The logger sanitizes sensitive data by default to prevent accidental exposure in logs. Sanitization is enabled out of the box with secure defaults.

### Default Behavior

Sensitive data patterns are automatically redacted:

```typescript
const logger = new LoggerService({ level: 'info' });

logger.info('User login', {
  password: 'mySecretPassword123',  // → [REDACTED]
  token: 'abc123def456ghi789jkl',   // → [TOKEN] (base64-like)
  email: 'user@example.com',        // → [EMAIL]
  creditCard: '4532-1234-5678-9012', // → [CARD]
  ip: '192.168.1.1',                // → [IP]
});
```

### Sensitive Key Detection

Object properties with sensitive names are fully redacted regardless of value:
- `password`, `token`, `secret`, `apiKey`, `authorization`, `credential`, `private`

### Log Injection Protection

Control characters (newlines, tabs, etc.) are escaped to prevent log injection attacks:

```typescript
logger.info('Malicious\ninjection\tattempt');
// Output: Malicious\ninjection\tattempt
```

### Configuration

#### Opt-Out for Development

```typescript
const logger = new LoggerService({
  level: 'debug',
  sanitization: { enabled: false }, // Disable for local debugging
});
```

#### Custom Rules (Append to Defaults)

```typescript
const logger = new LoggerService({
  sanitization: {
    customRules: [
      { pattern: /userId:\s*\d+/gi, replacement: 'userId: [USER_ID]' },
    ],
  },
});
```

#### Replace Default Rules

```typescript
const logger = new LoggerService({
  sanitization: {
    rules: [
      { pattern: /secret/gi, replacement: '***' },
    ],
  },
});
```

### Sanitization Strategies

| Strategy | Description | Example |
|----------|-------------|---------|
| `mask` | Replace with string (default) | `secret` → `[REDACTED]` |
| `remove` | Remove matched text | `my secret` → `my ` |
| `hash` | Replace with truncated hash | `secret` → `[HASH:a3f2b1c8]` |
| `custom` | Custom handler function | `1234-5678` → `****-5678` |

```typescript
const logger = new LoggerService({
  sanitization: {
    customRules: [
      // Hash emails for correlation without exposing PII
      { pattern: /\b[\w.]+@[\w.]+\.\w+\b/g, strategy: 'hash', hashLength: 8 },
      
      // Partial mask for credit cards
      {
        pattern: /\b(\d{4})-?\d{4}-?\d{4}-?(\d{4})\b/g,
        strategy: 'custom',
        customHandler: (match: string) => `****-****-****-${match.slice(-4)}`,
      },
    ],
  },
});
```

### Performance Notes

- Rules are compiled once at logger construction
- Sanitization skipped entirely when `enabled: false`
- Object traversal respects `maxDepth` (default: 10) to prevent stack overflow
- Circular references handled safely

## Nitro/H3 Integration

Two utilities for adding logging to Nitro event handlers. Both require `@analog-tools/inject` as they use `inject(LoggerService)` internally.

### Middleware

Attaches a logger to the event context and logs incoming requests at debug level:

```typescript
// src/server/middleware/logging.ts
import { createLoggerMiddleware } from '@analog-tools/logger';

export default createLoggerMiddleware('api');
// Adds event.context['logger'] as a LoggerService instance
```

### Handler Wrapper

Wraps a handler with request timing and error logging:

```typescript
// src/server/routes/api/products/index.ts
import { defineEventHandler } from 'h3';
import { withLogging } from '@analog-tools/logger';

export default withLogging(
  defineEventHandler(() => {
    return { products: [] };
  }),
  {
    namespace: 'products-api', // context name (default: 'api')
    level: 'info',             // log level for success (default: 'debug')
    logResponse: true,         // include response body in log (default: false)
  }
);
// On success: "[my-app:products-api] Request completed in 12ms"
// On error: "[my-app:products-api] Request failed after 45ms" + serialized error
```

## Usage with @analog-tools/inject

The logger works standalone (direct instantiation) or with the `@analog-tools/inject` DI system. `LoggerService` has `static INJECTABLE = true` set, so it can be registered and injected:

```typescript
import { inject, registerService } from '@analog-tools/inject';
import { LoggerService } from '@analog-tools/logger';

// Register with configuration
registerService(LoggerService, {
  level: 'debug',
  name: 'my-app',
  disabledContexts: ['health-check'],
});

// Inject in services
class OrderService {
  private logger = inject(LoggerService).forContext('orders');

  async createOrder(data: OrderData) {
    this.logger.info('Creating order', { customerId: data.customerId });
    // ...
  }
}
```

For projects not using DI, create and share instances directly:

```typescript
// src/server/utils/logger.ts
import { LoggerService } from '@analog-tools/logger';

export const logger = new LoggerService({
  level: process.env['LOG_LEVEL'] || 'info',
  name: 'my-api',
});
```

## Lazy Message Evaluation

Pass a function instead of a string to defer expensive computations. The function is only called if the message will actually be logged:

```typescript
// Always evaluates JSON.stringify, even when debug is disabled
logger.debug(JSON.stringify(largeObject)); // wasteful

// Only evaluates when debug level is active
logger.debug(() => JSON.stringify(largeObject));

// Complex computation
logger.trace(() => {
  const metrics = gatherSystemMetrics();
  return `System: ${JSON.stringify(metrics)}`;
});
```

If the function throws, the logger catches the error and outputs a placeholder message instead of crashing:

```typescript
logger.info(() => {
  throw new Error('oops');
});
// Output: [my-app] [Message evaluation failed: Error: oops]
```

Use lazy evaluation only for genuinely expensive operations. For plain strings, pass them directly -- the overhead of a function call is not worth it.

## Styling and Icons

Log messages can include ANSI styling and emoji icons via the metadata parameter. This works with the console formatter only (JSON formatter ignores styling).

```typescript
import { LoggerService, ColorEnum } from '@analog-tools/logger';

const logger = new LoggerService({
  level: 'info',
  name: 'my-app',
  styles: {
    highlight: { color: ColorEnum.LemonYellow, bold: true },
    success: { color: ColorEnum.ForestGreen },
  },
  icons: {
    success: '✅',
    warning: '⚠️',
  },
});

// Semantic style name
logger.info('Deployment complete', { style: 'success', icon: '✅' });

// Inline style object
logger.warn('Disk usage at 90%', {
  style: { color: ColorEnum.TangerineOrange, bold: true },
  icon: '⚠️',
});
```

Available semantic styles: `highlight`, `accent`, `attention`, `success`, `warning`, `error`, `info`, `debug`.

Color control:

```typescript
// Disable ANSI colors (icons still appear)
logger.setUseColors(false);

// Or via constructor
new LoggerService({ useColors: false });
```

## Correlation ID Tracking

Attach a correlation ID to a logger instance for request-scoped tracing. The ID appears in formatted output (both console and JSON formatters support it):

```typescript
const logger = new LoggerService({ name: 'my-app' });
logger.setCorrelationId('req-abc-123');

logger.info('Processing request');
// JSON output includes: "correlationId": "req-abc-123"

logger.clearCorrelationId();
```

You can also set it at construction time:

```typescript
const logger = new LoggerService({
  name: 'my-app',
  correlationId: 'req-abc-123',
});
```

## Log Grouping

Visual grouping uses `console.group` / `console.groupEnd` under the hood:

```typescript
logger.group('Database Migration');
logger.info('Running migration 001_create_users');
logger.info('Running migration 002_add_indexes');
logger.groupEnd('Database Migration');

// Nested groups
logger.group('Request Processing');
logger.info('Validating input');
logger.group('Database Queries');
logger.debug('SELECT * FROM users WHERE id = $1');
logger.groupEnd('Database Queries');
logger.groupEnd('Request Processing');

// End most recent group without specifying name
logger.group('Batch Job');
logger.info('Processing...');
logger.groupEnd();
```

## Environment Variables

```bash
LOG_LEVEL=debug                              # Default log level (default: info)
LOG_DISABLED_CONTEXTS=health-check,polling   # Comma-separated contexts to suppress
```

These are read at construction time if the corresponding config option is not explicitly provided.

## API Reference

### LoggerService

```typescript
class LoggerService {
  static INJECTABLE = true;

  constructor(config?: LoggerConfig);

  // Child loggers
  forContext(context: string): LoggerService;

  // Log methods (all accept string | () => string)
  trace(message: LogMessage, ...data: unknown[]): void;
  debug(message: LogMessage, ...data: unknown[]): void;
  info(message: LogMessage, ...data: unknown[]): void;
  warn(message: LogMessage, ...data: unknown[]): void;
  error(messageOrError: string | Error, ...args: unknown[]): void;
  fatal(messageOrError: string | Error, ...args: unknown[]): void;

  // Grouping
  group(groupName: string): void;
  groupEnd(groupName?: string): void;

  // Configuration
  getLogLevel(): LogLevelEnum;
  getDisabledContexts(): string[];
  setDisabledContexts(contexts: string[]): void;
  setUseColors(enabled: boolean): void;
  getUseColors(): boolean;
  setCorrelationId(id: string): void;
  getCorrelationId(): string | undefined;
  clearCorrelationId(): void;
}
```

### LoggerConfig

```typescript
interface LoggerConfig {
  level?: LogLevel;             // default: 'info' (or LOG_LEVEL env var)
  name?: string;                // default: 'analog-tools'
  disabledContexts?: string[];  // contexts to suppress
  useColors?: boolean;          // default: true
  formatter?: ILogFormatter;    // default: ConsoleFormatter
  correlationId?: string;       // request-scoped tracing ID
  styles?: Partial<Record<SemanticStyleName, StyleConfig>>;
  icons?: Partial<Record<string, Icon>>;
  deduplication?: {
    enabled: boolean;
    windowMs?: number;          // default: 5000
    flushOnCritical?: boolean;  // default: true
  };
}
```

### FormatterFactory

```typescript
class FormatterFactory {
  static createConsole(config?: { useColors?: boolean }): ILogFormatter;
  static createJson(config?: { prettyPrint?: boolean }): ILogFormatter;
  static createCustom(fn: (entry: LogEntry) => string): ILogFormatter;
}
```

### ErrorSerializer

```typescript
class ErrorSerializer {
  static serialize(
    error: unknown,
    options?: {
      includeStack?: boolean;        // default: true
      maxDepth?: number;             // default: 10
      includeNonEnumerable?: boolean; // default: false
    }
  ): StructuredError | string;
}
```

### LogDeduplicator

```typescript
class LogDeduplicator {
  constructor(config: DeduplicationConfig, formatter: ILogFormatter, loggerName: string);
  addMessage(level: LogLevelEnum, message: string, context?: string): boolean;
  flush(): void;
  destroy(): void;
}
```

### Nitro Utilities

```typescript
function createLoggerMiddleware(namespace?: string): EventHandler;

function withLogging<T extends EventHandlerRequest>(
  handler: EventHandler<T>,
  options?: {
    namespace?: string;
    level?: LogLevel;
    logResponse?: boolean;
  }
): EventHandler<T>;
```

## License

MIT
