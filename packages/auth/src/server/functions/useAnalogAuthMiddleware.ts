import { getRequestURL, H3Event, sendRedirect } from 'h3';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';

export async function useAnalogAuthMiddleware(event: H3Event) {
    // Skip authentication for public auth routes
    const pathname = getRequestURL(event).pathname;
    const authService = OAuthAuthenticationService.getInstance();

    // Public routes that should bypass authentication
    if (
        pathname.startsWith('/api/auth/login') ||
        pathname.startsWith('/api/auth/callback') ||
        pathname.startsWith('/api/auth/authenticated') ||
        authService.isUnprotectedRoute(pathname)
    ) {
        return;
    }

    // Initialize session
    await authService.initSession(event);

    // Check authentication with token refresh capability
    if (!(await authService.isAuthenticated(event))) {
        sendRedirect(event, '/api/auth/login');
        /*throw createError({
            status: 401,
            message: 'Authentication required',
        });*/
    }
}
