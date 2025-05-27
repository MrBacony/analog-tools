import { proxyClient } from './createProxy';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { TRPCClientError } from '@trpc/client';

describe('proxyClient', () => {
  let mockClient: Record<string, unknown>;
  let mockErrorHandler: (errorData: any) => boolean;
  let proxiedClient: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create a mock TRPC client structure
    mockClient = {
      users: {
        getUser: {
          query: vi.fn(),
        },
        createUser: {
          mutate: vi.fn(),
        },
      },
    };

    // Create a mock error handler
    mockErrorHandler = vi.fn().mockReturnValue(false);

    // Create the proxied client
    proxiedClient = proxyClient(mockClient, mockErrorHandler);
  });

  it('should create a proxy object with same structure as original client', () => {
    // Assert
    expect(proxiedClient).toHaveProperty('users');
    expect(proxiedClient.users).toHaveProperty('getUser');
    expect(proxiedClient.users).toHaveProperty('createUser');
    expect(proxiedClient.users.getUser).toHaveProperty('query');
    expect(proxiedClient.users.createUser).toHaveProperty('mutate');
  });

  it('should proxy query calls and pass through successful responses', () => {
    // Arrange
    const mockResponse = { id: 1, name: 'Test User' };
    // @ts-expect-error mocking router
    mockClient.users.getUser.query = vi.fn().mockReturnValue(of(mockResponse));

    // Act
    let result: any;
    proxiedClient.users.getUser.query().subscribe((data: any) => {
      result = data;
    });

    // Assert
    // @ts-expect-error mocking router
    expect(mockClient.users.getUser.query).toHaveBeenCalled();
    expect(result).toEqual(mockResponse);
  });

  it('should proxy mutate calls and pass through successful responses', () => {
    // Arrange
    const mockResponse = { id: 1, success: true };
    // @ts-expect-error mocking router
    mockClient.users.createUser.mutate = vi
      .fn()
      .mockReturnValue(of(mockResponse));

    // Act
    let result: any;
    proxiedClient.users.createUser
      .mutate({ name: 'New User' })
      .subscribe((data: any) => {
        result = data;
      });

    // Assert
    // @ts-expect-error mocking router
    expect(mockClient.users.createUser.mutate).toHaveBeenCalledWith({
      name: 'New User',
    });
    expect(result).toEqual(mockResponse);
  });

  it('should call error handler when TRPC error occurs', () => {
    // Arrange
    const errorData = {
      code: 'UNAUTHORIZED',
      httpStatus: 401,
      path: '/api/users',
      errorCode: 'SESSION_EXPIRED',
    };

    const trpcError = new TRPCClientError('Unauthorized');
    Object.defineProperty(trpcError, 'data', { value: errorData });
    // @ts-expect-error mocking router
    mockClient.users.getUser.query = vi
      .fn()
      .mockReturnValue(throwError(() => trpcError));

    // Act
    proxiedClient.users.getUser.query().subscribe({
      // @ts-expect-error it should fail as expected
      next: () => fail('Should not succeed'),
      error: () => {
        /* Expected error */
      },
    });

    // Assert
    expect(mockErrorHandler).toHaveBeenCalledWith(errorData);
  });

  it('should complete the observable without error when handler returns true', () => {
    // Arrange
    // @ts-expect-error correctly mocking handler
    mockErrorHandler.mockReturnValue(true);

    const errorData = {
      code: 'UNAUTHORIZED',
      httpStatus: 401,
    };

    const trpcError = new TRPCClientError('Unauthorized');
    Object.defineProperty(trpcError, 'data', { value: errorData });
    // @ts-expect-error mocking router
    mockClient.users.getUser.query = vi
      .fn()
      .mockReturnValue(throwError(() => trpcError));

    // Act
    let completed = false;
    proxiedClient.users.getUser.query().subscribe({
      // @ts-expect-error it should fail as expected
      next: () => fail('Should not emit any values'),
      // @ts-expect-error it should fail as expected
      error: () => fail('Should not propagate error when handler returns true'),
      complete: () => {
        completed = true;
      },
    });

    // Assert
    expect(mockErrorHandler).toHaveBeenCalledWith(errorData);
    expect(completed).toBe(true);
  });

  it('should propagate error when handler returns false', () => {
    // Arrange
    // @ts-expect-error correctly mocking handler
    mockErrorHandler.mockReturnValue(false);

    const errorData = {
      code: 'UNAUTHORIZED',
      httpStatus: 401,
    };

    const trpcError = new TRPCClientError('Unauthorized');
    Object.defineProperty(trpcError, 'data', { value: errorData });
    // @ts-expect-error mocking router
    mockClient.users.getUser.query = vi
      .fn()
      .mockReturnValue(throwError(() => trpcError));

    // Act
    let errorReceived = false;
    proxiedClient.users.getUser.query().subscribe({
      // @ts-expect-error it should fail as expected
      next: () => fail('Should not emit any values'),
      error: () => {
        errorReceived = true;
      },
      // @ts-expect-error it should fail as expected
      complete: () => fail('Should not complete when handler returns false'),
    });

    // Assert
    expect(mockErrorHandler).toHaveBeenCalledWith(errorData);
    expect(errorReceived).toBe(true);
  });

  it('should not intercept non-query/mutate methods', () => {
    // Arrange
    // @ts-expect-error mocking router
    mockClient.users.getUser.someOtherMethod = vi
      .fn()
      .mockReturnValue('original');

    // Act
    const result = proxiedClient.users.getUser.someOtherMethod();

    // Assert
    expect(result).toBe('original');
    // @ts-expect-error mocking router
    expect(mockClient.users.getUser.someOtherMethod).toHaveBeenCalled();
  });
});
