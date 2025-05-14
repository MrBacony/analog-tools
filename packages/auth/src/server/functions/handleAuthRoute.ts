import { createError, H3Event } from 'h3';
import { registerRoutes } from './registerRoutes';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import { getLastPathSegment } from '../utils/getLastPathSegment';
import { inject } from '@analog-tools/inject';

export async function handleAuthRoute(event: H3Event) {
  if (event.path.includes('/api/auth/')) {
    const path = getLastPathSegment(event.path);

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
