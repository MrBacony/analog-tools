# Migration Guide: info2() Removal and Metadata-Based Styling

This guide covers the migration from the deprecated `info2()` method to the new metadata-based styling system introduced in version 0.0.6.

## Overview

The `info2()` method has been removed in favor of a more powerful and flexible metadata-based styling system that works with all log methods (`trace`, `debug`, `info`, `warn`, `error`, `fatal`).

## Quick Migration Summary

| Before (Deprecated) | After (Metadata-Based) |
|---------------------|------------------------|
| `logger.info2('message')` | `logger.info('message', { style: 'highlight' })` |
| Custom color libraries | Built-in `ColorEnum` with 256-color support |
| Manual emoji concatenation | `icon` property in metadata |
| Method-specific styling | Universal metadata system |

## Migration Steps

### Step 1: Replace info2() Calls

**Before:**
```typescript
logger.info2('Important message');
logger.info2('Highlighted info');
```

**After:**
```typescript
// Option 1: Use semantic styling
logger.info('Important message', { style: 'highlight' });
logger.info('Highlighted info', { style: 'highlight' });

// Option 2: Use custom styling
logger.info('Important message', { 
  style: { color: ColorEnum.LemonYellow, bold: true } 
});
```

### Step 2: Configure Global Styles

Set up semantic styles globally for consistent theming:

**Before:**
```typescript
const logger = new LoggerService({ level: 'info', name: 'my-app' });
// No global styling configuration
```

**After:**
```typescript
import { LoggerService, ColorEnum } from '@analog-tools/logger';

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
```

### Step 3: Migrate Custom Color Libraries

**Before (using external color libraries):**
```typescript
import chalk from 'chalk';

logger.info(chalk.yellow.bold('Important message'));
logger.info(chalk.green('Success message'));
logger.info(chalk.red('Error message'));
```

**After (using built-in ColorEnum):**
```typescript
import { ColorEnum } from '@analog-tools/logger';

logger.info('Important message', { 
  style: { color: ColorEnum.LemonYellow, bold: true } 
});
logger.info('Success message', { 
  style: { color: ColorEnum.ForestGreen } 
});
logger.info('Error message', { 
  style: { color: ColorEnum.FireRed } 
});
```

### Step 4: Migrate Manual Emoji Usage

**Before:**
```typescript
logger.info('✅ Task completed successfully');
logger.info('⚠️ Warning: Check configuration');
logger.info('❌ Operation failed');
```

**After:**
```typescript
logger.info('Task completed successfully', { icon: '✅' });
logger.info('Warning: Check configuration', { icon: '⚠️' });
logger.info('Operation failed', { icon: '❌' });

// Or use semantic icons
logger.info('Task completed successfully', { 
  style: 'success', 
  icon: 'success' 
});
```

## Advanced Migration Scenarios

### Complex Styling Combinations

**Before:**
```typescript
import chalk from 'chalk';

logger.info(chalk.yellow.bold.underline('⭐️ Important update'));
logger.info(chalk.green('✅ Success'));
logger.info(chalk.red.bold('🔥 Critical error'));
```

**After:**
```typescript
logger.info('Important update', {
  style: { color: ColorEnum.LemonYellow, bold: true, underline: true },
  icon: '⭐️'
});

logger.info('Success', {
  style: { color: ColorEnum.ForestGreen },
  icon: '✅'
});

logger.info('Critical error', {
  style: { color: ColorEnum.FireRed, bold: true },
  icon: '🔥'
});
```

### Context-Specific Styling

**Before:**
```typescript
const authLogger = logger.forContext('auth');
authLogger.info2('User authentication successful');
```

**After:**
```typescript
const authLogger = logger.forContext('auth');
authLogger.info('User authentication successful', {
  style: 'success',
  icon: 'success'
});
```

### Error Handling with Styling

**Before:**
```typescript
try {
  // Some operation
} catch (error) {
  logger.error('Operation failed', error);
  logger.info2('Attempting retry...');
}
```

**After:**
```typescript
try {
  // Some operation
} catch (error) {
  logger.error('Operation failed', error, {
    style: 'error',
    icon: '❌'
  });
  logger.info('Attempting retry...', {
    style: 'warning',
    icon: '🔄'
  });
}
```

## Breaking Changes

### Removed Methods

- `info2()` - Removed entirely
- No direct replacement method

### Behavioral Changes

- **Color system**: Now uses `ColorEnum` instead of external color libraries
- **Metadata parsing**: Last parameter detection for `LoggerMetadata`
- **Fallback behavior**: Unknown styles/icons now log warnings

### Configuration Changes

**Before:**
```typescript
const logger = new LoggerService({
  level: 'info',
  name: 'my-app',
  useColors: true
});
```

