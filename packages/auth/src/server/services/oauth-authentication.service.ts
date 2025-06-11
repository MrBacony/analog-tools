import { createError, H3Event } from 'h3';
import { SessionService } from './session.service';
import {
  AuthSessionData,
  SessionWithHandler,
  SessionWithSave,
} from '../types/auth-session.types';
import { AnalogAuthConfig } from '../types/auth.types';
import { inject, registerService } from '@analog-tools/inject';
import { LoggerService } from '@analog-tools/logger';

/**
 * Service for handling OAuth authentication in a Backend-for-Frontend pattern
 */
export class OAuthAuthenticationService {
  static readonly INJECTABLE = true;

  private logger: LoggerService;

  constructor(config: AnalogAuthConfig) {
    this.logger = inject(LoggerService).forContext(
      'OAuthAuthenticationService'
    );
    registerService(SessionService, config.sessionStorage);
    this.config = config;
  }

  // Config object with default values
  private readonly config!: AnalogAuthConfig;

  // OpenID Configuration cache
  private openIDConfigCache: OpenIDConfiguration | null = null;
  private configLastFetched: number | null = null;
  private readonly CONFIG_CACHE_TTL = 3600000; // 1 hour in milliseconds

  // Add these properties for token refresh configuration
  private TOKEN_REFRESH_SAFETY_MARGIN = 60 * 5; // 5 minutes in seconds

  /**
   * Validate that the service has been properly initialized
   * @throws Error if mandatory configuration is missing
   */
  private validateConfiguration(): void {
    if (
      !this.config.issuer ||
      !this.config.clientId ||
      !this.config.clientSecret ||
      !this.config.callbackUri
    ) {
      throw new Error(
        'OAuth Authentication Service not properly initialized. ' +
          'Make sure to call AnalogAuth() with valid configuration before using authentication features.'
      );
    }
  }

  // Rest of the code converted to class methods...

  /**
   * Initialize session for the request
   */
  async initSession(event: H3Event): Promise<void> {
    return await inject(SessionService).initSession(event);
  }

  getConfig(): AnalogAuthConfig {
    this.validateConfiguration();
    return this.config;
  }

  /**
   * Safely access a configuration value
   * @param key The configuration key to retrieve
   * @param fallbackValue Optional fallback value if the config value doesn't exist
   * @returns The configuration value or fallback value
   * @throws Error if the configuration value doesn't exist and no fallback is provided
   */
  getConfigValue<K extends keyof AnalogAuthConfig>(
    key: K,
    fallbackValue?: AnalogAuthConfig[K]
  ): AnalogAuthConfig[K] {
    const value = this.config[key];
    // Check if value is undefined or empty string
    if (value === undefined || (typeof value === 'string' && value === '')) {
      if (fallbackValue !== undefined) {
        return fallbackValue;
      }

      // These config values are optional and should return a safe default if missing
      if (key === 'userHandler' || key === 'logoutUrl') {
        return undefined as AnalogAuthConfig[K];
      }
      if (key === 'unprotectedRoutes') {
        return [] as string[] as AnalogAuthConfig[K];
      }

      throw new Error(`Configuration value for '${key}' doesn't exist`);
    }
    return value;
  }

  /**
   * Check if the route is unprotected
   * @param path The request path
   * @returns True if the route is unprotected, false otherwise
   */
  isUnprotectedRoute(path: string): boolean {
    const unprotectedRoutes = this.getConfigValue(
      'unprotectedRoutes',
      [] as string[]
    );
    return (
      Array.isArray(unprotectedRoutes) &&
      unprotectedRoutes.some((route) => path.startsWith(route))
    );
  }

