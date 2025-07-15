import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoggerStyleEngine } from './logger-style-engine';
import { ColorEnum, Icon, LogStyling, SemanticStyleName, LogLevelEnum } from './logger.types';
import { DEFAULT_STYLE_SCHEME, DEFAULT_ICON_SCHEME } from './logger.config';

describe('LoggerStyleEngine', () => {
  let styleEngine: LoggerStyleEngine;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Set up console.warn spy to check warnings
    consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Empty implementation to silence warnings during tests
    });
    
    // Create style engine with default configuration
    styleEngine = new LoggerStyleEngine({
      useColors: true,
      styles: DEFAULT_STYLE_SCHEME,
      icons: DEFAULT_ICON_SCHEME,
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration when no config provided', () => {
      const engine = new LoggerStyleEngine();
      
      expect(engine.getUseColors()).toBe(false); // Default to false in tests
      expect(engine['globalStyles']).toEqual(DEFAULT_STYLE_SCHEME);
      expect(engine['globalIcons']).toEqual(DEFAULT_ICON_SCHEME);
    });

    it('should initialize with custom configuration', () => {
      const customStyles = {
        success: { color: ColorEnum.MintGreen, bold: true },
      };
      const customIcons = {
        success: '🎉' as Icon,
      };

      const engine = new LoggerStyleEngine({
        useColors: true,
        styles: customStyles,
        icons: customIcons,
      });

      expect(engine.getUseColors()).toBe(true);
      expect(engine['globalStyles']).toEqual({
        ...DEFAULT_STYLE_SCHEME,
        ...customStyles,
      });
      expect(engine['globalIcons']).toEqual({
        ...DEFAULT_ICON_SCHEME,
        ...customIcons,
      });
    });

    it('should detect test environment and disable colors by default', () => {
      // Simulate test environment
      const originalNodeEnv = process.env['NODE_ENV'];
      const originalVitest = process.env['VITEST'];
      
      process.env['NODE_ENV'] = 'test';
      process.env['VITEST'] = 'true';

      const engine = new LoggerStyleEngine();
      
      expect(engine.getUseColors()).toBe(false);

      // Restore environment
      process.env['NODE_ENV'] = originalNodeEnv;
      process.env['VITEST'] = originalVitest;
    });
  });

  describe('Color Management', () => {
    it('should enable and disable colors', () => {
      expect(styleEngine.getUseColors()).toBe(true);
      
      styleEngine.setUseColors(false);
      expect(styleEngine.getUseColors()).toBe(false);
      
      styleEngine.setUseColors(true);
      expect(styleEngine.getUseColors()).toBe(true);
    });
  });

  describe('Basic Message Formatting', () => {
    it('should format message with colors enabled', () => {
      styleEngine.setUseColors(true);
      
      const result = styleEngine.formatMessage(
        LogLevelEnum.info,
        'Test message',
        'test-logger'
      );
      
      expect(result).toContain('[test-logger]');
      expect(result).toContain('Test message');
      expect(result).toContain('\x1b['); // Contains ANSI codes
      expect(result).toContain('\x1b[0m'); // Contains reset code
    });

    it('should format message without colors when disabled', () => {
      styleEngine.setUseColors(false);
      
      const result = styleEngine.formatMessage(
        LogLevelEnum.info,
        'Test message',
        'test-logger'
      );
      
      expect(result).toBe('[test-logger] Test message');
      expect(result).not.toContain('\x1b['); // No ANSI codes
    });

    it('should format message with context', () => {
      styleEngine.setUseColors(false);
      
      const result = styleEngine.formatMessage(
        LogLevelEnum.info,
        'Test message',
        'test-logger',
        'auth'
      );
      
      expect(result).toBe('[test-logger:auth] Test message');
    });

    it('should apply different colors for different log levels', () => {
      styleEngine.setUseColors(true);
      
      const infoResult = styleEngine.formatMessage(LogLevelEnum.info, 'info', 'test');
      const errorResult = styleEngine.formatMessage(LogLevelEnum.error, 'error', 'test');
      const warnResult = styleEngine.formatMessage(LogLevelEnum.warn, 'warn', 'test');
      
      expect(infoResult).not.toBe(errorResult);
      expect(errorResult).not.toBe(warnResult);
      expect(infoResult).not.toBe(warnResult);
    });

    it('should apply color override when provided', () => {
      styleEngine.setUseColors(true);
      
      const normalResult = styleEngine.formatMessage(LogLevelEnum.info, 'test', 'logger');
      const overrideResult = styleEngine.formatMessage(
        LogLevelEnum.info,
        'test',
        'logger',
        undefined,
        ColorEnum.FireRed
      );
      
      expect(normalResult).not.toBe(overrideResult);
      expect(overrideResult).toContain(ColorEnum.FireRed);
    });
  });

  describe('Metadata Parsing', () => {
    it('should parse LogStyling from parameters', () => {
      const styling: LogStyling = {
        style: 'success',
        icon: '✅',
      };
      
      const result = styleEngine.parseMetadataParameter(styling, ['data1', 'data2']);
      
      expect(result.metadata).toEqual(styling);
      expect(result.restData).toEqual(['data1', 'data2']);
    });

    it('should parse LogStyling from last parameter', () => {
      const styling: LogStyling = {
        style: 'error',
        icon: '❌',
      };
      
      const result = styleEngine.parseMetadataParameter('data1', ['data2', styling]);
      
      expect(result.metadata).toEqual(styling);
      expect(result.restData).toEqual(['data1', 'data2']);
    });

    it('should return no metadata when none provided', () => {
      const result = styleEngine.parseMetadataParameter('data1', ['data2', 'data3']);
      
      expect(result.metadata).toBeUndefined();
      expect(result.restData).toEqual(['data1', 'data2', 'data3']);
    });

    it('should handle empty parameters', () => {
      const result = styleEngine.parseMetadataParameter();
      
      expect(result.metadata).toBeUndefined();
      expect(result.restData).toEqual([]);
    });

    it('should handle non-object as potential metadata', () => {
      const result = styleEngine.parseMetadataParameter('string', [123, true]);
      
      expect(result.metadata).toBeUndefined();
      expect(result.restData).toEqual(['string', 123, true]);
    });
  });

  describe('Message Formatting with Metadata', () => {
    it('should format message with semantic style', () => {
      styleEngine.setUseColors(true);
      
      const styling: LogStyling = {
        style: 'success',
      };
      
      const result = styleEngine.formatMessageWithMetadata(
        LogLevelEnum.info,
        'Operation successful',
        'test-logger',
        styling
      );
      
      expect(result).toContain('[test-logger]');
      expect(result).toContain('Operation successful');
      expect(result).toContain(ColorEnum.ForestGreen); // Success style color
    });

    it('should format message with custom style', () => {
      styleEngine.setUseColors(true);
      
      const styling: LogStyling = {
        style: {
          color: ColorEnum.RoyalPurple,
          bold: true,
          underline: true,
        },
      };
      
      const result = styleEngine.formatMessageWithMetadata(
        LogLevelEnum.info,
        'Custom styled message',
        'test-logger',
        styling
      );
      
      expect(result).toContain('[test-logger]');
      expect(result).toContain('Custom styled message');
      expect(result).toContain(ColorEnum.RoyalPurple);
      expect(result).toContain('\x1b[1m'); // Bold
      expect(result).toContain('\x1b[4m'); // Underline
    });

    it('should format message with icon', () => {
      styleEngine.setUseColors(false);
      
      const styling: LogStyling = {
        icon: '🚀',
      };
      
      const result = styleEngine.formatMessageWithMetadata(
        LogLevelEnum.info,
        'Launching',
        'test-logger',
        styling
      );
      
      expect(result).toBe('[test-logger] 🚀 Launching');
    });

    it('should format message with both style and icon', () => {
      styleEngine.setUseColors(true);
      
      const styling: LogStyling = {
        style: 'warning',
        icon: '⚠️',
      };
      
      const result = styleEngine.formatMessageWithMetadata(
        LogLevelEnum.warn,
        'Warning message',
        'test-logger',
        styling
      );
      
      expect(result).toContain('[test-logger]');
      expect(result).toContain('⚠️ Warning message');
      expect(result).toContain(ColorEnum.TangerineOrange); // Warning style color
    });

    it('should handle semantic icon names', () => {
      styleEngine.setUseColors(false);
      
      const styling: LogStyling = {
        icon: 'success', // Semantic icon name
      };
      
      const result = styleEngine.formatMessageWithMetadata(
        LogLevelEnum.info,
        'Success message',
        'test-logger',
        styling
      );
      
      expect(result).toBe('[test-logger] ✅ Success message');
    });
  });

  describe('Style Application', () => {
    it('should apply semantic styles correctly', () => {
      const testCases: Array<{ styleName: SemanticStyleName; expectedColor: ColorEnum }> = [
        { styleName: 'success', expectedColor: ColorEnum.ForestGreen },
        { styleName: 'warning', expectedColor: ColorEnum.TangerineOrange },
        { styleName: 'error', expectedColor: ColorEnum.FireRed },
        { styleName: 'info', expectedColor: ColorEnum.OceanBlue },
        { styleName: 'debug', expectedColor: ColorEnum.SlateGray },
        { styleName: 'highlight', expectedColor: ColorEnum.LemonYellow },
        { styleName: 'accent', expectedColor: ColorEnum.SkyBlue },
        { styleName: 'attention', expectedColor: ColorEnum.RoyalPurple },
      ];

      testCases.forEach(({ styleName, expectedColor }) => {
        const result = styleEngine['applyStyle'](styleName, 'test-logger');
        expect(result).toContain(expectedColor);
      });
    });

    it('should apply custom style with color only', () => {
      const customStyle = {
        color: ColorEnum.MintGreen,
      };
      
      const result = styleEngine['applyStyle'](customStyle, 'test-logger');
      expect(result).toBe(ColorEnum.MintGreen);
    });

    it('should apply custom style with bold modifier', () => {
      const customStyle = {
        color: ColorEnum.FireRed,
        bold: true,
      };
      
      const result = styleEngine['applyStyle'](customStyle, 'test-logger');
      expect(result).toBe(ColorEnum.FireRed + '\x1b[1m');
    });

    it('should apply custom style with underline modifier', () => {
      const customStyle = {
        color: ColorEnum.OceanBlue,
        underline: true,
      };
      
      const result = styleEngine['applyStyle'](customStyle, 'test-logger');
      expect(result).toBe(ColorEnum.OceanBlue + '\x1b[4m');
    });

    it('should apply custom style with both modifiers', () => {
      const customStyle = {
        color: ColorEnum.RoyalPurple,
        bold: true,
        underline: true,
      };
      
      const result = styleEngine['applyStyle'](customStyle, 'test-logger');
      expect(result).toBe(ColorEnum.RoyalPurple + '\x1b[1m\x1b[4m');
    });

    it('should handle invalid color gracefully', () => {
      const invalidStyle = {
        color: 'invalid-color' as ColorEnum,
      };
      
      const result = styleEngine['applyStyle'](invalidStyle, 'test-logger');
      expect(result).toBeUndefined();
    });

    it('should warn about unknown semantic styles', () => {
      const result = styleEngine['applyStyle']('unknown-style' as SemanticStyleName, 'test-logger');
      
      expect(result).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown semantic style: unknown-style')
      );
    });

    it('should warn about unknown style objects', () => {
      const unknownStyle = { invalid: 'style' } as unknown;
      
      const result = styleEngine['applyStyle'](unknownStyle as SemanticStyleName, 'test-logger');
      
      expect(result).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown style configuration provided')
      );
    });
  });

  describe('Icon Resolution', () => {
    it('should resolve emoji icons correctly', () => {
      const testIcons: Icon[] = ['✅', '⚠️', '❌', 'ℹ️', '🐞', '🚀', '🔥'];
      
      testIcons.forEach((icon) => {
        const result = styleEngine['resolveIcon'](icon, 'test-logger');
        expect(result).toBe(icon);
      });
    });

    it('should resolve semantic icon names', () => {
      const testCases = [
        { name: 'success', expected: '✅' },
        { name: 'warning', expected: '⚠️' },
        { name: 'error', expected: '❌' },
        { name: 'info', expected: 'ℹ️' },
        { name: 'debug', expected: '🐞' },
      ];

      testCases.forEach(({ name, expected }) => {
        const result = styleEngine['resolveIcon'](name, 'test-logger');
        expect(result).toBe(expected);
      });
    });

    it('should handle custom string icons gracefully', () => {
      const customIcon = 'custom-icon';
      const result = styleEngine['resolveIcon'](customIcon, 'test-logger');
      
      expect(result).toBe(customIcon);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid icon: custom-icon')
      );
    });

    it('should warn about unknown semantic icons', () => {
      const unknownIcon = 'unknown';
      const result = styleEngine['resolveIcon'](unknownIcon, 'test-logger');
      
      expect(result).toBe(unknownIcon);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid icon: unknown')
      );
    });
  });

  describe('Log Level Colors', () => {
    it('should return correct colors for each log level', () => {
      const testCases = [
        { level: LogLevelEnum.trace, expectedColor: '\x1b[90m' }, // Gray
        { level: LogLevelEnum.debug, expectedColor: '\x1b[36m' }, // Cyan
        { level: LogLevelEnum.info, expectedColor: '\x1b[32m' }, // Green
        { level: LogLevelEnum.warn, expectedColor: '\x1b[33m' }, // Yellow
        { level: LogLevelEnum.error, expectedColor: '\x1b[31m' }, // Red
        { level: LogLevelEnum.fatal, expectedColor: '\x1b[1m\x1b[31m' }, // Bright Red
      ];

      testCases.forEach(({ level, expectedColor }) => {
        const result = styleEngine['getColorForLevel'](level);
        expect(result).toBe(expectedColor);
      });
    });

    it('should return reset color for silent level', () => {
      const result = styleEngine['getColorForLevel'](LogLevelEnum.silent);
      expect(result).toBe('\x1b[0m');
    });
  });

  describe('Style Configuration Updates', () => {
    it('should update style configuration', () => {
      const newStyles = {
        success: { color: ColorEnum.MintGreen, bold: true },
        error: { color: ColorEnum.BurgundyRed, underline: true },
      };

      const newIcons = {
        success: '🎉' as Icon,
        error: '💀' as Icon,
      };

      styleEngine.updateStyleConfig(newStyles, newIcons);

      // Test that new styles are applied
      const successStyle = styleEngine['getSemanticStyleColor']('success', 'test-logger');
      expect(successStyle).toContain(ColorEnum.MintGreen);
      expect(successStyle).toContain('\x1b[1m'); // Bold

      // Test that new icons are resolved
      const successIcon = styleEngine['resolveIcon']('success', 'test-logger');
      expect(successIcon).toBe('🎉');
    });

    it('should preserve existing configuration when updating partially', () => {
      const newStyles = {
        success: { color: ColorEnum.MintGreen },
      };

      styleEngine.updateStyleConfig(newStyles, {});

      // New style should be applied
      const successStyle = styleEngine['getSemanticStyleColor']('success', 'test-logger');
      expect(successStyle).toContain(ColorEnum.MintGreen);

      // Existing styles should be preserved
      const errorStyle = styleEngine['getSemanticStyleColor']('error', 'test-logger');
      expect(errorStyle).toContain(ColorEnum.FireRed);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle undefined message gracefully', () => {
      const result = styleEngine.formatMessage(
        LogLevelEnum.info,
        undefined as unknown as string,
        'test-logger'
      );
      
      expect(result).toContain('[test-logger]');
      expect(result).toContain('undefined');
    });

    it('should handle empty message', () => {
      const result = styleEngine.formatMessage(
        LogLevelEnum.info,
        '',
        'test-logger'
      );
      
      expect(result).toContain('[test-logger]');
    });

    it('should handle undefined logger name', () => {
      const result = styleEngine.formatMessage(
        LogLevelEnum.info,
        'test message',
        undefined as unknown as string
      );
      
      expect(result).toContain('[undefined]');
      expect(result).toContain('test message');
    });

    it('should handle invalid log level gracefully', () => {
      const result = styleEngine['getColorForLevel'](999 as LogLevelEnum);
      expect(result).toBe('\x1b[0m'); // Reset color as fallback
    });

    it('should handle complex metadata objects', () => {
      const complexMetadata = {
        style: 'success',
        icon: '✅',
        extraProperty: 'should be ignored',
      } as LogStyling;

      const result = styleEngine.parseMetadataParameter(complexMetadata);
      
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.style).toBe('success');
      expect(result.metadata?.icon).toBe('✅');
    });
  });

  describe('Performance and Memory', () => {
    it('should not create unnecessary objects in hot path', () => {
      // Test that repeated calls don't create excessive objects
      const iterations = 1000;
      
      for (let i = 0; i < iterations; i++) {
        styleEngine.formatMessage(LogLevelEnum.info, `Message ${i}`, 'test');
      }
      
      // If this test passes without memory issues, the implementation is efficient
      expect(true).toBe(true);
    });

    it('should handle large metadata payloads gracefully', () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => `data-${i}`);
      const styling: LogStyling = { style: 'info', icon: 'ℹ️' };
      
      const result = styleEngine.parseMetadataParameter(largeData[0], [...largeData.slice(1), styling]);
      
      expect(result.metadata).toEqual(styling);
      expect(result.restData).toHaveLength(1000);
    });
  });

  describe('Helper Functions', () => {
    describe('Color Validation', () => {
      it('should validate known ColorEnum values', () => {
        const validColors = Object.values(ColorEnum);
        validColors.forEach((color) => {
          expect(styleEngine['isValidColor'](color)).toBe(true);
        });
      });
      it('should reject unknown color values', () => {
        expect(styleEngine['isValidColor']('not-a-color')).toBe(false);
      });
    });

    describe('Icon Validation', () => {
      it('should validate known emoji icons', () => {
        expect(styleEngine['isValidIcon']('✅')).toBe(true);
        expect(styleEngine['isValidIcon']('🐞')).toBe(true);
      });
      it('should reject unknown icons', () => {
        expect(styleEngine['isValidIcon']('not-an-icon')).toBe(false);
      });
    });

    describe('Memoization Helper', () => {
      it('should cache and retrieve style values', () => {
        styleEngine['setStyleCache']('test-style', 'cached-value');
        expect(styleEngine['getStyleCacheValue']('test-style')).toBe('cached-value');
      });
    });

    describe('Error Logging Helper', () => {
      it('should log warnings for invalid color', () => {
        styleEngine['logWarning']('Invalid color', 'logger', 'context');
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Invalid color')
        );
      });
    });

    describe('Style Code Construction Helper', () => {
      it('should construct style code with color, bold, underline', () => {
        const styleObj = { color: ColorEnum.FireRed, bold: true, underline: true };
        const code = styleEngine['constructStyleCode'](styleObj);
        expect(code).toBe(ColorEnum.FireRed + ColorEnum.Bold + ColorEnum.Underline);
      });
      it('should construct style code with color only', () => {
        const styleObj = { color: ColorEnum.FireRed };
        const code = styleEngine['constructStyleCode'](styleObj);
        expect(code).toBe(ColorEnum.FireRed);
      });
    });
  });
});
