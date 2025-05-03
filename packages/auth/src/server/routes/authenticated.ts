import { H3Event } from 'h3';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import { AuthRoute } from '../types/auth.types';

/**
 * Example of a route that checks if the user is authenticated
 * The authentication middleware will automatically handle token refresh if needed
 */
const route: AuthRoute = {
  path: 'authenticated',
    handler: async (event: H3Event) => {
        const authService = OAuthAuthenticationService.getInstance();
        return { authenticated: authService.isAuthenticated(event) };
    }
}

export default route;
