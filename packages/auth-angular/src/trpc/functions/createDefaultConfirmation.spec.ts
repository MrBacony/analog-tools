import { TRPCErrorData } from '../types/trpc';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock global window object before import
const windowConfirmMock = vi.fn();

// Mock global window object before import
vi.stubGlobal('confirm', windowConfirmMock);

// Now import after mocking
import { createDefaultConfirmation } from './createDefaultConfirmation';

describe('createDefaultConfirmation', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    windowConfirmMock.mockReturnValue(true);
  });

  it('should always return true', () => {
    // Act
    const result = createDefaultConfirmation(undefined);
    
    // Assert
    expect(result).toBe(true);
  });

  it('should call confirm with the expected message', () => {
    // Act
    createDefaultConfirmation(undefined);
    
    // Assert
    expect(windowConfirmMock).toHaveBeenCalledWith('Session expired. Do you want to refresh the page?');
  });

  it('should accept TRPCErrorData parameter and still work the same', () => {
    // Arrange
    const mockErrorData: TRPCErrorData = {
      code: 'UNAUTHORIZED',
      httpStatus: 401,
      path: '/api/protected',
      errorCode: 'SESSION_EXPIRED'
    };
    
    // Act
    const result = createDefaultConfirmation(mockErrorData);
    
    // Assert - function should ignore the error data
    expect(result).toBe(true);
    expect(windowConfirmMock).toHaveBeenCalledWith('Session expired. Do you want to refresh the page?');
  });
});
