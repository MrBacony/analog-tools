import { getHeader, getRequestURL, H3Event, sendRedirect } from 'h3';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import { LoggerService } from '@analog-tools/logger';
import { inject } from '@analog-tools/inject';
import { TRPCError } from '@trpc/server';
import { checkAuthentication } from './checkAuthentication';
import { updateSession } from '@analog-tools/session';
import { sanitizeRedirectUrl } from '../utils/sanitizeRedirectUrl';

export async function useAnalogAuthMiddleware(event: H3Event) {
  // Skip authentication for public auth routes
  const requestUrl = getRequestURL(event);
  const pathname = requestUrl.pathname;
  const authService = inject(OAuthAuthenticationService);
  const logger = inject(LoggerService).forContext('AuthMiddleware');

  logger.info('Processing authentication middleware', pathname);

  // Public routes that should bypass authentication
  // All /api/auth/* routes are handled by handleAuthRoute
  if (pathname.startsWith('/api/auth/')) {
    return;
  }

  if (
    authService.isUnprotectedRoute(pathname) ||
    pathname.startsWith('/api/trpc')
  ) {
    return;
  }

  const fetchHeader = getHeader(event, 'fetch');
  if (getHeader(event, 'ssr') !== 'true') {
    // Initialize session
    await authService.initSession(event);
    // Check authentication with token refresh capability
    if (!(await checkAuthentication(event))) {
      // Check if this is an API fetch request (from our HTTP interceptor)
      if (fetchHeader === 'true') {
        // API request with fetch header - respond with 401 status
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User is not authenticated',
        });
      } else {
        logger.debug('Redirecting to login page', { path: pathname });
        // Browser request - store the original URL and redirect to login page
        await updateSession(event, (currentSession: Record<string, unknown>) => ({
          ...currentSession,
          redirectUrl: sanitizeRedirectUrl(
            `${requestUrl.pathname}${requestUrl.search}`
          ),
        }));
        await sendRedirect(event, '/api/auth/login');
      }
    }
  }

  if (fetchHeader === 'true') {
    return {
      name: 'TrpcError',
      code: 'NOT_IMPLEMENTED',
      message: 'SSR is not supported for this route',
    };
  }
  return;
}
