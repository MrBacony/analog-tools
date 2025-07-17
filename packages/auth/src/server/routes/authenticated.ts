import { H3Event } from 'h3';
import { inject } from '@analog-tools/inject';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import { AuthRoute } from '../types/auth.types';
import { LoggerService } from '@analog-tools/logger';

/**
 * Example of a route that checks if the user is authenticated
 * The authentication middleware will automatically handle token refresh if needed
 */
const route: AuthRoute = {
  path: 'authenticated',
  handler: async (event: H3Event) => {
    const authService = inject(OAuthAuthenticationService);

    const result = { authenticated: await authService.isAuthenticated(event) };

    inject(LoggerService)
      .forContext('AuthMiddleware')
      .info('User authentication status checked', result);

    return result;
  },
};

export default route;
