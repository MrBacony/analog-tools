import {
  createError,
  getHeader,
  getRequestURL,
  H3Event,
  sendRedirect,
} from 'h3';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';

export async function useAnalogAuthMiddleware(event: H3Event) {
  // Skip authentication for public auth routes
  const pathname = getRequestURL(event).pathname;
  const authService = OAuthAuthenticationService.getInstance();

  // Public routes that should bypass authentication
  if (
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/api/auth/callback') ||
    pathname.startsWith('/api/auth/authenticated') ||
    authService.isUnprotectedRoute(pathname)
  ) {
    return;
  }

  // Initialize session
  await authService.initSession(event);

  // Check authentication with token refresh capability
  if (!(await authService.isAuthenticated(event))) {
    // Check if this is an API fetch request (from our HTTP interceptor)
    const fetchHeader = getHeader(event, 'fetch');
    if (fetchHeader === 'true') {
      // API request with fetch header - respond with 401 status
      throw createError({
        statusCode: 401,
        message: 'Authentication required',
      });
    } else {
      console.log('Redirecting to login page');
      // Browser request - redirect to login page
      await sendRedirect(event, '/api/auth/login');
    }
  }
}
