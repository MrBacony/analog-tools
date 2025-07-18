import {
  HttpErrorResponse,
  HttpHeaders,
  HttpInterceptorFn,
} from '@angular/common/http';
import { catchError, EMPTY } from 'rxjs';
import { login } from './functions/login';
import { injectRequest } from '@analogjs/router/tokens';

/**
 * HTTP interceptor that:
 * 1. Adds a fetch=true header to indicate fresh data requests
 * 2. Redirects to login page when an API returns a 401 Unauthorized response
 *
 * This handles cases where a session has expired on the server-side.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Skip interception for auth endpoints to avoid circular issues
  if (req.url.includes('/api/auth/callback') || req.url.includes('/api/auth/login')) {
    return next(req);
  }

  // Clone the request and add the fetch=true header
  const request = injectRequest();

  let modifiedReq;

  if (request) {
    let headers = new HttpHeaders();
    Object.entries(request.headers).forEach(([key, value]) => {
      if (value !== null && value !== undefined && typeof value === 'string') {
        headers = headers.set(key, value);
      }
    });
    headers = headers.set('fetch', 'true');

    modifiedReq = req.clone({
      headers: headers,
      withCredentials: true,
    });
  } else {
    modifiedReq = req.clone({
      headers: req.headers.set('fetch', 'true'),
      withCredentials: true,
    });
  }

  // Use the modified request with the added header
  return next(modifiedReq).pipe(
    catchError((error: unknown) => {
      // Only handle HttpErrorResponse with 401 status
      if (error instanceof HttpErrorResponse && error.status === 401) {
        console.log('Session expired, redirecting to login');

        // Get current URL to redirect back after login
        const currentUrl = window.location.pathname + window.location.search;

        // Redirect to login page with the current URL as redirect target
        login(currentUrl);

        // Return empty observable to prevent the error from propagating
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
