import { ServerRequest } from '@analogjs/router/tokens';
import { HTTPHeaders } from '@trpc/client';
import { WritableSignal, signal } from '@angular/core';
import { createTrpcClientWithAuth } from './trpc.injector';
import * as wrappingModule from './functions/wrapTrpcClientWithErrorHandling';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the wrapTrpcClientWithErrorHandling function
vi.mock('./functions/wrapTrpcClientWithErrorHandling', () => ({
  wrapTrpcClientWithErrorHandling: vi.fn((client) => `wrapped_${client}`),
}));

describe('createTrpcClientWithAuth', () => {
  let mockTrpcClient: any;
  let mockRequest: ServerRequest | null;
  let mockTrpcHeaders: WritableSignal<HTTPHeaders>;
  let spyWrapTrpcClientWithErrorHandling: any;

  beforeEach(() => {
    // Setup test data
    mockTrpcClient = { client: 'test' };
    mockTrpcHeaders = signal<HTTPHeaders>({});
    spyWrapTrpcClientWithErrorHandling = vi.spyOn(wrappingModule, 'wrapTrpcClientWithErrorHandling');

    // Reset the mock before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should update headers with fetch flag and no cookie when request is null', () => {
    // Arrange
    mockRequest = null;
    
    // Act
    createTrpcClientWithAuth(mockTrpcClient, mockRequest, mockTrpcHeaders);
    
    // Assert
    expect(mockTrpcHeaders()).toEqual({
      fetch: 'true',
      cookie: undefined
    });
  });

  it('should update headers with fetch flag and cookie when request is provided', () => {
    // Arrange
    mockRequest = {
      headers: {
        cookie: 'test-cookie=value'
      }
    } as ServerRequest;
    
    // Act
    createTrpcClientWithAuth(mockTrpcClient, mockRequest, mockTrpcHeaders);
    
    // Assert
    expect(mockTrpcHeaders()).toEqual({
      fetch: 'true',
      cookie: 'test-cookie=value'
    });
  });

  it('should preserve existing headers when updating', () => {
    // Arrange
    mockRequest = {
      headers: {
        cookie: 'test-cookie=value'
      }
    } as ServerRequest;
    mockTrpcHeaders.set({ 
      'existing-header': 'existing-value' 
    });
    
    // Act
    createTrpcClientWithAuth(mockTrpcClient, mockRequest, mockTrpcHeaders);
    
    // Assert
    expect(mockTrpcHeaders()).toEqual({
      'existing-header': 'existing-value',
      fetch: 'true',
      cookie: 'test-cookie=value'
    });
  });

  it('should call wrapTrpcClientWithErrorHandling with the client', () => {
    // Arrange
    mockRequest = null;
    
    // Act
    const result = createTrpcClientWithAuth(mockTrpcClient, mockRequest, mockTrpcHeaders);
    
    // Assert
    expect(spyWrapTrpcClientWithErrorHandling).toHaveBeenCalledWith(mockTrpcClient);
    // The mock returns "wrapped_" + client, so check that
    expect(result).toBe(`wrapped_${mockTrpcClient}`);
  });
});
