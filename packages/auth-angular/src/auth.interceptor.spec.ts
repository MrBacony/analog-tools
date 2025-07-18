import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpRequest, HttpEvent, HttpHandlerFn } from '@angular/common/http';
import { authInterceptor } from './auth.interceptor';
import { of, throwError } from 'rxjs';
import { expect, vi, describe, it, beforeEach } from 'vitest';

// Mock the router tokens module
vi.mock('@analogjs/router/tokens', () => ({
  injectRequest: vi.fn().mockReturnValue(undefined),
}));

// Mock the login function
vi.mock('./functions/login', () => ({
  login: vi.fn(),
}));

import { login } from './functions/login';

describe('AuthInterceptor', () => {
  let nextHandlerFn: HttpHandlerFn;
  let req: HttpRequest<unknown>;
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    // Set up the mock next handler function
    nextHandlerFn = vi.fn().mockReturnValue(of({ type: 4, body: { data: 'test' } } as HttpEvent<unknown>));
    req = new HttpRequest('GET', 'https://example.com/api/data');
  });
  
  it('should skip interception only for /api/auth/callback and /api/auth/login', () => {
    const callbackReq = new HttpRequest('GET', 'https://example.com/api/auth/callback');
    const loginReq = new HttpRequest('GET', 'https://example.com/api/auth/login');
    const userReq = new HttpRequest('GET', 'https://example.com/api/auth/user');

    // Should skip for /api/auth/callback
    TestBed.runInInjectionContext(() => {
      authInterceptor(callbackReq, nextHandlerFn);
    });
    expect(nextHandlerFn).toHaveBeenCalledWith(callbackReq);

    // Should skip for /api/auth/login
    TestBed.runInInjectionContext(() => {
      authInterceptor(loginReq, nextHandlerFn);
    });
    expect(nextHandlerFn).toHaveBeenCalledWith(loginReq);

    // Should NOT skip for /api/auth/user (should modify request)
    TestBed.runInInjectionContext(() => {
      authInterceptor(userReq, nextHandlerFn);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calledReq = ((nextHandlerFn as any).mock.calls.find(([req]: [HttpRequest<unknown>]) => req.url === userReq.url))[0];
    expect(calledReq).not.toBe(userReq);
    expect(calledReq.headers.has('fetch')).toBe(true);
    expect(calledReq.headers.get('fetch')).toBe('true');
    expect(calledReq.withCredentials).toBe(true);
  });
  
  it('should add fetch header to non-auth requests', () => {
    // Call the interceptor inside Angular injection context
    TestBed.runInInjectionContext(() => {
      authInterceptor(req, nextHandlerFn);
    });
    // Verify the request was modified with the fetch header
    expect(nextHandlerFn).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modifiedReq = (nextHandlerFn as any).mock.calls[0][0] as HttpRequest<unknown>;
    expect(modifiedReq.headers.has('fetch')).toBe(true);
    expect(modifiedReq.headers.get('fetch')).toBe('true');
  });
  
  it('should handle 401 unauthorized errors by redirecting', () => {
    // Set up next to return a 401 error
    nextHandlerFn = vi.fn().mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 401,
        statusText: 'Unauthorized'
      }))
    );
    // Call the interceptor inside Angular injection context
    const result = TestBed.runInInjectionContext(() => authInterceptor(req, nextHandlerFn));
    // Subscribe to the result to ensure the observable completes
    result.subscribe();
    // Verify login was called with the concatenated path and search from the mock window location
    expect(login).toHaveBeenCalled();
    // We can't test the exact path because we can't mock window.location,
    // but we can verify the login function was called
  });
  
  it('should propagate non-401 errors', () => {
    // Set up next to return a 500 error
    const testError = new HttpErrorResponse({
      status: 500,
      statusText: 'Server Error'
    });

    nextHandlerFn = vi.fn().mockReturnValue(throwError(() => testError));

    // Set up console.error spy to prevent error output in test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Do nothing with console errors during this test 
      return;
    });

    try {
      // Get the observable but don't subscribe to it
      const result = TestBed.runInInjectionContext(() => authInterceptor(req, nextHandlerFn));

      // To properly test that the error is propagated, we need to subscribe
      // but catch the error to prevent unhandled rejections
      result.subscribe({
        next: () => {
          // This should not be called
          throw new Error('Observable should not emit a next value');
        },
        error: (err) => {
          // We expect an error here, verify it's our test error
          expect(err).toBe(testError);
          // Explicitly having a statement here avoids the empty arrow function lint warning
          return;
        }
      });
    } finally {
      // Restore console.error
      consoleSpy.mockRestore();
    }

    // Verify login was not called for this non-401 error
    expect(login).not.toHaveBeenCalled();
  });
});
