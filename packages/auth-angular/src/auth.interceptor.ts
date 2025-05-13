import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { EMPTY, catchError } from 'rxjs';
import { login } from './functions/login';

/**
 * HTTP interceptor that:
 * 1. Adds a fetch=true header to indicate fresh data requests
 * 2. Redirects to login page when an API returns a 401 Unauthorized response
 *
 * This handles cases where a session has expired on the server-side.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Skip interceptor for auth-related endpoints to prevent redirect loops
  if (req.url.includes('/api/auth/')) {
    return next(req);
  }

  // Clone the request and add the fetch=true header
  const modifiedReq = req.clone({
    setHeaders: {
      fetch: 'true',
    },
  });

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
