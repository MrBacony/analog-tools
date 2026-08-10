import { getHeader, getRequestURL, H3Event, sendRedirect } from 'h3';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import { LoggerService } from '@analog-tools/logger';
import { inject } from '@analog-tools/inject';
import { TRPCError } from '@trpc/server';
import { checkAuthentication } from './checkAuthentication';
import { updateSession } from '@analog-tools/session';
import { sanitizeRedirectUrl } from '../utils/sanitizeRedirectUrl';

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

  if (
    authService.isUnprotectedRoute(pathname) ||
    pathname.startsWith('/api/trpc')
  ) {
    return;
  }

  await authService.initSession(event);
  if (await checkAuthentication(event)) {
    return;
  }

  // Not authenticated: API calls (fetch=true from the HTTP interceptor) receive
  // a 401 they can handle; browser navigations are sent to the login page.
  if (getHeader(event, 'fetch') === 'true') {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'User is not authenticated',
    });
  }

  logger.debug('Redirecting to login page', { path: pathname });
  await updateSession(event, (currentSession: Record<string, unknown>) => ({
    ...currentSession,
    redirectUrl: sanitizeRedirectUrl(`${requestUrl.pathname}${requestUrl.search}`),
  }));
  await sendRedirect(event, '/api/auth/login');
}
