import { getRequestHeaders, createError, H3Event } from 'h3';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import { AuthRoute } from '../types/auth.types';

const route: AuthRoute = {
  path: 'refresh-tokens',
  handler: async (event: H3Event) => {
    // Verify authorization - this should be a secure API key for scheduled jobs
    const apiKey = process.env['TOKEN_REFRESH_API_KEY'];
    if (!apiKey) {
        console.error('TOKEN_REFRESH_API_KEY not configured');
        throw createError({
            statusCode: 500,
            message: 'Server configuration error',
        });
    }

    const authHeader = getRequestHeaders(event).authorization;
    if (!authHeader || `Bearer ${apiKey}` !== authHeader) {
        console.warn('Unauthorized token refresh attempt');
        throw createError({
            statusCode: 401,
            message: 'Unauthorized',
        });
    }

    try {
        const authService = OAuthAuthenticationService.getInstance();
        const result = await authService.refreshExpiringTokens();

        // Log the results
        console.log(
            `Token refresh job completed: ${result.refreshed} refreshed, ${result.failed} failed, ${result.total} total sessions`,
        );

        return {
            success: true,
            ...result,
        };
    } catch (error) {
        console.error('Error in token refresh job:', error);
        throw createError({
            statusCode: 500,
            message: 'Failed to refresh tokens',
        });
    }
},
}

export default route;
