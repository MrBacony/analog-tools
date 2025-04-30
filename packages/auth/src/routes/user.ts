import { createError, H3Event } from 'h3';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import { AuthRoute } from '../types/auth.types';

const route: AuthRoute = {
    path: 'user',
    handler: async (event: H3Event) => {
        const authService = OAuthAuthenticationService.getInstance();

        // Initialize session
        await authService.initSession(event);

        // Check if user is authenticated
        if (!(await authService.isAuthenticated(event))) {
            throw createError({
                statusCode: 401,
                message: 'Unauthorized',
            });
        }

        // Get authenticated user
        return authService.getAuthenticatedUser(event);
    },
};

export default route;
