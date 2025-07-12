import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoggerService } from './logger.service';
import { LoggerStyleEngine } from './logger-style-engine';
import { ColorEnum } from './logger.types';

describe('Logger Integration with StyleEngine', () => {
  let logger: LoggerService;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {
      // Silent during tests
    });
    
    logger = new LoggerService({
      name: 'integration-test',
      level: 'debug',
      useColors: true,
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should maintain backward compatibility for basic logging', () => {
    logger.info('Test message');
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[integration-test] Test message'),
      ...[]
    );
  });

  it('should maintain backward compatibility for styled logging', () => {
    logger.info('Success message', { style: 'success', icon: '✅' });
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('✅ Success message'),
      ...[]
    );
  });

  it('should maintain backward compatibility for child loggers', () => {
    const childLogger = logger.forContext('auth');
    childLogger.info('Authentication successful');
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[integration-test:auth] Authentication successful'),
      ...[]
    );
  });

  it('should maintain backward compatibility for color control', () => {
    expect(logger.getUseColors()).toBe(true);
    
    logger.setUseColors(false);
    expect(logger.getUseColors()).toBe(false);
    
    logger.setUseColors(true);
    expect(logger.getUseColors()).toBe(true);
  });

  it('should inject custom style engine correctly', () => {
    const customStyleEngine = new LoggerStyleEngine({
      useColors: false,
      styles: {
        success: { color: ColorEnum.MintGreen, bold: true },
      },
      icons: {
        success: '🎉',
      },
    });

    const loggerWithCustomEngine = new LoggerService(
      { name: 'custom-test' },
      customStyleEngine
    );

    loggerWithCustomEngine.info('Custom test', { style: 'success', icon: 'success' });
    
    expect(consoleSpy).toHaveBeenCalledWith(
      '[custom-test] 🎉 Custom test',
      ...[]
    );
  });

  it('should share style engine between parent and child loggers', () => {
    const parentLogger = new LoggerService({ name: 'parent', useColors: true });
    const childLogger = parentLogger.forContext('child');
    
    // Verify both loggers share the same style engine
    expect(parentLogger.getUseColors()).toBe(true);
    expect(childLogger.getUseColors()).toBe(true);
    
    // Change color setting on parent
    parentLogger.setUseColors(false);
    
    // Child should reflect the change
    expect(parentLogger.getUseColors()).toBe(false);
    expect(childLogger.getUseColors()).toBe(false);
  });

  it('should maintain proper separation of concerns', () => {
    // LoggerService should focus on logging logic
    expect(logger).toHaveProperty('trace');
    expect(logger).toHaveProperty('debug');
    expect(logger).toHaveProperty('info');
    expect(logger).toHaveProperty('warn');
    expect(logger).toHaveProperty('error');
    expect(logger).toHaveProperty('fatal');
    expect(logger).toHaveProperty('forContext');
    expect(logger).toHaveProperty('group');
    expect(logger).toHaveProperty('groupEnd');
    
    // StyleEngine should handle formatting
    const styleEngine = new LoggerStyleEngine();
    expect(styleEngine).toHaveProperty('formatMessage');
    expect(styleEngine).toHaveProperty('formatMessageWithMetadata');
    expect(styleEngine).toHaveProperty('parseMetadataParameter');
    expect(styleEngine).toHaveProperty('setUseColors');
    expect(styleEngine).toHaveProperty('updateStyleConfig');
  });
});
