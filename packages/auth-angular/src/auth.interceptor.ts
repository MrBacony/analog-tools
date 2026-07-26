import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { catchError, EMPTY } from 'rxjs';
import { login } from './functions/login';
import { injectRequest } from '@analogjs/router/tokens';
import { mergeRequest } from './functions/utils/merge-request';

/**
 * HTTP interceptor that:
 * 1. Adds a fetch=true header to indicate fresh data requests
 * 2. Redirects to login page when an API returns a 401 Unauthorized response
 *
 * This handles cases where a session has expired on the server-side.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isAuthEndpoint = req.url.includes('/api/auth/');

  const platformId = inject(PLATFORM_ID);

  // Clone the request and add the fetch=true header
  const request = injectRequest();

  const modifiedReq = mergeRequest(req, request);

  // Auth endpoints still need the current SSR request context (cookies/headers),
  // but should not trigger the interceptor's 401 redirect handling.
  if (isAuthEndpoint) {
    return next(modifiedReq);
  }

  // Use the modified request with the added header
  return next(modifiedReq).pipe(
    catchError((error: unknown) => {
      // Only handle HttpErrorResponse with 401 status
      if (error instanceof HttpErrorResponse && error.status === 401) {
        if (isPlatformBrowser(platformId)) {
          const currentUrl = window.location.pathname + window.location.search;
          login(currentUrl);
        }
        // Return EMPTY to suppress the error — httpResource will use defaultValue
        return EMPTY;
      }

      // For other errors, rethrow
      throw error;
    })
  );
};

/**
 * Provider for the auth interceptor
 */
export const provideAuthInterceptor = () => ({
  provide: 'HTTP_INTERCEPTORS',
  useValue: authInterceptor,
  multi: true,
});
