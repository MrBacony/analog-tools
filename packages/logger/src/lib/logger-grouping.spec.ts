import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LoggerService } from './logger.service';

describe('LoggerService Grouping', () => {
  let logger: LoggerService;
  
  beforeEach(() => {
    // Create a new logger with debug level for tests
    logger = new LoggerService({ level: 'debug', name: 'test-logger', useColors: false });
    
    // Mock console methods
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    vi.spyOn(console, 'info').mockImplementation(() => {});
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    vi.spyOn(console, 'group').mockImplementation(() => {});
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  it('should create a group and output logs within it', () => {
    // Start a group
    logger.group('Test Group');
    
    // Log messages within the group
    logger.info('Info message in group');
    logger.debug('Debug message in group');
    
    // End the group
    logger.groupEnd('Test Group');
    
    // Verify that console.group was called
    expect(console.group).toHaveBeenCalledWith(expect.stringContaining('Group: Test Group'));
    
    // Verify that logs were output
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('Info message in group'));
    expect(console.debug).toHaveBeenCalledWith(expect.stringContaining('Debug message in group'));
    
    // Verify that console.groupEnd was called
    expect(console.groupEnd).toHaveBeenCalled();
  });
  
  it('should handle nested groups correctly', () => {
    // Start outer group
    logger.group('Outer Group');
    logger.info('Info in outer group');
    
    // Start inner group
    logger.group('Inner Group');
    logger.info('Info in inner group');
    
    // End inner group
    logger.groupEnd('Inner Group');
    
    // Log more in outer group
    logger.info('More info in outer group');
    
    // End outer group
    logger.groupEnd('Outer Group');
    
    // Verify groups were created and ended correctly
    expect(console.group).toHaveBeenCalledTimes(2);
    expect(console.groupEnd).toHaveBeenCalledTimes(2);
  });
  
  it('should end specific group and all nested groups when group name is provided', () => {
    // Create nested groups
    logger.group('Group 1');
    logger.group('Group 2');
    logger.group('Group 3');
    
    // End Group 1 (should also end Groups 2 and 3)
    logger.groupEnd('Group 1');
    
    // Verify all groups were ended
    expect(console.groupEnd).toHaveBeenCalledTimes(3);
  });
  
  it('should end most recent group when no group name is provided', () => {
    // Create nested groups
    logger.group('Group 1');
    logger.group('Group 2');
    
    // End most recent group (Group 2)
    logger.groupEnd();
    
    // Verify only one groupEnd was called
    expect(console.groupEnd).toHaveBeenCalledTimes(1);
  });

  it('should work with child loggers', () => {
    const childLogger = logger.forContext('child');
    
    childLogger.group('Child Group');
    childLogger.info('Info in child group');
    childLogger.groupEnd();
    
    expect(console.group).toHaveBeenCalledWith(expect.stringContaining('Child Group'));
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('Info in child group'));
    expect(console.groupEnd).toHaveBeenCalled();
  });
});