  /**
   * Get OAuth authorization URL for login
   */
  async getAuthorizationUrl(
    state: string,
    redirectUri?: string
  ): Promise<string> {
    this.validateConfiguration();

    const config = await this.getOpenIDConfiguration();

    const audience = this.getConfigValue('audience');

    const searchparams = {
      response_type: 'code',
      client_id: this.getConfigValue('clientId'),
      redirect_uri: redirectUri || this.getConfigValue('callbackUri'),
      scope: this.getConfigValue('scope'),
      state,
      ...(audience ? { audience } : {}),
    };

    const params = new URLSearchParams(searchparams);

    return `${config.authorization_endpoint}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForTokens(code: string, redirectUri?: string) {
    const config = await this.getOpenIDConfiguration();

    const response = await fetch(config.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.getConfigValue('clientId'),
        client_secret: this.getConfigValue('clientSecret'),
        code,
        redirect_uri: redirectUri || this.getConfigValue('callbackUri'),
      }).toString(),
    });
    if (!response.ok) {
      const error = await response.json();
      this.logger.error('Error exchanging code for tokens', error);
      throw createError({
        statusCode: 401,
        message: 'Failed to exchange authorization code',
      });
    }

    return await response.json();
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshTokens(refreshToken: string): Promise<{
    access_token: string;
    id_token?: string;
    refresh_token?: string;
    expires_in: number;
  }> {
    const config = await this.getOpenIDConfiguration();

    try {
      const response = await fetch(config.token_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.getConfigValue('clientId'),
          client_secret: this.getConfigValue('clientSecret'),
          refresh_token: refreshToken,
        }).toString(),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: 'Unknown error' }));
        this.logger.error('Error refreshing token', error);
        throw createError({
          statusCode: 401,
          message: 'Failed to refresh token',
        });
      }

      return await response.json();
    } catch (error) {
      this.logger.error('Error during token refresh', error);
      throw createError({
        statusCode: 401,
        message: 'Failed to refresh authentication token',
      });
    }
  }

  /**
   * Get user info from OAuth provider with improved error handling and retry logic
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getUserInfo(accessToken: string, maxRetries = 3): Promise<any> {
    const config = await this.getOpenIDConfiguration();
    let lastError: Error | null = null;

    // Retry logic for network issues
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(config.userinfo_endpoint, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          // Add timeout to prevent hanging requests
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: 'Unknown error' }));
          this.logger.error(`Error getting user info`, errorData, {
            attempt,
            maxRetries,
          });

          // Handle different error scenarios
          if (response.status === 401) {
            throw createError({
              statusCode: 401,
              message: 'Authentication token is invalid or expired',
            });
          } else if (response.status === 429) {
            // Rate limiting - wait longer before retry
            const retryAfter = parseInt(
              response.headers.get('Retry-After') || '5',
              10
            );
            await new Promise((resolve) =>
              setTimeout(resolve, retryAfter * 1000)
            );
            continue;
          } else if (response.status >= 500) {
            // Server error - retry after delay
            await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
            continue;
          } else {
            throw createError({
              statusCode: response.status,
              message: `Failed to get user info: ${
                errorData.error || 'Unknown error'
              }`,
            });
          }
        }

        const userData = await response.json();

        // Basic validation of user data
        if (!userData || (!userData.sub && !userData.id)) {
          throw createError({
            statusCode: 500,
            message: 'Invalid user data received from provider',
          });
        }

        return userData;
      } catch (error: unknown) {
        lastError = error as Error;

        // Don't retry certain errors like invalid token
        if (
          error instanceof Error &&
          'statusCode' in error &&
          (error as { statusCode: number }).statusCode === 401
        ) {
          throw error;
        }

        // Network errors are retryable
        if (
          error instanceof TypeError ||
          (error instanceof Error && error.name === 'AbortError')
        ) {
          this.logger.error(`Network error fetching user info`, error, {
            attempt,
            maxRetries,
          });
          if (attempt < maxRetries) {
            // Exponential backoff
            await new Promise((resolve) =>
              setTimeout(resolve, Math.pow(2, attempt) * 500)
            );
            continue;
          }
        }

        // If we're out of retries, rethrow the last error
        if (attempt === maxRetries) {
          this.logger.error(`Failed to get user info after multiple attempts`, {
            maxRetries,
          });
          throw createError({
            statusCode: 500,
            message: 'Failed to get user info after multiple attempts',
            cause: lastError,
          });
        }
      }
    }

    // This should never be reached due to the throw in the last attempt
    throw createError({
      statusCode: 500,
      message: 'Unexpected error getting user info',
    });
  }

  /**
   * Handle OAuth callback
   */
  async handleCallback(event: H3Event, code: string, state: string) {
    // Verify state parameter (should be implemented with CSRF protection)
    if (!state) {
      throw createError({
        statusCode: 400,
        message: 'Invalid state parameter',
      });
    }

    // Exchange code for tokens
    const tokens = await this.exchangeCodeForTokens(code);
    const { access_token, id_token, refresh_token, expires_in } = tokens;

    // Get user info from OAuth provider
    const userData = await this.getUserInfo(access_token);

    // Store user in database
    const userHandler = this.getConfigValue('userHandler', undefined);

    let user = userData;
    if (userHandler && 'createOrUpdateUser' in userHandler) {
      user = await userHandler.createOrUpdateUser?.(userData);
    }

    // Store auth data in session using sessionHandler
    const sessionHandler = event.context['sessionHandler'];
    const auth = {
      isAuthenticated: true,
      accessToken: access_token,
      idToken: id_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + expires_in * 1000,
      userInfo: userData,
    };

    // Update session with user and auth data
    sessionHandler.update((data: AuthSessionData) => ({ ...data, user, auth }));

    // Save session explicitly
    try {
      this.logger.debug('Saving authentication session data', {
        sessionId: sessionHandler.id,
      });
      await sessionHandler.save();
      this.logger.debug('Session saved successfully');
    } catch (error) {
      this.logger.error('Failed to save session', error);
      throw error;
    }

    return { user, tokens };
  }

  /**
   * Calculate if token needs refresh based on safety margin
   * @param expiresAt Timestamp when token expires
   * @returns True if token should be refreshed
   */
  private shouldRefreshToken(expiresAt: number): boolean {
    const now = Date.now();
    // Convert safety margin to milliseconds
    const safetyMargin = this.TOKEN_REFRESH_SAFETY_MARGIN * 1000;
    // Return true if token will expire within safety margin
    return now + safetyMargin > expiresAt;
  }

  /**
   * Serverless-compatible method to refresh expiring tokens
   * This should be called by a scheduled function/CRON job
   * rather than using setInterval which doesn't work reliably in serverless
   */
  async refreshExpiringTokens(): Promise<{
    refreshed: number;
    failed: number;
    total: number;
  }> {
    let refreshed = 0;
    let failed = 0;

    try {
      const activeSessions = await inject(SessionService).getActiveSessions();

      const expiringSessionCount = activeSessions.filter(
        (session) =>
          session.data?.auth?.isAuthenticated &&
          session.data?.auth?.refreshToken &&
          session.data?.auth?.expiresAt &&
          this.shouldRefreshToken(session.data.auth.expiresAt)
      ).length;

      this.logger.debug(`Found sessions with expiring tokens`, {
        expiringCount: expiringSessionCount,
        totalCount: activeSessions.length,
      });

      // Create a function to handle token refresh for a session
      const refreshSessionToken = async (
        session: SessionWithHandler
      ): Promise<{ success: boolean }> => {
        try {
          const refreshToken = session.data.auth?.refreshToken;
          if (!refreshToken) {
            throw new Error('No refresh token available');
          }

          const tokens = await this.refreshTokens(refreshToken);

          // Update session with new tokens using immutable update pattern
          session.update((data: AuthSessionData) => ({
            ...data,
            auth: {
              ...data.auth,
              isAuthenticated: data.auth?.isAuthenticated ?? false,
              accessToken: tokens.access_token,
              idToken: tokens.id_token || data?.auth?.idToken,
              refreshToken: tokens.refresh_token || data.auth?.refreshToken,
              expiresAt: Date.now() + tokens.expires_in * 1000,
            },
          }));

          // Save updated session
          await session.save();
          this.logger.debug(`Proactively refreshed token for session`, {
            sessionId: session.id,
          });
          return { success: true };
        } catch (error) {
          this.logger.error(`Failed to refresh token for session`, error, {
            sessionId: session.id,
          });
          // Mark session as unauthenticated on refresh failure using immutable update
          session.update((data) => ({
            ...data,
            auth: {
              ...data.auth,
              isAuthenticated: false,
            },
          }));
          await session.save();
          return { success: false };
        }
      };

      // Use a type guard to ensure we only process valid sessions with auth data
      const hasValidAuthWithRefreshToken = (
        session: SessionWithSave
      ): session is SessionWithHandler => {
        return (
          !!session &&
          typeof session === 'object' &&
          'data' in session &&
          !!session.data &&
          'auth' in session.data &&
          !!session.data.auth &&
          'refreshToken' in session.data.auth &&
          !!session.data.auth.refreshToken &&
          'expiresAt' in session.data.auth &&
          !!session.data.auth.expiresAt &&
          'isAuthenticated' in session.data.auth &&
          !!session.data.auth.isAuthenticated &&
          this.shouldRefreshToken(session.data.auth.expiresAt)
        );
      };

      // Get the sessions to refresh
      const sessionsToRefresh = activeSessions.filter(
        hasValidAuthWithRefreshToken
      );

      await this.getOpenIDConfiguration();

      // Execute the refresh operations and track results
      const results = await Promise.allSettled(
        sessionsToRefresh.map(refreshSessionToken)
      );

      // Count successes and failures
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            refreshed++;
          } else {
            failed++;
          }
        } else {
          failed++;
        }
      });

      return { refreshed, failed, total: activeSessions.length };
    } catch (error) {
      this.logger.error('Error checking and refreshing tokens', error);
      return { refreshed, failed, total: 0 };
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(event: H3Event): Promise<boolean> {
    await inject(SessionService).initSession(event);

    const sessionHandler = event.context['sessionHandler'];

    // Ensure auth object exists in session data
    if (!sessionHandler.data.auth) {
      // @ts-expect-error any
      sessionHandler.update((data) => ({
        ...data,
        auth: { isAuthenticated: false },
      }));
      await sessionHandler.save();
      return false;
    }

    // Check if session has auth data
    if (!sessionHandler.data.auth?.isAuthenticated) {
      return false;
    }

    // Check if token is expired
    if (sessionHandler.data.auth.expiresAt < Date.now()) {
      // Token is expired, try to refresh if refresh token exists
      if (sessionHandler.data.auth.refreshToken) {
        try {
          // Refresh the token
          const tokens = await this.refreshTokens(
            sessionHandler.data.auth.refreshToken
          );

          // Update session with new tokens
          sessionHandler.update((data: AuthSessionData) => ({
            ...data,
            auth: {
              ...data.auth,
              accessToken: tokens.access_token,
              idToken: tokens.id_token || data?.auth?.idToken,
              refreshToken: tokens.refresh_token || data?.auth?.refreshToken,
              expiresAt: Date.now() + tokens.expires_in * 1000,
            },
          }));

          // Save session
          await sessionHandler.save();

          return true;
        } catch (error) {
          this.logger.error('Error refreshing token', error);
          // Clear auth data on refresh token failure
          sessionHandler.update((data: AuthSessionData) => ({
            ...data,
            auth: {
              ...data.auth,
              isAuthenticated: false,
            },
          }));
          await sessionHandler.save();
          return false;
        }
      } else {
        // No refresh token available
        return false;
      }
    }

    // Check if token needs proactive refresh
    if (this.shouldRefreshToken(sessionHandler.data.auth.expiresAt)) {
      // Refresh in background without blocking the request
      setTimeout(async () => {
        try {
          // Refresh the token
          const tokens = await this.refreshTokens(
            sessionHandler.data.auth.refreshToken
          );

          // Get fresh session data
          const freshSession = await inject(SessionService).getSession(
            sessionHandler.id
          );
          if (!freshSession || !freshSession.data.auth?.isAuthenticated) {
            return; // Session no longer valid
          }

          // Update session with new tokens
          freshSession.data.auth.accessToken = tokens.access_token;
          if (tokens.id_token) {
            freshSession.data.auth.idToken = tokens.id_token;
          }

          // Update refresh token if a new one was provided
          if (tokens.refresh_token) {
            freshSession.data.auth.refreshToken = tokens.refresh_token;
          }

          // Update expiration time
          freshSession.data.auth.expiresAt =
            Date.now() + tokens.expires_in * 1000;

          // Save session
          await freshSession.save();
        } catch (error) {
          this.logger.error('Background token refresh failed', error);
        }
      }, 0);
    }

    return true;
  }

  /**
   * Get authenticated user
   */
  async getAuthenticatedUser(event: H3Event) {
    // Check if user is authenticated
    if (!(await this.isAuthenticated(event))) {
      return null;
    }

    const sessionHandler = event.context['sessionHandler'];

    const userHandler = this.getConfigValue('userHandler', undefined);

    if (userHandler && 'mapUserToLocal' in userHandler) {
      return userHandler.mapUserToLocal?.(sessionHandler.data.auth.userInfo);
    }

    return sessionHandler.data.auth.userInfo;
  }

  /**
   * Revoke an access token
   */
  private async revokeToken(token: string): Promise<void> {
    const config = await this.getOpenIDConfiguration();
    const response = await fetch(config.revocation_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.getConfigValue('clientId'),
        client_secret: this.getConfigValue('clientSecret'),
        token,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to revoke token');
    }
  }

  /**
   * Logout user
   */
  async logout(event: H3Event): Promise<string> {
    await inject(SessionService).initSession(event);
    const sessionHandler = event.context['sessionHandler'];
    const config = await this.getOpenIDConfiguration();

    // Revoke access token if it exists
    if (sessionHandler.data?.auth?.accessToken) {
      try {
        await this.revokeToken(sessionHandler.data.auth.accessToken);
      } catch (error) {
        this.logger.error('Failed to revoke access token', error);
      }
    }

    // Revoke refresh token if it exists
    if (sessionHandler.data?.auth?.refreshToken) {
      try {
        await this.revokeToken(sessionHandler.data.auth.refreshToken);
      } catch (error) {
        this.logger.error('Failed to revoke refresh token', error);
      }
    }

    // Get OAuth logout URL
    const logoutUrl = new URL(config.end_session_endpoint);
    logoutUrl.searchParams.append('client_id', this.getConfigValue('clientId'));

    // Add returnTo parameter if configured
    const returnTo = this.getConfigValue('logoutUrl');

    if (returnTo) {
      logoutUrl.searchParams.append('returnTo', returnTo);
    }

    // Clear session
    sessionHandler.update((data: AuthSessionData) => ({
      ...data,
      auth: { isAuthenticated: false },
      user: null,
    }));
    await sessionHandler.save();

    return logoutUrl.toString();
  }

  /**
   * Fetch OpenID Configuration from the well-known endpoint
   */
  private async getOpenIDConfiguration(): Promise<OpenIDConfiguration> {
    const now = Date.now();

    // Return cached config if it's still valid
    if (
      this.openIDConfigCache &&
      this.configLastFetched &&
      now - this.configLastFetched < this.CONFIG_CACHE_TTL
    ) {
      return this.openIDConfigCache;
    }

    try {
      const response = await fetch(
        `${this.getConfigValue('issuer')}/.well-known/openid-configuration`
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch OpenID configuration: ${response.statusText}`
        );
      }

      const config = await response.json();
      this.openIDConfigCache = config;
      this.configLastFetched = now;

      return config;
    } catch (error) {
      this.logger.error('Error fetching OpenID configuration', error);
      throw createError({
        statusCode: 500,
        message: 'Failed to fetch OpenID configuration',
      });
    }
  }
}

// OpenID Configuration interface
interface OpenIDConfiguration {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  end_session_endpoint: string;
  revocation_endpoint: string;
}