**After (with new options):**
```typescript
const logger = new LoggerService({
  level: 'info',
  name: 'my-app',
  useColors: true,
  styles: { /* semantic styles */ },
  icons: { /* semantic icons */ }
});
```

## New Features Available

### 1. Universal Metadata System

All log methods now support metadata:

```typescript
logger.trace('Trace message', { style: 'debug', icon: '🔍' });
logger.debug('Debug info', { style: 'debug', icon: '🐞' });
logger.info('Information', { style: 'info', icon: 'ℹ️' });
logger.warn('Warning', { style: 'warning', icon: '⚠️' });
logger.error('Error', { style: 'error', icon: '❌' });
logger.fatal('Fatal error', { style: 'error', icon: '💀' });
```

### 2. Semantic Styling

Predefined semantic styles for consistency:

```typescript
// Configure once
const logger = new LoggerService({
  styles: {
    highlight: { color: ColorEnum.LemonYellow, bold: true },
    success: { color: ColorEnum.ForestGreen },
    // ... more styles
  }
});

// Use everywhere
logger.info('Success', { style: 'success' });
logger.info('Important', { style: 'highlight' });
```

### 3. Comprehensive Color Palette

256-color support with dreamy color names:

```typescript
// Multiple shades per color family
ColorEnum.SkyBlue, ColorEnum.OceanBlue, ColorEnum.MidnightBlue
ColorEnum.MintGreen, ColorEnum.ForestGreen, ColorEnum.EmeraldGreen
ColorEnum.LemonYellow, ColorEnum.SunflowerYellow, ColorEnum.GoldYellow
// ... and many more
```

### 4. Icon System

Extensive emoji support with validation:

```typescript
// Hundreds of available emojis
logger.info('Process', { icon: '⚡️' });
logger.info('Database', { icon: '🗄️' });
logger.info('Network', { icon: '🌐' });
logger.info('Security', { icon: '🔒' });
```

## Performance Considerations

### Metadata Parsing

The new system parses the last parameter to detect metadata:

```typescript
// Efficiently detects metadata
logger.info('message', { style: 'info' }); // ✅ Parsed as metadata
logger.info('message', { regularData: 'value' }); // ✅ Parsed as data
```

### Memory Usage

The metadata system is optimized for minimal memory overhead:

- Metadata objects are not stored permanently
- Style resolution is cached globally
- Icon validation is optimized

## Testing Migration

### Before
```typescript
// Tests might have checked for info2 calls
expect(mockLogger.info2).toHaveBeenCalledWith('message');
```

### After
```typescript
// Test metadata-based calls
expect(mockLogger.info).toHaveBeenCalledWith('message', { style: 'highlight' });

// Test that styling is applied
const call = mockLogger.info.mock.calls[0];
expect(call[0]).toContain('message');
expect(call[0]).toContain(ColorEnum.LemonYellow); // Check color codes
```

## Troubleshooting

### Common Issues

1. **"Method info2 does not exist"**
   - Solution: Replace `info2()` with `info()` and metadata

2. **"ColorEnum is not defined"**
   - Solution: Import `ColorEnum` from `@analog-tools/logger`

3. **"Styling not applied"**
   - Solution: Ensure `useColors: true` in configuration

4. **"Unknown style warnings"**
   - Solution: Define semantic styles in configuration or use custom style objects

### Debug Tips

Enable debug logging to see metadata processing:

```typescript
const logger = new LoggerService({ level: 'debug', name: 'my-app' });
logger.debug('Metadata test', { style: 'highlight', icon: '🔍' });
```

## Rollback Strategy

If you need to temporarily maintain compatibility:

1. **Gradual migration**: Migrate one module at a time
2. **Feature flags**: Use environment variables to control new features
3. **Wrapper functions**: Create temporary wrapper functions

```typescript
// Temporary wrapper for gradual migration
function info2(message: string) {
  logger.info(message, { style: 'highlight' });
}

// Use during migration period
info2('Legacy message');
```

## Questions and Support

- **Issues**: Report migration problems on GitHub
- **Documentation**: See README.md for complete API reference
- **Examples**: Check the tests for comprehensive usage examples

## Summary

The migration from `info2()` to metadata-based styling provides:

- ✅ **More flexibility**: Works with all log methods
- ✅ **Better performance**: Built-in color system
- ✅ **Type safety**: Full TypeScript support
- ✅ **Consistency**: Unified styling approach
- ✅ **Extensibility**: Easy to add new styles and icons
- ✅ **Backwards compatibility**: Existing log calls continue to work

The new system is more powerful, flexible, and maintainable than the previous `info2()` approach.
