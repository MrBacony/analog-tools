import { getHeader, getRequestURL, H3Event, sendRedirect, createError } from 'h3';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import { LoggerService } from '@analog-tools/logger';
import { inject } from '@analog-tools/inject';
import { checkAuthentication } from './checkAuthentication';

export async function useAnalogAuthMiddleware(event: H3Event) {
  const requestUrl = getRequestURL(event);
  const pathname = requestUrl.pathname;
  const authService = inject(OAuthAuthenticationService);
  const logger = inject(LoggerService).forContext('AuthMiddleware');

  logger.info('Processing authentication middleware', pathname);

  // All /api/auth/* routes are handled by handleAuthRoute.
  if (pathname.startsWith('/api/auth/')) {
    return;
  }

  // tRPC procedures enforce their own auth per-procedure, so the HTTP gate lets
  // the tRPC endpoint through. Match it on a path boundary — a bare `startsWith`
  // would also exempt unrelated routes like `/api/trpc-admin`.
  if (
    authService.isUnprotectedRoute(pathname) ||
    pathname === '/api/trpc' ||
    pathname.startsWith('/api/trpc/')
  ) {
    return;
  }

  await authService.initSession(event);
  if (await checkAuthentication(event)) {
    return;
  }

  // Not authenticated: API calls (fetch=true from the HTTP interceptor) receive
  // a 401 they can handle; browser navigations are sent to the login page.
  //
  // This must remain an h3 error. h3 derives the HTTP status only from its own
  // error class; any other error object reaches the default error handler as
  // unhandled and is answered with 500, so the client never sees the 401 its
  // interceptor redirects on.
  if (getHeader(event, 'fetch') === 'true') {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'User is not authenticated',
    });
  }

  logger.debug('Redirecting to login page', { path: pathname });
  // The login route sanitizes redirect_uri and stores it in the session.
  const target = encodeURIComponent(`${pathname}${requestUrl.search}`);
  await sendRedirect(event, `/api/auth/login?redirect_uri=${target}`);
}
