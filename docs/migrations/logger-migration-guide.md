# Migration Guide: Type Safety Improvements

This guide helps you migrate from the previous version of @analog-tools/logger to the new version with enhanced type safety.

## Overview of Changes

The new version introduces strict type safety for log levels while maintaining backwards compatibility through runtime validation.

### What Changed

- **LoggerConfig.level**: Changed from `string?` to `LogLevel?`
- **Nitro integration**: Updated `withLogging` options to use `LogLevel`
- **New exports**: Added `LogLevel` enum, `LogLevel` type, and `isValidLogLevel` function
- **Runtime validation**: Invalid log levels now trigger warnings and fallback to 'info'
- **Improved error handling**: Error/fatal methods no longer pass `undefined` to console

## Breaking Changes

### 1. Type Constraints for Log Levels

**Before:**
```typescript
interface LoggerConfig {
  level?: string; // Any string was accepted
}

const config = {
  level: 'verbose' // This would compile but fail silently
};
```

**After:**
```typescript
interface LoggerConfig {
  level?: LogLevel; // Only valid log levels accepted
}

const config = {
  level: 'verbose' // ❌ TypeScript error
  level: 'debug'   // ✅ Valid
};
```

### 2. Nitro Integration Type Updates

**Before:**
```typescript
withLogging(handler, {
  level: 'debug' | 'info' // Limited to two options
});
```

**After:**
```typescript
withLogging(handler, {
  level: LogLevel // All valid log levels supported
});
```

### 3. Console Error Behavior

**Before:**
```typescript
logger.error('Message'); // console.error('Message', undefined)
```

**After:**
```typescript
logger.error('Message'); // console.error('Message') - no undefined
```

## Migration Steps

### Step 1: Update Type Annotations

If you have explicit type annotations, update them:

```typescript
// Before
let logLevel: string = 'debug';

// After
import { LogLevel } from '@analog-tools/logger';
let logLevel: LogLevel = 'debug';
```

### Step 2: Handle Dynamic Log Levels

For log levels from external sources (environment variables, config files):

```typescript
// Before
const logger = new LoggerService({
  level: process.env.LOG_LEVEL // Could be any string
});

// After - Option 1: Type assertion with runtime validation
const logger = new LoggerService({
  level: process.env.LOG_LEVEL as LogLevel // Runtime validation handles invalid values
});

// After - Option 2: Explicit validation
import { isValidLogLevel, LogLevel } from '@analog-tools/logger';

const envLevel = process.env.LOG_LEVEL;
const logLevel: LogLevel = isValidLogLevel(envLevel) ? envLevel : 'info';
const logger = new LoggerService({ level: logLevel });
```

### Step 3: Update Nitro Integration

```typescript
// Before
import { withLogging } from '@analog-tools/logger';

export default withLogging(handler, {
  level: 'debug' // Limited options
});

// After
import { withLogging, LogLevel } from '@analog-tools/logger';

export default withLogging(handler, {
  level: 'trace' as LogLevel // All levels supported
});
```

### Step 4: Update Tests

If your tests rely on specific console.error call signatures:

```typescript
// Before
expect(mockConsole.error).toHaveBeenCalledWith(
  '[logger] Error message',
  undefined // This was passed before
);

// After
expect(mockConsole.error).toHaveBeenCalledWith(
  '[logger] Error message'
  // No undefined parameter
);
```

## Non-Breaking Changes

These changes are additive and don't require code updates:

### New Exports

```typescript
// New exports available
import { 
  LogLevel,        // Enum for numeric log levels
  LogLevel,  // Type for log level strings
  isValidLogLevel  // Type guard function
} from '@analog-tools/logger';
```

### Runtime Validation

Invalid log levels now show helpful warnings:

```typescript
const logger = new LoggerService({ level: 'invalid' as LogLevel });
// Console: [LoggerService] Invalid log level "invalid". Falling back to "info". Valid levels: trace, debug, info, warn, error, fatal, silent
```

## Benefits After Migration

### 1. Better Developer Experience

- **IntelliSense**: Auto-completion for valid log levels
- **Compile-time errors**: Catch invalid log levels during development
- **Type safety**: Prevent runtime errors from typos

### 2. Runtime Safety

- **Graceful fallback**: Invalid levels default to 'info' with warning
- **Clear error messages**: Helpful guidance when validation fails
- **Backwards compatibility**: Existing code continues to work

### 3. Improved API

- **Consistent exports**: LogLevel enum for all use cases
- **Type guards**: isValidLogLevel for external validation
- **Cleaner console output**: No unnecessary undefined parameters

## Troubleshooting

### TypeScript Errors

**Error: Type 'string' is not assignable to type 'LogLevel'**

```typescript
// ❌ Problem
const level = getUserPreference(); // Returns string
const logger = new LoggerService({ level });

// ✅ Solution
const level = getUserPreference();
const logger = new LoggerService({ 
  level: isValidLogLevel(level) ? level : 'info'
});
```

**Error: Argument of type 'undefined' is not assignable**

```typescript
// ❌ Problem
const config: LoggerConfig = {
  level: process.env.LOG_LEVEL // Could be undefined
};

// ✅ Solution
const config: LoggerConfig = {
  level: (process.env.LOG_LEVEL as LogLevel) || 'info'
};
```

### Runtime Warnings

**Warning: Invalid log level**

This indicates your code is passing an invalid log level. Check the source:

1. Environment variables
2. Configuration files  
3. User input
4. Default values

Use `isValidLogLevel()` to validate before use.

## Support

If you encounter issues during migration:

1. Check this guide for common scenarios
2. Ensure you're using valid log levels: `trace`, `debug`, `info`, `warn`, `error`, `fatal`, `silent`
3. Use TypeScript's IntelliSense to see available options
4. Check console warnings for runtime validation failures

The migration is designed to be smooth with minimal breaking changes. Most existing code will work without modification, and TypeScript will guide you to any necessary updates.
