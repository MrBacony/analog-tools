import { getRequestHeaders, createError, H3Event } from 'h3';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import { AuthRoute } from '../types/auth.types';
import { inject } from '@analog-tools/inject';
import { LoggerService } from '@analog-tools/logger';

const route: AuthRoute = {
  path: 'refresh-tokens',
  handler: async (event: H3Event) => {
    const logger = inject(LoggerService).forContext('TokenRefresh');

    // Verify authorization - this should be a secure API key for scheduled jobs
    const apiKey = process.env['TOKEN_REFRESH_API_KEY'];
    if (!apiKey) {
      logger.error('TOKEN_REFRESH_API_KEY not configured');
      throw createError({
        statusCode: 500,
        message: 'Server configuration error',
      });
    }

    const authHeader = getRequestHeaders(event).authorization;
    if (!authHeader || `Bearer ${apiKey}` !== authHeader) {
      logger.warn('Unauthorized token refresh attempt');
      throw createError({
        statusCode: 401,
        message: 'Unauthorized',
      });
    }

    try {
      const authService = inject(OAuthAuthenticationService);
      const result = await authService.refreshExpiringTokens();

      // Log the results
      logger.info(`Token refresh job completed`, {
        refreshed: result.refreshed,
        failed: result.failed,
        total: result.total,
      });

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      logger.error('Error in token refresh job', error);
      throw createError({
        statusCode: 500,
        message: 'Failed to refresh tokens',
      });
    }
  },
};

export default route;
