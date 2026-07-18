import { getQuery, H3Event, sendRedirect } from 'h3';
import { randomUUID } from 'uncrypto';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import { AuthSessionData } from '../types/auth-session.types';
import { AuthRoute } from '../types/auth.types';
import { inject } from '@analog-tools/inject';
import { updateSession } from '@analog-tools/session';
import { sanitizeRedirectUrl } from '../utils/sanitizeRedirectUrl';

const route: AuthRoute = {
  path: 'login',
  handler: async (event: H3Event) => {
    const authService = inject(OAuthAuthenticationService);

    // Initialize session
    await authService.initSession(event);

    // Generate state parameter for CSRF protection
    const state = randomUUID();

    // Store state in session using the new session API
    await updateSession<AuthSessionData>(event, (currentSession) => ({
      ...currentSession,
      state,
    }));

    // Get redirect URL from query parameters
    const query = getQuery(event);
    const redirectUri = query['redirect_uri'] as string;

    if (redirectUri) {
      const sanitizedTargetPath = sanitizeRedirectUrl(redirectUri);
      if (sanitizedTargetPath !== '/') {
        await updateSession<AuthSessionData>(event, (currentSession) => ({
          ...currentSession,
          redirectUrl: sanitizedTargetPath,
        }));
      }
    }

    // Get authorization URL
    const authUrl = await authService.getAuthorizationUrl(state);

    // Redirect to OAuth provider
    return sendRedirect(event, authUrl);
  },
};

export default route;
