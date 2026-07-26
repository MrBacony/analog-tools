import { createError, getQuery, H3Event, sendRedirect } from 'h3';
import { AuthRoute } from '../types/auth.types';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import { AuthSessionData } from '../types/auth-session.types';
import { inject } from '@analog-tools/inject';
import { getSession, updateSession } from '@analog-tools/session';
import { sanitizeRedirectUrl } from '../utils/sanitizeRedirectUrl';

/**
 * Handles the OAuth callback from the authentication provider.
 * This route is responsible for processing the authorization code
 * and exchanging it for an access token.
 *
 * @param event - The H3 event object containing request and response data.
 * @returns A redirect to the application or an error if the state is invalid.
 */
/**
 * Reads the sanitized redirectUrl from session and clears it, so a stale
 * value can't be reused by a later hit to this route.
 *
 * `updateSession` merges the updater's return value over the current
 * session data (`{ ...currentData, ...updates }`), so simply omitting the
 * key (e.g. via `delete`) does not clear it - the field must be explicitly
 * set to `undefined` to override the spread.
 */
async function resolveAndClearRedirect(event: H3Event): Promise<string> {
  const currentSessionData = getSession<AuthSessionData>(event);
  const redirectUrl = sanitizeRedirectUrl(currentSessionData?.redirectUrl);

  await updateSession<AuthSessionData>(event, (data) => ({
    ...data,
    redirectUrl: undefined,
  }));

  return redirectUrl;
}

const route: AuthRoute = {
  path: 'callback',
  handler: async (event: H3Event) => {
    const authService = inject(OAuthAuthenticationService);

    // Initialize session
    await authService.initSession(event);

    if (await authService.isAuthenticated(event)) {
      const redirectUrl = await resolveAndClearRedirect(event);
      return sendRedirect(event, redirectUrl);
    }

    // Get code and state from query parameters
    const query = getQuery(event);
    const code = query['code'] as string;
    const state = query['state'] as string;

    // Verify state parameter with proper null checks and error handling
    const sessionData = getSession<AuthSessionData>(event);
    const sessionState = sessionData?.state;

    if (!state || !sessionState || state !== sessionState) {
      throw createError({
        statusCode: 400,
        message:
          'Invalid or missing state parameter. Authentication flow may have been tampered with.',
        statusMessage: 'Authorization Failed',
      });
    }

    // Clear state from session
    await updateSession<AuthSessionData>(event, (data) => ({
      ...data,
      state: undefined,
    }));

    // Handle callback
    await authService.handleCallback(event, code, state);

    // Get redirect URL from session (or default) and clear it
    const redirectUrl = await resolveAndClearRedirect(event);

    // Redirect to application
    return sendRedirect(event, redirectUrl);
  },
};

export default route;
