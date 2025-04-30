import { createError, getQuery, H3Event, sendRedirect } from 'h3';
import { AuthRoute } from '../types/auth.types';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import { AuthSessionData } from '../types/auth-session.types';

/**
 * Handles the OAuth callback from the authentication provider.
 * This route is responsible for processing the authorization code
 * and exchanging it for an access token.
 *
 * @param event - The H3 event object containing request and response data.
 * @returns A redirect to the application or an error if the state is invalid.
 */
const route: AuthRoute = {
    path: 'callback',
    handler: async (event: H3Event) => {
        console.log('Callback event:', event);
        const authService = OAuthAuthenticationService.getInstance();

        // Initialize session
        await authService.initSession(event);

        // Get code and state from query parameters
        const query = getQuery(event);
        const code = query['code'] as string;
        const state = query['state'] as string;

        // Verify state parameter with proper null checks and error handling
        const sessionState = event.context['sessionHandler']?.data?.state;

        if (!state || !sessionState || state !== sessionState) {
            throw createError({
                statusCode: 400,
                message: 'Invalid or missing state parameter. Authentication flow may have been tampered with.',
                statusMessage: 'Authorization Failed',
            });
        }

        // Clear state from session
        event.context['sessionHandler'].update((data: AuthSessionData) => {
            const updatedData = { ...data };
            delete updatedData.state;
            return updatedData;
        });

        // Handle callback
        await authService.handleCallback(event, code, state);

        // Get redirect URL from session or use default
        const redirectUrl = event.context['sessionHandler'].data.redirectUrl || '/';

        // Remove redirectUrl from session
        event.context['sessionHandler'].update((data: AuthSessionData) => {
            const updatedData = { ...data };
            delete updatedData.redirectUrl;
            return updatedData;
        });

        await event.context['sessionHandler'].save();

        // Redirect to application
        return sendRedirect(event, redirectUrl);
    },
};

export default route;
