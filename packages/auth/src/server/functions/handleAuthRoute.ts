import { createError, H3Event } from 'h3';
import { registerRoutes } from './registerRoutes';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import { getLastPathSegment } from '../utils/getLastPathSegment';
import { inject } from '@analog-tools/inject';
import { isAuthRoutePath, normalizeAuthPath } from '../utils/auth-route-path';

export async function handleAuthRoute(event: H3Event) {
  const normalizedPath = normalizeAuthPath(event.path);

  if (isAuthRoutePath(normalizedPath)) {
    const path = getLastPathSegment(normalizedPath);

    if (!path) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing path parameter',
      });
    }

    const authService = inject(OAuthAuthenticationService);
    await authService.initSession(event);

    // Check if the requested path exists in our routes
    const routes = registerRoutes();

    if (routes[path]) {
      return routes[path](event);
    }

    // If route doesn't exist, return a 404 error handler

    throw createError({
      statusCode: 404,
      statusMessage: `Authentication route '${path}' not found`,
    });
  }
}
