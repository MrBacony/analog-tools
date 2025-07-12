import { describe, it, expect, beforeEach } from 'vitest';
import { LoggerStyleEngine } from './logger-style-engine';
import { ColorEnum, LogStyling } from './logger.types';

// Helper to simulate heavy style resolution
function createHeavyStyle(style: string) {
  return {
    style,
    color: ColorEnum.RoyalPurple,
    bold: true,
    underline: true,
  };
}

describe('LoggerStyleEngine Style Resolution Caching', () => {
  let styleEngine: LoggerStyleEngine;

  beforeEach(() => {
    styleEngine = new LoggerStyleEngine({ useColors: true });
  });

  it('should cache resolved styles for string style definitions', () => {
    const styleDef = 'success';
    const first = styleEngine.resolveStyle(styleDef);
    const second = styleEngine.resolveStyle(styleDef);
    expect(second).toBe(first); // Should be same reference
  });

  it('should cache resolved styles for object style definitions by reference', () => {
    const styleObj = createHeavyStyle('custom');
    const first = styleEngine.resolveStyle(styleObj);
    const second = styleEngine.resolveStyle(styleObj);
    expect(second).toBe(first); // Should be same reference
  });

  it('should resolve different styles independently', () => {
    const styleA = styleEngine.resolveStyle('success');
    const styleB = styleEngine.resolveStyle('error');
    expect(styleA).not.toBe(styleB);
  });

  it('should improve performance for repeated style lookups', () => {
    const styleDef = 'success';
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      styleEngine.resolveStyle(styleDef);
    }
    const duration = performance.now() - start;
    // Arbitrary threshold: should be fast
    expect(duration).toBeLessThan(50);
  });
});
