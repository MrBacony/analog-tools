import { H3Event } from 'h3';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import { AuthRoute } from '../types/auth.types';


const route: AuthRoute = {
  path: 'protected-data',
  handler: async (event: H3Event) => {
    const authService = OAuthAuthenticationService.getInstance();

    // The middleware has already verified authentication and refreshed tokens if needed
    // Now we can get the authenticated user
    const user = await authService.getAuthenticatedUser(event);

    return {
        message: 'This is protected data that requires authentication',
        user,
    };
},
}

export default route;
