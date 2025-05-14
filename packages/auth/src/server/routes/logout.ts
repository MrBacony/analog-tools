import { createError, H3Event, sendRedirect } from 'h3';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import { AuthRoute } from '../types/auth.types';
import { inject } from '@analog-tools/inject';

const route: AuthRoute = {
  path: 'logout',
  handler: async (event: H3Event) => {
    try {
      const authService = inject(OAuthAuthenticationService);

      // Initialize session
      await authService.initSession(event);

      // Get logout URL using updated auth service method (which now uses sessionHandler)
      const logoutUrl = await authService.logout(event);

      // The sessionHandler is already cleared in the logout method
      // No need to manually destroy it here

      return sendRedirect(event, logoutUrl);
    } catch (error) {
      console.error('Logout failed:', error);
      throw createError({
        statusCode: 500,
        message: 'Logout failed',
      });
    }
  },
}

export default route;
