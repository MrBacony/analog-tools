import { wrapTrpcClientWithErrorHandling } from './wrapTrpcClientWithErrorHandling';
import { proxyClient } from './createProxy';
import { createDefaultConfirmation } from './createDefaultConfirmation';
import { TRPCErrorData } from '../types/trpc';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Explicitly export to ensure Vitest can find the test suite

// Mock dependencies
vi.mock('./createProxy', () => ({
  proxyClient: vi.fn((client, handler) => ({ client, handler }))
}));

vi.mock('./createDefaultConfirmation', () => ({
  createDefaultConfirmation: vi.fn()
}));

describe('wrapTrpcClientWithErrorHandling', () => {
  let mockClient: Record<string, unknown>;
  let mockErrorHandler: (errorData: TRPCErrorData | undefined) => boolean;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup test data
    mockClient = { router: { query: vi.fn() } };
    // Initialize but not used directly - it's just for type definition
    mockErrorHandler = vi.fn();
  });

  it('should call proxyClient with the client and custom error handler when provided', () => {
    // Arrange
    const mockErrorHandler = vi.fn();

    // Act
    const result = wrapTrpcClientWithErrorHandling(mockClient, mockErrorHandler);

    // Assert
    expect(proxyClient).toHaveBeenCalledWith(mockClient, mockErrorHandler);
    expect(result).toEqual({ client: mockClient, handler: mockErrorHandler });
  });

  it('should call proxyClient with the client and default error handler when no handler provided', () => {
    // Act
    const result = wrapTrpcClientWithErrorHandling(mockClient);

    // Assert
    expect(proxyClient).toHaveBeenCalledWith(mockClient, createDefaultConfirmation);
    expect(result).toEqual({ client: mockClient, handler: createDefaultConfirmation });
  });
});
